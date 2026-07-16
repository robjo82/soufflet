import { describe, expect, it } from 'vitest';
import { PIANO_EXERCISES, pianoRange, pianoScore } from './pianoData';

describe('piano V1', () => {
  it('ships three increasingly long monophonic exercises', () => {
    expect(PIANO_EXERCISES.map((item) => item.notes.length)).toEqual([8, 14, 24]);
    expect(PIANO_EXERCISES.every((item) => new Set(item.notes.map((note) => note.beat)).size === item.notes.length)).toBe(true);
  });
  it('centers compact keyboards around middle C', () => {
    expect(pianoRange(25)).toContain(60);
    expect(pianoRange(88)).toEqual(expect.arrayContaining([21, 108]));
  });
  it('computes an actionable score', () => {
    expect(pianoScore(8, 2, [10, 100, 400])).toMatchObject({ correct: 8, missed: 2, averageDelay: 170, rhythmAccuracy: 67, global: 76 });
  });
});
