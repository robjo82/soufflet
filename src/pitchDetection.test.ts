import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  detectPitchFrequency, detectResponsivePitchFrequency, EMPTY_PITCH_STABILITY, frequencyToPitch, stabilizePitchReading,
} from './hooks/usePitchDetector';

function recordedAccordionSample(midi: number) {
  const file = readFileSync(new URL(`../public/audio/accordion/freepats-hn-20240329/m${midi}.wav`, import.meta.url));
  let offset = 12;
  let channels = 1;
  let sampleRate = 44_100;
  let dataOffset = 0;
  let dataSize = 0;
  while (offset + 8 <= file.length) {
    const id = file.toString('ascii', offset, offset + 4);
    const size = file.readUInt32LE(offset + 4);
    if (id === 'fmt ') {
      channels = file.readUInt16LE(offset + 10);
      sampleRate = file.readUInt32LE(offset + 12);
      expect(file.readUInt16LE(offset + 22)).toBe(16);
    }
    if (id === 'data') {
      dataOffset = offset + 8;
      dataSize = size;
      break;
    }
    offset += 8 + size + size % 2;
  }
  const samples = new Float32Array(dataSize / channels / 2);
  for (let frame = 0; frame < samples.length; frame += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      samples[frame] += file.readInt16LE(dataOffset + (frame * channels + channel) * 2) / 32768 / channels;
    }
  }
  return { samples, sampleRate };
}

function accordionTone(frequency: number, sampleRate: number, harmonics = [1, 0.72, 0.46, 0.31, 0.2]) {
  const buffer = new Float32Array(4096);
  for (let index = 0; index < buffer.length; index += 1) {
    const time = index / sampleRate;
    buffer[index] = harmonics.reduce((sample, amplitude, harmonic) => (
      sample + amplitude * Math.sin(2 * Math.PI * frequency * (harmonic + 1) * time + harmonic * 0.17)
    ), 0) * 0.12;
  }
  return buffer;
}

function expectDetectedNote(note: string, frequency: number, sampleRate: number) {
  const detected = detectPitchFrequency(accordionTone(frequency, sampleRate), sampleRate);
  expect(detected.frequency).toBeGreaterThan(0);
  expect(frequencyToPitch(detected.frequency).note).toBe(note);
  expect(Math.abs(1200 * Math.log2(detected.frequency / frequency))).toBeLessThan(5);
}

describe('microphone pitch detection', () => {
  it.each([
    ['C4', 261.6256],
    ['A4', 440],
    ['F♯5', 739.9888],
  ])('detects the useful Club I note %s', (note, frequency) => {
    expectDetectedNote(note, frequency, 48_000);
  });

  it.each([44_100, 48_000])('does not halve G5 at %i Hz', (sampleRate) => {
    expectDetectedNote('G5', 783.9909, sampleRate);
  });

  it.each([44_100, 48_000])('detects E6 above the former 1,200 Hz ceiling at %i Hz', (sampleRate) => {
    expectDetectedNote('E6', 1318.5102, sampleRate);
  });

  it('rejects a signal below the useful microphone level', () => {
    const detected = detectPitchFrequency(new Float32Array(4096).fill(0.001), 48_000);
    expect(detected).toMatchObject({ frequency: -1, clarity: 0 });
  });

  it('does not turn broadband noise into a playable note', () => {
    let state = 0x12345678;
    const noise = Float32Array.from({ length: 4096 }, () => {
      state = (1664525 * state + 1013904223) >>> 0;
      return ((state / 0xffffffff) * 2 - 1) * .08;
    });
    expect(detectPitchFrequency(noise, 48_000).frequency).toBe(-1);
  });

  it('keeps the fundamental when the second reed harmonic is louder', () => {
    const frequency = 293.6648;
    const detected = detectPitchFrequency(accordionTone(frequency, 48_000, [.32, 1, .5, .28]), 48_000);
    expect(frequencyToPitch(detected.frequency).note).toBe('D4');
  });

  it('isolates a short E5 attack from the preceding recorded accordion note', () => {
    const d5 = recordedAccordionSample(74);
    const e5 = recordedAccordionSample(76);
    const transition = new Float32Array(3072);
    transition.set(d5.samples.subarray(15_000, 16_536));
    transition.set(e5.samples.subarray(30_000, 31_536), 1536);

    const smeared = detectPitchFrequency(transition, d5.sampleRate);
    const isolated = detectResponsivePitchFrequency(transition, d5.sampleRate);
    expect(frequencyToPitch(smeared.frequency).note).not.toBe('E5');
    expect(frequencyToPitch(isolated.frequency).note).toBe('E5');
    expect(isolated.clarity).toBeGreaterThan(.95);
  });

  it('recognizes a quiet recorded E5 without accepting silence', () => {
    const e5 = recordedAccordionSample(76);
    const quiet = Float32Array.from(e5.samples.subarray(30_000, 33_072), (sample) => sample * .018);
    const detected = detectResponsivePitchFrequency(quiet, e5.sampleRate);
    expect(frequencyToPitch(detected.frequency).note).toBe('E5');
    expect(detected.volume).toBeGreaterThan(.0045);
    expect(detectResponsivePitchFrequency(new Float32Array(4096).fill(.002), e5.sampleRate).frequency).toBe(-1);
  });

  it('tracks every note in a fast phrase made from recorded Hohner reeds', () => {
    const midis = [74, 76, 79, 76];
    const recordings = midis.map(recordedAccordionSample);
    const sampleRate = recordings[0].sampleRate;
    const noteLength = Math.round(sampleRate * .14);
    const leadIn = 4096;
    const phrase = new Float32Array(leadIn + noteLength * recordings.length);
    recordings.forEach(({ samples }, index) => {
      phrase.set(samples.subarray(15_000, 15_000 + noteLength), leadIn + index * noteLength);
    });

    let stability = EMPTY_PITCH_STABILITY;
    const heard: number[] = [];
    const hop = Math.round(sampleRate * .038);
    for (let end = leadIn; end <= phrase.length; end += hop) {
      const result = detectResponsivePitchFrequency(phrase.subarray(end - 4096, end), sampleRate);
      const pitch = result.frequency > 0 ? frequencyToPitch(result.frequency, result.clarity, result.volume) : null;
      const stabilized = stabilizePitchReading(stability, pitch);
      stability = stabilized.state;
      if (stabilized.reading && heard.at(-1) !== stabilized.reading.midi) heard.push(stabilized.reading.midi);
    }

    expect(heard).toEqual(midis);
  });
});
