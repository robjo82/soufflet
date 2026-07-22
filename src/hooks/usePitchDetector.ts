import { useCallback, useEffect, useRef, useState } from 'react';
import type { PitchReading } from '../types';
import type { AudioFeatureFrame, AudioOnset } from '../audioTraining';
import { canManageNativeMicrophone, openNativeMicrophoneSettings, requestNativeMicrophonePermission } from '../nativeMicrophone';

const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

const MIN_PITCH_HZ = 55;
const MAX_PITCH_HZ = 2500;
const YIN_THRESHOLD = 0.15;
const MIN_PITCH_CLARITY = 0.62;
const MIN_SIGNAL_RMS = 0.0045;
const RESPONSIVE_WINDOW_SIZE = 1536;
const ANALYSIS_WINDOW_SIZE = 3072;
const ANALYSIS_INTERVAL_MS = 38;

export function detectPitchFrequency(buffer: Float32Array, sampleRate: number) {
  let rms = 0;
  for (const sample of buffer) rms += sample * sample;
  rms = Math.sqrt(rms / buffer.length);
  if (rms < MIN_SIGNAL_RMS) return { frequency: -1, clarity: 0, volume: rms };

  const minLag = Math.max(2, Math.floor(sampleRate / MAX_PITCH_HZ));
  const maxLag = Math.min(Math.ceil(sampleRate / MIN_PITCH_HZ), Math.floor(buffer.length / 2));
  const comparisonLength = buffer.length - maxLag;
  const difference = new Float32Array(maxLag + 1);
  const normalizedDifference = new Float32Array(maxLag + 1);

  for (let lag = 1; lag <= maxLag; lag += 1) {
    let sum = 0;
    for (let index = 0; index < comparisonLength; index += 1) {
      const delta = buffer[index] - buffer[index + lag];
      sum += delta * delta;
    }
    difference[lag] = sum;
  }

  normalizedDifference[0] = 1;
  let runningSum = 0;
  for (let lag = 1; lag <= maxLag; lag += 1) {
    runningSum += difference[lag];
    normalizedDifference[lag] = runningSum > 0 ? difference[lag] * lag / runningSum : 1;
  }

  // YIN deliberately selects the first convincing valley. A global maximum of
  // autocorrelation can instead select two or four periods and report G4 for G5.
  let selectedLag = -1;
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    if (normalizedDifference[lag] >= YIN_THRESHOLD) continue;
    selectedLag = lag;
    while (selectedLag < maxLag && normalizedDifference[selectedLag + 1] < normalizedDifference[selectedLag]) {
      selectedLag += 1;
    }
    break;
  }

  if (selectedLag < 0) {
    let bestValue = Number.POSITIVE_INFINITY;
    for (let lag = minLag; lag <= maxLag; lag += 1) {
      if (normalizedDifference[lag] < bestValue) {
        bestValue = normalizedDifference[lag];
        selectedLag = lag;
      }
    }
  }

  const clarity = selectedLag > 0 ? 1 - normalizedDifference[selectedLag] : 0;
  if (selectedLag < 0 || clarity < MIN_PITCH_CLARITY) return { frequency: -1, clarity, volume: rms };

  const left = normalizedDifference[selectedLag - 1] ?? normalizedDifference[selectedLag];
  const center = normalizedDifference[selectedLag];
  const right = normalizedDifference[selectedLag + 1] ?? center;
  const denominator = left - 2 * center + right;
  const shift = denominator === 0 ? 0 : Math.max(-1, Math.min(1, (left - right) / (2 * denominator)));
  return { frequency: sampleRate / (selectedLag + shift), clarity, volume: rms };
}

export function detectResponsivePitchFrequency(buffer: Float32Array, sampleRate: number) {
  const analysisBuffer = buffer.length > ANALYSIS_WINDOW_SIZE
    ? buffer.subarray(buffer.length - ANALYSIS_WINDOW_SIZE)
    : buffer;
  const sustained = detectPitchFrequency(analysisBuffer, sampleRate);
  if (analysisBuffer.length <= RESPONSIVE_WINDOW_SIZE || (sustained.frequency > 0 && sustained.frequency < 150)) return sustained;

  // A long YIN window is reliable on held and low notes, but straddles two
  // pitches for almost 90 ms at common mobile sample rates. The recent window
  // isolates the new reed vibration. Temporal stabilization below still
  // requires two coherent observations before exposing the change.
  const recent = detectPitchFrequency(analysisBuffer.subarray(analysisBuffer.length - RESPONSIVE_WINDOW_SIZE), sampleRate);
  if (recent.frequency <= 0 || recent.clarity < .72) return sustained;
  if (sustained.frequency <= 0) return recent;
  const distance = Math.abs(12 * Math.log2(recent.frequency / sustained.frequency));
  return distance >= .35 ? recent : recent.clarity >= sustained.clarity - .06 ? recent : sustained;
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

export interface PitchStabilityState {
  stable: PitchReading | null;
  candidateMidi: number | null;
  candidateFrames: number;
}

export const EMPTY_PITCH_STABILITY: PitchStabilityState = { stable: null, candidateMidi: null, candidateFrames: 0 };

export function stabilizePitchReading(state: PitchStabilityState, current: PitchReading | null, minimumConfidence = 0.72) {
  if (!current || current.confidence <= minimumConfidence) {
    return { state: { ...state, candidateMidi: null, candidateFrames: 0 }, reading: null as PitchReading | null };
  }
  if (state.stable?.midi === current.midi) {
    return { state: { stable: current, candidateMidi: null, candidateFrames: 0 }, reading: current as PitchReading | null };
  }
  const candidateFrames = state.candidateMidi === current.midi ? state.candidateFrames + 1 : 1;
  // The first note must remain immediate, especially after starting the mic.
  // Once a reed is established, one extra observation prevents a short pitch
  // glide between two real notes from briefly lighting an unrelated button.
  const requiredFrames = state.stable
    ? current.confidence >= .9 ? 3 : 5
    : current.confidence >= .9 ? 2 : 3;
  if (candidateFrames >= requiredFrames) {
    return { state: { stable: current, candidateMidi: null, candidateFrames: 0 }, reading: current as PitchReading | null };
  }
  return {
    state: { ...state, candidateMidi: current.midi, candidateFrames },
    reading: null as PitchReading | null,
  };
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
  const pitchStabilityRef = useRef<PitchStabilityState>(EMPTY_PITCH_STABILITY);

  const stop = useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    void contextRef.current?.close();
    streamRef.current = null;
    contextRef.current = null;
    pitchStabilityRef.current = EMPTY_PITCH_STABILITY;
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
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
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
      pitchStabilityRef.current = EMPTY_PITCH_STABILITY;
      setStatus('listening');

      const analyze = (timestamp: number) => {
        if (timestamp - lastUpdateRef.current > ANALYSIS_INTERVAL_MS) {
          lastUpdateRef.current = timestamp;
          analyser.getFloatTimeDomainData(buffer);
          const result = detectResponsivePitchFrequency(buffer, context.sampleRate);
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
          const stabilized = stabilizePitchReading(pitchStabilityRef.current, pitch);
          pitchStabilityRef.current = stabilized.state;
          setReading(stabilized.reading);
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
