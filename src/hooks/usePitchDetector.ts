import { useCallback, useEffect, useRef, useState } from 'react';
import type { PitchReading } from '../types';
import type { AudioFeatureFrame, AudioOnset } from '../audioTraining';

const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

type PitchDetectorProfile = 'accordion' | 'piano';

const DETECTION_PROFILES: Record<PitchDetectorProfile, { minimumFrequency: number; maximumFrequency: number; minimumRms: number; minimumClarity: number }> = {
  accordion: { minimumFrequency: 55, maximumFrequency: 1200, minimumRms: .008, minimumClarity: .62 },
  piano: { minimumFrequency: 27, maximumFrequency: 4300, minimumRms: .0035, minimumClarity: .5 },
};

export function detectPitchFrequency(buffer: Float32Array, sampleRate: number, profile: PitchDetectorProfile = 'accordion') {
  const settings = DETECTION_PROFILES[profile];
  let rms = 0;
  for (const sample of buffer) rms += sample * sample;
  rms = Math.sqrt(rms / buffer.length);
  if (rms < settings.minimumRms) return { frequency: -1, clarity: 0, volume: rms };

  const minLag = Math.max(2, Math.floor(sampleRate / settings.maximumFrequency));
  const maxLag = Math.min(Math.ceil(sampleRate / settings.minimumFrequency), buffer.length - 2);
  let bestLag = -1;
  let bestCorrelation = 0;
  const correlations: number[] = [];
  const sampleStep = profile === 'piano' ? 2 : 1;

  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let correlation = 0;
    let energyA = 0;
    let energyB = 0;
    for (let i = 0; i < buffer.length - lag; i += sampleStep) {
      correlation += buffer[i] * buffer[i + lag];
      energyA += buffer[i] * buffer[i];
      energyB += buffer[i + lag] * buffer[i + lag];
    }
    correlation /= Math.sqrt(energyA * energyB) || 1;
    correlations[lag] = correlation;
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestLag = lag;
    }
  }

  if (bestLag < 0 || bestCorrelation < settings.minimumClarity) return { frequency: -1, clarity: bestCorrelation, volume: rms };

  const strongPeakThreshold = Math.max(settings.minimumClarity, bestCorrelation * .9);
  for (let lag = minLag + 1; lag < maxLag; lag += 1) {
    const correlation = correlations[lag] ?? 0;
    if (correlation >= strongPeakThreshold && correlation >= (correlations[lag - 1] ?? 0) && correlation > (correlations[lag + 1] ?? 0)) {
      bestLag = lag;
      bestCorrelation = correlation;
      break;
    }
  }

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

export function usePitchDetector({ profile = 'accordion' }: { profile?: PitchDetectorProfile } = {}) {
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
  const noiseFloorRef = useRef(profile === 'piano' ? .003 : .006);
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
    if (streamRef.current && contextRef.current) {
      if (contextRef.current.state === 'suspended') await contextRef.current.resume();
      setStatus('listening');
      return true;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Ce navigateur ne donne pas accès au microphone.');
      setStatus('error');
      return false;
    }
    setStatus('requesting');
    setError('');
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: profile === 'piano', noiseSuppression: false, autoGainControl: false, channelCount: 1 },
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
      envelopeRef.current = 0;
      noiseFloorRef.current = profile === 'piano' ? .003 : .006;
      streamRef.current = stream;
      contextRef.current = context;
      setStatus('listening');

      const analyze = (timestamp: number) => {
        if (timestamp - lastUpdateRef.current > 70) {
          lastUpdateRef.current = timestamp;
          analyser.getFloatTimeDomainData(buffer);
          const result = detectPitchFrequency(buffer, context.sampleRate, profile);
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
      stream?.getTracks().forEach((track) => track.stop());
      const denied = reason instanceof DOMException && (reason.name === 'NotAllowedError' || reason.name === 'PermissionDeniedError');
      setStatus(denied ? 'denied' : 'error');
      setError(denied ? 'Autorise le microphone dans ton navigateur, puis réessaie.' : 'Le microphone n’a pas pu démarrer.');
      return false;
    }
  }, [profile]);

  useEffect(() => stop, [stop]);

  return { reading, audioFrame, onset, status, error, start, stop };
}
