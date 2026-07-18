import { describe, expect, it } from 'vitest';
import { classifyPianoAttempt, hasPianoNoteReachedHitLine, isPianoHit, isPianoNoteAtHitLine, PIANO_CORRECT_TOLERANCE_PX, PIANO_EXERCISES, PIANO_TIMING_TOLERANCE_PX, pianoExerciseEndBeat, pianoKeyGeometry, pianoNoteDurationSeconds, pianoNoteOffsetPx, pianoNotePlaybackTiming, pianoRange, pianoScore, resumeTimeline } from './pianoData';

describe('piano V1', () => {
  it('ships right-hand pieces and a first two-hand piece', () => {
    expect(PIANO_EXERCISES.slice(0, 4).map((item) => item.notes.length)).toEqual([8, 14, 24, 18]);
    expect(PIANO_EXERCISES.filter((item) => item.hand === 'both')).toHaveLength(2);
    expect(PIANO_EXERCISES.filter((item) => item.id !== 'my-way-advanced').every((item) => new Set(item.notes.map((note) => note.beat)).size === item.notes.length)).toBe(true);
  });
  it('offers the supplied My Way score at three progressive levels', () => {
    const arrangements = PIANO_EXERCISES.filter((item) => item.title === 'My Way');
    expect(arrangements).toHaveLength(3);
    expect(arrangements.map((item) => item.level)).toEqual(['Très simple', 'Simple', 'Modéré']);
    expect(arrangements.map((item) => item.artist)).toEqual(['Frank Sinatra', 'Frank Sinatra', 'Frank Sinatra']);
    expect(arrangements.map((item) => item.notes.length)).toEqual([27, 62, 131]);
    expect(arrangements[2]).toMatchObject({ hand: 'both', bpm: 72 });
    expect(arrangements[2].notes.some((note) => note.midi < 60)).toBe(true);
    expect(new Set(arrangements[2].notes.map((note) => note.beat)).size).toBeLessThan(arrangements[2].notes.length);
    expect(pianoExerciseEndBeat(arrangements[2].notes)).toBe(69);
  });
  it('centers compact keyboards around middle C', () => {
    expect(pianoRange(25)).toContain(60);
    expect(pianoRange(88)).toEqual(expect.arrayContaining([21, 108]));
  });
  it('lays black keys over adjacent white keys without consuming horizontal space', () => {
    const geometry = pianoKeyGeometry(25);
    const c = geometry.find((key) => key.midi === 48)!;
    const cSharp = geometry.find((key) => key.midi === 49)!;
    const d = geometry.find((key) => key.midi === 50)!;
    expect(c.left + c.width).toBeCloseTo(d.left);
    expect(cSharp.left).toBeLessThan(c.left + c.width);
    expect(cSharp.left + cSharp.width).toBeGreaterThan(d.left);
  });
  it('puts a note on the hit line exactly at its scheduled beat', () => {
    expect(pianoNoteOffsetPx(4, 4)).toBe(0);
    expect(pianoNoteOffsetPx(4, 3)).toBe(72);
    expect(pianoNoteOffsetPx(4, 5)).toBe(-72);
    expect(isPianoNoteAtHitLine(0)).toBe(true);
    expect(isPianoNoteAtHitLine(1)).toBe(true);
    expect(isPianoNoteAtHitLine(1.01)).toBe(false);
    expect(hasPianoNoteReachedHitLine(1.01)).toBe(false);
    expect(hasPianoNoteReachedHitLine(1)).toBe(true);
    expect(hasPianoNoteReachedHitLine(-72)).toBe(true);
  });
  it('converts varied rhythmic values to exact audio durations', () => {
    expect(PIANO_EXERCISES[0].notes.map((note) => note.duration)).toEqual([.5, .5, 1, 1.5, .5, 2, 1, .5]);
    expect(PIANO_EXERCISES[0].notes.map((note) => note.beat)).toEqual([0, .5, 1, 2, 3.5, 4, 6, 7]);
    expect([.5, 1, 1.5, 2].map((duration) => pianoNoteDurationSeconds(duration, 1000))).toEqual([.5, 1, 1.5, 2]);
    expect(PIANO_EXERCISES[0].notes.map((note) => pianoNotePlaybackTiming(note, 1250))).toEqual([
      { startMs: 0, durationSeconds: .625 },
      { startMs: 625, durationSeconds: .625 },
      { startMs: 1250, durationSeconds: 1.25 },
      { startMs: 2500, durationSeconds: 1.875 },
      { startMs: 4375, durationSeconds: .625 },
      { startMs: 5000, durationSeconds: 2.5 },
      { startMs: 7500, durationSeconds: 1.25 },
      { startMs: 8750, durationSeconds: .625 },
    ]);
  });
  it('computes an actionable score', () => {
    expect(pianoScore(8, 2, [10, 100, 400])).toMatchObject({ correct: 8, missed: 2, averageDelay: 170, rhythmAccuracy: 67, global: 76 });
    expect(pianoScore(1, 0, [250], 200).rhythmAccuracy).toBe(0);
  });
  it('accepts a note only when its pitch and yellow-line timing match', () => {
    expect(isPianoHit(60, 60, -300)).toBe(true);
    expect(isPianoHit(60, 60, 300)).toBe(true);
    expect(isPianoHit(60, 60, 301)).toBe(false);
    expect(isPianoHit(60, 62, 0)).toBe(false);
  });
  it('classifies correct, mistimed and wrong piano attempts', () => {
    expect(classifyPianoAttempt(60, 60, -PIANO_CORRECT_TOLERANCE_PX)).toBe('correct');
    expect(classifyPianoAttempt(60, 60, PIANO_CORRECT_TOLERANCE_PX + .01)).toBe('timing');
    expect(classifyPianoAttempt(60, 60, -PIANO_TIMING_TOLERANCE_PX)).toBe('timing');
    expect(classifyPianoAttempt(60, 60, PIANO_TIMING_TOLERANCE_PX + .01)).toBe('wrong');
    expect(classifyPianoAttempt(60, 62, 0)).toBe('wrong');
  });
  it('shifts the timeline by the exact paused duration', () => {
    expect(resumeTimeline(1_000, 2_500, 4_000)).toBe(2_500);
  });
});
