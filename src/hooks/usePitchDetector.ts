import { useCallback, useEffect, useRef, useState } from 'react';
import type { PitchReading } from '../types';
import type { AudioFeatureFrame, AudioOnset } from '../audioTraining';
import { canManageNativeMicrophone, openNativeMicrophoneSettings, requestNativeMicrophonePermission } from '../nativeMicrophone';

const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

function autoCorrelate(buffer: Float32Array, sampleRate: number) {
  let rms = 0;
  for (const sample of buffer) rms += sample * sample;
  rms = Math.sqrt(rms / buffer.length);
  if (rms < 0.008) return { frequency: -1, clarity: 0, volume: rms };

  const minLag = Math.floor(sampleRate / 1200);
  const maxLag = Math.min(Math.floor(sampleRate / 55), buffer.length - 1);
  let bestLag = -1;
  let bestCorrelation = 0;
  let previous = 0;
  const correlations: number[] = [];

  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let correlation = 0;
    let energyA = 0;
    let energyB = 0;
    for (let i = 0; i < buffer.length - lag; i += 1) {
      correlation += buffer[i] * buffer[i + lag];
      energyA += buffer[i] * buffer[i];
      energyB += buffer[i + lag] * buffer[i + lag];
    }
    correlation /= Math.sqrt(energyA * energyB) || 1;
    correlations[lag] = correlation;
    if (correlation > bestCorrelation && correlation > previous) {
      bestCorrelation = correlation;
      bestLag = lag;
    }
    previous = correlation;
  }

  if (bestLag < 0 || bestCorrelation < 0.62) return { frequency: -1, clarity: bestCorrelation, volume: rms };

  const left = correlations[bestLag - 1] ?? bestCorrelation;
  const right = correlations[bestLag + 1] ?? bestCorrelation;
  const shift = (right - left) / (2 * (2 * bestCorrelation - left - right) || 1);
  return { frequency: sampleRate / (bestLag + shift), clarity: bestCorrelation, volume: rms };
}

export function frequencyToPitch(frequency: number, confidence = 1, volume = 1, concertA = 440): PitchReading {
  const exactMidi = 69 + 12 * Math.log2(frequency / concertA);
  const midi = Math.round(exactMidi);
  const cents = Math.round((exactMidi - midi) * 100);
  return {
    note: `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`,
    midi,
    frequency,
    cents,
    confidence,
    volume,
  };
}

export function rememberReliablePitch(previous: PitchReading | null, current: PitchReading | null, minimumConfidence = 0.72) {
  return current && current.confidence > minimumConfidence ? current : previous;
}

export function usePitchDetector() {
  const [reading, setReading] = useState<PitchReading | null>(null);
  const [audioFrame, setAudioFrame] = useState<AudioFeatureFrame | null>(null);
  const [onset, setOnset] = useState<AudioOnset | null>(null);
  const [status, setStatus] = useState<'idle' | 'requesting' | 'listening' | 'denied' | 'error'>('idle');
  const [error, setError] = useState('');
  const contextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number>(0);
  const lastUpdateRef = useRef(0);
  const envelopeRef = useRef(0);
  const noiseFloorRef = useRef(.006);
  const lastOnsetRef = useRef(0);
  const onsetIdRef = useRef(0);

  const stop = useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    void contextRef.current?.close();
    streamRef.current = null;
    contextRef.current = null;
    setReading(null);
    setAudioFrame(null);
    setOnset(null);
    setStatus('idle');
  }, []);

  const start = useCallback(async () => {
    if (streamRef.current && contextRef.current) return true;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Ce navigateur ne donne pas accès au microphone.');
      setStatus('error');
      return false;
    }
    setStatus('requesting');
    setError('');
    try {
      const nativePermission = await requestNativeMicrophonePermission();
      if (nativePermission !== 'unavailable' && nativePermission !== 'granted') {
        setStatus('denied');
        setError('Le microphone est désactivé pour Soufflet. Autorise-le dans les réglages Android, puis réessaie.');
        return false;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: false },
      });
      const context = new AudioContext({ latencyHint: 'interactive' });
      await context.resume();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0.08;
      source.connect(analyser);
      const buffer = new Float32Array(analyser.fftSize);
      const frequencyData = new Float32Array(analyser.frequencyBinCount);
      streamRef.current = stream;
      contextRef.current = context;
      setStatus('listening');

      const analyze = (timestamp: number) => {
        analyser.getFloatTimeDomainData(buffer);
        const result = autoCorrelate(buffer, context.sampleRate);
        if (timestamp - lastUpdateRef.current > 70) {
          lastUpdateRef.current = timestamp;
          const pitch = result.frequency > 0 ? frequencyToPitch(result.frequency, result.clarity, result.volume) : null;
          analyser.getFloatFrequencyData(frequencyData);
          let spectralEnergy = 0;
          let weightedFrequency = 0;
          let brightEnergy = 0;
          const binWidth = context.sampleRate / analyser.fftSize;
          for (let index = 1; index < frequencyData.length; index += 1) {
            if (frequencyData[index] < -90) continue;
            const energy = 10 ** (frequencyData[index] / 20);
            const frequency = index * binWidth;
            spectralEnergy += energy;
            weightedFrequency += frequency * energy;
            if (frequency >= 2000) brightEnergy += energy;
          }
          const frame: AudioFeatureFrame = {
            at: timestamp,
            volume: result.volume,
            spectralCentroid: spectralEnergy ? weightedFrequency / spectralEnergy : 0,
            brightness: spectralEnergy ? brightEnergy / spectralEnergy : 0,
            pitch,
          };
          const previousEnvelope = envelopeRef.current;
          const threshold = Math.max(.012, noiseFloorRef.current * 2.7);
          const isAttack = result.volume > threshold
            && result.volume > Math.max(previousEnvelope * 1.42, threshold)
            && timestamp - lastOnsetRef.current > 220;
          envelopeRef.current = previousEnvelope * .7 + result.volume * .3;
          if (result.volume < Math.max(.012, noiseFloorRef.current * 1.8)) {
            noiseFloorRef.current = noiseFloorRef.current * .97 + result.volume * .03;
          }
          if (isAttack) {
            lastOnsetRef.current = timestamp;
            onsetIdRef.current += 1;
            setOnset({ id: onsetIdRef.current, at: timestamp, volume: result.volume });
          }
          setReading(pitch);
          setAudioFrame(frame);
        }
        frameRef.current = requestAnimationFrame(analyze);
      };
      frameRef.current = requestAnimationFrame(analyze);
      return true;
    } catch (reason) {
      const denied = reason instanceof DOMException && (reason.name === 'NotAllowedError' || reason.name === 'PermissionDeniedError');
      setStatus(denied ? 'denied' : 'error');
      setError(denied
        ? canManageNativeMicrophone()
          ? 'Le microphone est désactivé pour Soufflet. Autorise-le dans les réglages Android, puis réessaie.'
          : 'Autorise le microphone dans ton navigateur, puis réessaie.'
        : 'Le microphone n’a pas pu démarrer.');
      return false;
    }
  }, []);

  const openSettings = useCallback(() => openNativeMicrophoneSettings(), []);

  useEffect(() => stop, [stop]);

  return {
    reading,
    audioFrame,
    onset,
    status,
    error,
    start,
    stop,
    canOpenSettings: canManageNativeMicrophone(),
    openSettings,
  };
}
