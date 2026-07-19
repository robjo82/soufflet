import { useCallback, useEffect, useRef } from 'react';
import {
  ACCORDION_SAMPLES,
  accordionSampleAssetPath,
  sampleLoopSeconds,
  samplePlaybackRate,
  selectAccordionSample,
  type AccordionSample,
} from '../audio/accordionSampleBank';

const rawSampleCache = new Map<string, Promise<ArrayBuffer>>();
const decodedSampleCache = new WeakMap<AudioContext, Map<string, Promise<AudioBuffer>>>();
const masterBusCache = new WeakMap<AudioContext, DynamicsCompressorNode>();

function sampleUrl(sample: AccordionSample) {
  return `/${accordionSampleAssetPath(sample)}`;
}

function fetchSample(sample: AccordionSample) {
  const url = sampleUrl(sample);
  const cached = rawSampleCache.get(url);
  if (cached) return cached;
  const request = fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error(`Accordion sample unavailable (${response.status})`);
      return response.arrayBuffer();
    })
    .catch((error) => {
      rawSampleCache.delete(url);
      throw error;
    });
  rawSampleCache.set(url, request);
  return request;
}

function decodeSample(context: AudioContext, sample: AccordionSample) {
  let contextCache = decodedSampleCache.get(context);
  if (!contextCache) {
    contextCache = new Map();
    decodedSampleCache.set(context, contextCache);
  }
  const url = sampleUrl(sample);
  const cached = contextCache.get(url);
  if (cached) return cached;
  const request = fetchSample(sample)
    .then((data) => context.decodeAudioData(data.slice(0)))
    .catch((error) => {
      contextCache?.delete(url);
      throw error;
    });
  contextCache.set(url, request);
  return request;
}

function masterBus(context: AudioContext) {
  const cached = masterBusCache.get(context);
  if (cached) return cached;
  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -16;
  compressor.knee.value = 12;
  compressor.ratio.value = 3;
  compressor.attack.value = .004;
  compressor.release.value = .16;
  compressor.connect(context.destination);
  masterBusCache.set(context, compressor);
  return compressor;
}

function warmSampleBank(context?: AudioContext) {
  for (const sample of ACCORDION_SAMPLES) {
    if (context) void decodeSample(context, sample).catch(() => undefined);
    else void fetchSample(sample).catch(() => undefined);
  }
}

export function useSynth() {
  const contextRef = useRef<AudioContext | null>(null);
  const activeRef = useRef<Set<AudioScheduledSourceNode>>(new Set());

  const getContext = useCallback(() => {
    const isNew = !contextRef.current;
    const context = contextRef.current ?? new AudioContext({ latencyHint: 'interactive' });
    contextRef.current = context;
    if (context.state === 'suspended') void context.resume();
    // Let the note requested by this gesture enter the decode queue first;
    // the rest of the bank is warmed on the following task.
    if (isNew) globalThis.setTimeout(() => {
      if (context.state !== 'closed') warmSampleBank(context);
    }, 0);
    return context;
  }, []);

  const playFallbackMidi = useCallback((context: AudioContext, midi: number, duration: number, volume: number) => {
    const now = context.currentTime;
    const output = context.createGain();
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 4200;
    filter.Q.value = .35;
    output.gain.setValueAtTime(0.0001, now);
    output.gain.exponentialRampToValueAtTime(volume, now + 0.035);
    output.gain.setValueAtTime(volume * .82, Math.max(now + 0.04, now + duration - 0.075));
    output.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    filter.connect(output).connect(masterBus(context));

    const harmonics = new Float32Array([0, 1, .58, .36, .24, .16, .11, .075, .05, .035]);
    const wave = context.createPeriodicWave(new Float32Array(harmonics.length), harmonics, { disableNormalization: false });

    [0, 2.8].forEach((detune) => {
      const oscillator = context.createOscillator();
      oscillator.setPeriodicWave(wave);
      oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12);
      oscillator.detune.value = detune;
      oscillator.connect(filter);
      activeRef.current.add(oscillator);
      oscillator.start(now);
      oscillator.stop(now + duration + 0.02);
      oscillator.onended = () => activeRef.current.delete(oscillator);
    });
  }, []);

  const playMidi = useCallback((midi: number, duration = 0.3, volume = 0.11) => {
    const context = getContext();
    const sample = selectAccordionSample(midi);
    let resolved = false;
    const fallbackTimer = globalThis.setTimeout(() => {
      if (resolved || context.state === 'closed') return;
      resolved = true;
      playFallbackMidi(context, midi, duration, volume);
    }, 120);

    void decodeSample(context, sample).then((buffer) => {
      if (resolved || context.state === 'closed') return;
      resolved = true;
      globalThis.clearTimeout(fallbackTimer);
      const now = context.currentTime + .003;
      const source = context.createBufferSource();
      const gain = context.createGain();
      const filter = context.createBiquadFilter();
      const loop = sampleLoopSeconds(sample);
      const attack = Math.min(.055, Math.max(.018, duration * .16));
      const release = Math.min(.12, Math.max(.045, duration * .24));
      const level = Math.min(.42, volume * 2.25);

      source.buffer = buffer;
      source.playbackRate.value = samplePlaybackRate(sample, midi);
      source.loop = true;
      source.loopStart = loop.start;
      source.loopEnd = loop.end;
      filter.type = 'lowpass';
      filter.frequency.value = midi < 52 ? 3600 : 7200;
      filter.Q.value = .2;
      gain.gain.setValueAtTime(.0001, now);
      gain.gain.exponentialRampToValueAtTime(level, now + attack);
      gain.gain.setValueAtTime(level * .9, Math.max(now + attack, now + duration - release));
      gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
      source.connect(filter).connect(gain).connect(masterBus(context));
      activeRef.current.add(source);
      source.start(now, 50 / buffer.sampleRate);
      source.stop(now + duration + .025);
      source.onended = () => activeRef.current.delete(source);
    }).catch(() => {
      if (resolved || context.state === 'closed') return;
      resolved = true;
      globalThis.clearTimeout(fallbackTimer);
      playFallbackMidi(context, midi, duration, volume);
    });
  }, [getContext, playFallbackMidi]);

  const click = useCallback((accent = false) => {
    const context = getContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = accent ? 1280 : 940;
    oscillator.type = 'sine';
    gain.gain.setValueAtTime(accent ? 0.16 : 0.09, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.05);
    oscillator.connect(gain).connect(masterBus(context));
    oscillator.start();
    oscillator.stop(context.currentTime + 0.055);
  }, [getContext]);

  const playLeftHand = useCallback((midi: number, role: 'bass' | 'chord', chord = 'C', duration = .38) => {
    if (role === 'bass') {
      playMidi(midi, duration, .1);
      return;
    }
    const minor = chord.endsWith('m');
    [0, minor ? 3 : 4, 7].forEach((interval) => playMidi(midi + interval, duration, .045));
  }, [playMidi]);

  useEffect(() => {
    const activeNodes = activeRef.current;
    warmSampleBank();
    return () => {
      activeNodes.forEach((node) => node.stop());
      void contextRef.current?.close();
    };
  }, []);

  return { playMidi, playLeftHand, click };
}
