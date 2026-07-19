import { describe, expect, it } from 'vitest';
import { classifyPianoAttempt, groupPianoExercises, hasPianoNoteReachedHitLine, isPianoHit, isPianoNoteAtHitLine, isPianoSessionCounted, PIANO_CHORD_EXERCISES, PIANO_CORRECT_TOLERANCE_PX, PIANO_EXERCISES, PIANO_SONGS, PIANO_TIMING_TOLERANCE_PX, pianoChordExerciseForSong, pianoExerciseEndBeat, pianoKeyGeometry, pianoNoteDurationSeconds, pianoNoteOffsetPx, pianoNotePlaybackTiming, pianoNotesForHand, pianoNotesForMode, pianoRange, pianoScore, pianoSessionCounts, resumeTimeline } from './pianoData';

describe('piano V1', () => {
  it('ships right-hand pieces and a first two-hand piece', () => {
    expect(PIANO_EXERCISES.slice(0, 4).map((item) => item.notes.length)).toEqual([8, 14, 24, 18]);
    expect(PIANO_EXERCISES.filter((item) => item.hand === 'both')).toHaveLength(3);
    expect(PIANO_EXERCISES.filter((item) => item.hand !== 'both').every((item) => new Set(item.notes.map((note) => note.beat)).size === item.notes.length)).toBe(true);
  });
  it('offers the supplied My Way score at three progressive levels', () => {
    const arrangements = PIANO_EXERCISES.filter((item) => item.title === 'My Way');
    expect(arrangements).toHaveLength(3);
    expect(arrangements.map((item) => item.level)).toEqual(['Très simple', 'Simple', 'Modéré']);
    expect(arrangements.map((item) => item.artist)).toEqual(['Frank Sinatra', 'Frank Sinatra', 'Frank Sinatra']);
    expect(arrangements.map((item) => item.notes.length)).toEqual([74, 200, 424]);
    expect(arrangements[2]).toMatchObject({ hand: 'both', bpm: 72 });
    expect(arrangements[2].notes.some((note) => note.midi < 60)).toBe(true);
    expect(new Set(arrangements[2].notes.map((note) => note.beat)).size).toBeLessThan(arrangements[2].notes.length);
    expect(pianoExerciseEndBeat(arrangements[0].notes)).toBe(216);
    expect(pianoExerciseEndBeat(arrangements[1].notes)).toBe(216);
    expect(pianoExerciseEndBeat(arrangements[2].notes)).toBe(216.5);
    expect(arrangements[1].notes.some((note) => note.beat === 108 && note.midi === 60)).toBe(true);
  });
  it('offers Se Canta at three progressive levels', () => {
    const arrangements = PIANO_EXERCISES.filter((item) => item.title === 'Se Canta');
    expect(arrangements).toHaveLength(3);
    expect(arrangements.map((item) => item.level)).toEqual(['Très simple', 'Simple', 'Modéré']);
    expect(arrangements.map((item) => item.artist)).toEqual(['Traditionnel occitan', 'Traditionnel occitan', 'Traditionnel occitan']);
    expect(arrangements.map((item) => item.notes.length)).toEqual([16, 25, 61]);
    expect(arrangements[2]).toMatchObject({ hand: 'both', bpm: 72 });
    expect(pianoNotesForHand(arrangements[2].notes, 'left')).toHaveLength(36);
    expect(pianoNotesForHand(arrangements[2].notes, 'right')).toHaveLength(25);
    expect(pianoExerciseEndBeat(arrangements[2].notes)).toBe(28);
  });
  it('groups arrangements by song before the level choice', () => {
    expect(PIANO_SONGS).toHaveLength(6);
    expect(PIANO_SONGS.find((song) => song.title === 'My Way')?.levels.map((level) => level.id)).toEqual(['my-way-beginner', 'my-way-intermediate', 'my-way-advanced']);
    expect(PIANO_SONGS.find((song) => song.title === 'Se Canta')?.levels).toHaveLength(3);
    expect(groupPianoExercises([PIANO_EXERCISES[0], { ...PIANO_EXERCISES[0], id: 'same-title-other-artist', artist: 'Autre artiste' }])).toHaveLength(2);
  });
  it('provides complete left-hand chord exercises with beginner fingerings', () => {
    const myWay = pianoChordExerciseForSong('My Way', 'Frank Sinatra')!;
    const seCanta = pianoChordExerciseForSong('Se Canta', 'Traditionnel occitan')!;
    expect(PIANO_CHORD_EXERCISES).toHaveLength(2);
    expect(myWay.progression).toHaveLength(54);
    expect(new Set(myWay.progression.map((step) => step.name))).toHaveLength(12);
    expect(myWay.progression.at(-1)).toMatchObject({ beat: 213, name: 'Fa majeur' });
    expect(seCanta.progression).toHaveLength(9);
    expect(seCanta.progression.at(-1)).toMatchObject({ beat: 25, name: 'Do majeur' });
    expect(new Set(seCanta.progression.map((step) => step.name))).toEqual(new Set(['Do majeur', 'Sol majeur', 'Fa majeur']));
    for (const exercise of PIANO_CHORD_EXERCISES) for (const step of exercise.progression) {
      expect(step.fingers).toHaveLength(step.midis.length);
      expect(step.fingers.every((finger) => finger >= 1 && finger <= 5)).toBe(true);
    }
    const songsWithChords = PIANO_EXERCISES.filter((exercise) => exercise.hand === 'both' && [...new Set(exercise.notes.filter((note) => note.hand === 'left').map((note) => note.beat))].some((beat) => exercise.notes.filter((note) => note.hand === 'left' && note.beat === beat).length > 1));
    expect(songsWithChords.map((exercise) => `${exercise.title}\u0000${exercise.artist ?? ''}`)).toEqual(PIANO_CHORD_EXERCISES.map((exercise) => `${exercise.songTitle}\u0000${exercise.artist ?? ''}`));
    for (const chordExercise of PIANO_CHORD_EXERCISES) {
      const arrangement = songsWithChords.find((exercise) => exercise.title === chordExercise.songTitle && exercise.artist === chordExercise.artist)!;
      const leftHandMidis = new Set(arrangement.notes.filter((note) => note.hand === 'left').map((note) => note.midi));
      expect(chordExercise.progression.every((step) => step.midis.every((midi) => leftHandMidis.has(midi)))).toBe(true);
    }
    expect(pianoChordExerciseForSong('Dialogue des deux mains')).toBeUndefined();
  });
  it('separates both-hand arrangements into playable left and right parts', () => {
    const dialogue = PIANO_EXERCISES.find((item) => item.id === 'piano-two-hands')!;
    const myWay = PIANO_EXERCISES.find((item) => item.id === 'my-way-advanced')!;
    expect(pianoNotesForHand(dialogue.notes, 'left')).toHaveLength(9);
    expect(pianoNotesForHand(dialogue.notes, 'right')).toHaveLength(9);
    expect(pianoNotesForHand(myWay.notes, 'left').length).toBeGreaterThan(0);
    expect(pianoNotesForHand(myWay.notes, 'right').length).toBeGreaterThan(0);
    expect(pianoNotesForHand(myWay.notes, 'left').length + pianoNotesForHand(myWay.notes, 'right').length).toBe(myWay.notes.length);
    expect(pianoNotesForHand(myWay.notes, 'both')).toHaveLength(myWay.notes.length);
  });
  it('runs practice in real time with one hand and never counts its score', () => {
    const myWay = PIANO_EXERCISES.find((item) => item.id === 'my-way-advanced')!;
    expect(pianoNotesForMode(myWay, 'practice', 'right')).toEqual(pianoNotesForHand(myWay.notes, 'right'));
    expect(pianoNotesForMode(myWay, 'practice', 'left')).toEqual(pianoNotesForHand(myWay.notes, 'left'));
    expect(pianoNotesForMode(myWay, 'game', 'right')).toHaveLength(myWay.notes.length);
    expect(isPianoSessionCounted('practice')).toBe(false);
    expect(isPianoSessionCounted('learning')).toBe(true);
    expect(isPianoSessionCounted('game')).toBe(true);
    expect(pianoSessionCounts(5, [-301, -300, 0, 300, 301], 300)).toEqual({ correctCount: 3, earlyCount: 1, lateCount: 1 });
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
