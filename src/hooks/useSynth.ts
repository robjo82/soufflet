import { useCallback, useEffect, useRef } from 'react';

export function useSynth() {
  const contextRef = useRef<AudioContext | null>(null);
  const activeRef = useRef<Set<OscillatorNode>>(new Set());

  const getContext = useCallback(() => {
    const context = contextRef.current ?? new AudioContext({ latencyHint: 'interactive' });
    contextRef.current = context;
    if (context.state === 'suspended') void context.resume();
    return context;
  }, []);

  const playMidi = useCallback((midi: number, duration = 0.3, volume = 0.11) => {
    const context = getContext();
    const now = context.currentTime;
    const output = context.createGain();
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2800;
    output.gain.setValueAtTime(0.0001, now);
    output.gain.exponentialRampToValueAtTime(volume, now + 0.018);
    output.gain.setValueAtTime(volume, Math.max(now + 0.02, now + duration - 0.05));
    output.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    filter.connect(output).connect(context.destination);

    [0, 0.045].forEach((detune, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = index === 0 ? 'sawtooth' : 'square';
      oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12);
      oscillator.detune.value = detune * 100;
      oscillator.connect(filter);
      activeRef.current.add(oscillator);
      oscillator.start(now);
      oscillator.stop(now + duration + 0.02);
      oscillator.onended = () => activeRef.current.delete(oscillator);
    });
  }, [getContext]);

  const click = useCallback((accent = false) => {
    const context = getContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = accent ? 1280 : 940;
    oscillator.type = 'sine';
    gain.gain.setValueAtTime(accent ? 0.16 : 0.09, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.05);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.055);
  }, [getContext]);

  useEffect(() => () => {
    activeRef.current.forEach((node) => node.stop());
    void contextRef.current?.close();
  }, []);

  return { playMidi, click };
}
