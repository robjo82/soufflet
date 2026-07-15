import { useCallback, useEffect, useRef, useState } from 'react';
import type { PitchReading } from '../types';

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
  const [status, setStatus] = useState<'idle' | 'requesting' | 'listening' | 'denied' | 'error'>('idle');
  const [error, setError] = useState('');
  const contextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number>(0);
  const lastUpdateRef = useRef(0);

  const stop = useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    void contextRef.current?.close();
    streamRef.current = null;
    contextRef.current = null;
    setReading(null);
    setStatus('idle');
  }, []);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Ce navigateur ne donne pas accès au microphone.');
      setStatus('error');
      return;
    }
    setStatus('requesting');
    setError('');
    try {
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
      streamRef.current = stream;
      contextRef.current = context;
      setStatus('listening');

      const analyze = (timestamp: number) => {
        analyser.getFloatTimeDomainData(buffer);
        const result = autoCorrelate(buffer, context.sampleRate);
        if (timestamp - lastUpdateRef.current > 70) {
          lastUpdateRef.current = timestamp;
          setReading(result.frequency > 0 ? frequencyToPitch(result.frequency, result.clarity, result.volume) : null);
        }
        frameRef.current = requestAnimationFrame(analyze);
      };
      frameRef.current = requestAnimationFrame(analyze);
    } catch (reason) {
      const denied = reason instanceof DOMException && (reason.name === 'NotAllowedError' || reason.name === 'PermissionDeniedError');
      setStatus(denied ? 'denied' : 'error');
      setError(denied ? 'Autorise le microphone dans ton navigateur, puis réessaie.' : 'Le microphone n’a pas pu démarrer.');
    }
  }, []);

  useEffect(() => stop, [stop]);

  return { reading, status, error, start, stop };
}
