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

  const playMidi = useCallback((midi: number, duration = 0.3, volume = 0.11, timbre: 'accordion' | 'piano' = 'accordion') => {
    const context = getContext();
    const now = context.currentTime;
    const output = context.createGain();
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2800;
    output.gain.setValueAtTime(0.0001, now);
    output.gain.exponentialRampToValueAtTime(volume, now + (timbre === 'piano' ? .006 : .018));
    if (timbre === 'piano') output.gain.exponentialRampToValueAtTime(Math.max(.0002, volume * .18), now + Math.max(.18, duration * .72));
    else output.gain.setValueAtTime(volume, Math.max(now + 0.02, now + duration - 0.05));
    output.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    filter.connect(output).connect(context.destination);

    const voices = timbre === 'piano' ? [{ ratio: 1, gain: 1 }, { ratio: 2, gain: .22 }, { ratio: 3, gain: .08 }] : [{ ratio: 1, gain: 1 }, { ratio: 1.003, gain: .7 }];
    voices.forEach((voice, index) => {
      const oscillator = context.createOscillator();
      const voiceGain = context.createGain();
      oscillator.type = timbre === 'piano' ? 'sine' : index === 0 ? 'sawtooth' : 'triangle';
      oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12) * voice.ratio;
      voiceGain.gain.value = voice.gain;
      oscillator.connect(voiceGain).connect(filter);
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

  const prepareAudio = useCallback(() => { getContext(); }, [getContext]);
  const stopAll = useCallback(() => { activeRef.current.forEach((node) => { try { node.stop(); } catch { /* already stopped */ } }); activeRef.current.clear(); }, []);

  const playLeftHand = useCallback((midi: number, role: 'bass' | 'chord', chord = 'C', duration = .38) => {
    if (role === 'bass') {
      playMidi(midi, duration, .1);
      return;
    }
    const minor = chord.endsWith('m');
    [0, minor ? 3 : 4, 7].forEach((interval) => playMidi(midi + interval, duration, .045));
  }, [playMidi]);

  useEffect(() => () => {
    activeRef.current.forEach((node) => node.stop());
    void contextRef.current?.close();
  }, []);

  return { playMidi, playLeftHand, click, prepareAudio, stopAll };
}
