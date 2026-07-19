import { describe, expect, it } from 'vitest';
import { detectPitchFrequency, frequencyToPitch } from './hooks/usePitchDetector';

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
});
