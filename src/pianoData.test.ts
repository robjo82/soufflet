import { describe, expect, it } from 'vitest';
import { classifyPianoAttempt, groupPianoExercises, hasPianoNoteReachedHitLine, isPianoHit, isPianoNoteAtHitLine, isPianoSessionCounted, PIANO_CHORD_EXERCISES, PIANO_CORRECT_TOLERANCE_PX, PIANO_EXERCISES, PIANO_SONGS, PIANO_TECHNIQUE_EXERCISES, PIANO_TIMING_TOLERANCE_PX, pianoChordExerciseForSong, pianoExerciseEndBeat, pianoHandChoicesForMode, pianoKeyboardSizeForNotes, pianoKeyGeometry, pianoLyricCueAtBeat, pianoMeasureBeats, pianoNoteDurationSeconds, pianoNoteOffsetPx, pianoNotePlaybackTiming, pianoNotesForHand, pianoNotesForMode, pianoRange, pianoScore, pianoSessionCounts, resumeTimeline } from './pianoData';

describe('piano V1', () => {
  it('keeps Promenade du matin as an exercise and removes the placeholder pieces', () => {
    expect(PIANO_TECHNIQUE_EXERCISES.map((item) => item.title)).toEqual(['Promenade du matin']);
    expect(PIANO_EXERCISES.some((item) => ['Trois petits pas', 'Cinq lumières', 'Dialogue des deux mains'].includes(item.title))).toBe(false);
    expect(PIANO_EXERCISES.filter((item) => item.hand === 'both')).toHaveLength(6);
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
  it('offers the complete supplied Ne me quitte pas form at three progressive levels', () => {
    const arrangements = PIANO_EXERCISES.filter((item) => item.title === 'Ne me quitte pas');
    expect(arrangements).toHaveLength(3);
    expect(arrangements.map((item) => item.level)).toEqual(['Très simple', 'Simple', 'Modéré']);
    expect(arrangements.map((item) => item.artist)).toEqual(['Jacques Brel', 'Jacques Brel', 'Jacques Brel']);
    expect(arrangements.map((item) => item.notes.length)).toEqual([156, 385, 715]);
    expect(arrangements[2]).toMatchObject({ hand: 'both', bpm: 70 });
    expect(pianoNotesForHand(arrangements[2].notes, 'left')).toHaveLength(330);
    expect(pianoNotesForHand(arrangements[2].notes, 'right')).toHaveLength(385);
    expect(arrangements.map((item) => pianoExerciseEndBeat(item.notes))).toEqual([246, 246, 246]);
    expect(arrangements[1].notes.filter((note) => note.midi === 60 && [9, 105, 201].includes(note.beat))).toHaveLength(3);
    expect(arrangements[1].notes.some((note) => note.beat === 55)).toBe(true);
    expect(arrangements[1].notes.some((note) => note.beat === 151)).toBe(true);
    expect(arrangements.every((item) => item.lyrics?.length === 80)).toBe(true);
    const lyrics = arrangements[0].lyrics!;
    expect(lyrics.at(0)).toMatchObject({ beat: 7, text: 'Ne me quitte pas', section: 'Couplet 1' });
    expect(lyrics.at(-1)).toMatchObject({ beat: 243, text: 'Ne me quitte pas', section: 'Couplet 5' });
    expect(lyrics.every((line, index) => index === 0 || line.beat > lyrics[index - 1].beat)).toBe(true);
    expect(pianoLyricCueAtBeat(lyrics, -1)).toEqual({ current: null, next: lyrics[0] });
    expect(pianoLyricCueAtBeat(lyrics, 9)).toEqual({ current: lyrics[1], next: lyrics[2] });
    expect(pianoLyricCueAtBeat(lyrics, 246)).toEqual({ current: lyrics.at(-1), next: null });
  });
  it('offers all four verses of Au clair de la lune at three progressive levels', () => {
    const arrangements = PIANO_EXERCISES.filter((item) => item.title === 'Au clair de la lune');
    expect(arrangements).toHaveLength(3);
    expect(arrangements.map((item) => item.level)).toEqual(['Très simple', 'Simple', 'Modéré']);
    expect(arrangements.map((item) => item.artist)).toEqual(['Traditionnel français', 'Traditionnel français', 'Traditionnel français']);
    expect(arrangements.map((item) => item.notes.length)).toEqual([112, 176, 456]);
    expect(arrangements[2]).toMatchObject({ hand: 'both', bpm: 88 });
    expect(pianoNotesForHand(arrangements[2].notes, 'left')).toHaveLength(280);
    expect(pianoNotesForHand(arrangements[2].notes, 'right')).toHaveLength(176);
    expect(arrangements.map((item) => pianoExerciseEndBeat(item.notes))).toEqual([264, 264, 264]);
    expect(arrangements.every((item) => item.lyrics?.length === 32)).toBe(true);
    expect(arrangements[0].lyrics?.at(0)).toMatchObject({ beat: 8, text: 'Au clair de la lune', section: 'Couplet 1' });
    expect(arrangements[0].lyrics?.at(-1)).toMatchObject({ beat: 256, text: 'Sur eux se ferma', section: 'Couplet 4' });
  });
  it('offers the two supplied Experience scores with both hands and exact measure lengths', () => {
    const arrangements = PIANO_EXERCISES.filter((item) => item.title === 'Experience');
    expect(arrangements).toHaveLength(2);
    expect(arrangements.map((item) => item.artist)).toEqual(['Ludovico Einaudi', 'Ludovico Einaudi']);
    expect(arrangements.map((item) => item.level)).toEqual(['Simple', 'Modéré']);
    expect(arrangements.map((item) => item.bpm)).toEqual([70, 92]);
    expect(arrangements.every((item) => item.hand === 'both' && item.beatsPerMeasure === 4)).toBe(true);
    expect(arrangements.map((item) => item.notes.length)).toEqual([251, 1483]);
    expect(arrangements.map((item) => pianoExerciseEndBeat(item.notes))).toEqual([96, 272]);
    expect(pianoNotesForHand(arrangements[0].notes, 'right')).toHaveLength(160);
    expect(pianoNotesForHand(arrangements[0].notes, 'left')).toHaveLength(91);
    expect(pianoNotesForHand(arrangements[1].notes, 'right')).toHaveLength(951);
    expect(pianoNotesForHand(arrangements[1].notes, 'left')).toHaveLength(532);
    expect(pianoNotesForHand(arrangements[1].notes, 'right').slice(0, 4).map((note) => [note.midi, note.beat, note.duration])).toEqual([[73, 0, 1], [73, 1, 1], [74, 2, 1], [73, 3, 1]]);
    expect(pianoNotesForHand(arrangements[1].notes, 'right').filter((note) => note.beat >= 32 && note.beat < 33).map((note) => note.midi)).toEqual([73, 69, 61, 69]);
    expect(Math.max(...arrangements[1].notes.map((note) => note.midi))).toBe(86);
    expect(Math.min(...arrangements[1].notes.map((note) => note.midi))).toBe(30);
  });
  it('groups arrangements by song before the level choice', () => {
    expect(PIANO_SONGS.map((song) => song.title)).toEqual(['My Way', 'Se Canta', 'Ne me quitte pas', 'Au clair de la lune', 'Experience']);
    expect(PIANO_SONGS.find((song) => song.title === 'My Way')?.levels.map((level) => level.id)).toEqual(['my-way-beginner', 'my-way-intermediate', 'my-way-advanced']);
    expect(PIANO_SONGS.find((song) => song.title === 'Se Canta')?.levels).toHaveLength(3);
    expect(PIANO_SONGS.find((song) => song.title === 'Ne me quitte pas')?.levels).toHaveLength(3);
    expect(PIANO_SONGS.find((song) => song.title === 'Au clair de la lune')?.levels).toHaveLength(3);
    expect(PIANO_SONGS.find((song) => song.title === 'Experience')?.levels).toHaveLength(2);
    expect(groupPianoExercises([PIANO_EXERCISES[0], { ...PIANO_EXERCISES[0], id: 'same-title-other-artist', artist: 'Autre artiste' }])).toHaveLength(2);
  });
  it('provides complete left-hand chord exercises with beginner fingerings', () => {
    const myWay = pianoChordExerciseForSong('My Way', 'Frank Sinatra')!;
    const seCanta = pianoChordExerciseForSong('Se Canta', 'Traditionnel occitan')!;
    const brel = pianoChordExerciseForSong('Ne me quitte pas', 'Jacques Brel')!;
    const auClair = pianoChordExerciseForSong('Au clair de la lune', 'Traditionnel français')!;
    const experience = pianoChordExerciseForSong('Experience', 'Ludovico Einaudi')!;
    expect(PIANO_CHORD_EXERCISES).toHaveLength(5);
    expect(myWay.progression).toHaveLength(54);
    expect(new Set(myWay.progression.map((step) => step.name))).toHaveLength(12);
    expect(myWay.progression.at(-1)).toMatchObject({ beat: 213, name: 'Fa majeur' });
    expect(seCanta.progression).toHaveLength(9);
    expect(seCanta.progression.at(-1)).toMatchObject({ beat: 25, name: 'Do majeur' });
    expect(new Set(seCanta.progression.map((step) => step.name))).toEqual(new Set(['Do majeur', 'Sol majeur', 'Fa majeur']));
    expect(brel.progression).toHaveLength(79);
    expect(brel.progression.at(0)).toMatchObject({ beat: 9, name: 'Do mineur' });
    expect(brel.progression.at(-1)).toMatchObject({ beat: 243, name: 'Do mineur' });
    expect(new Set(brel.progression.map((step) => step.name))).toHaveLength(7);
    expect(auClair.progression).toHaveLength(64);
    expect(auClair.progression.at(0)).toMatchObject({ beat: 8, name: 'Do majeur' });
    expect(auClair.progression.at(-1)).toMatchObject({ beat: 260, name: 'Do majeur' });
    expect(new Set(auClair.progression.map((step) => step.name))).toEqual(new Set(['Do majeur', 'Sol 7', 'Ré mineur']));
    expect(experience.progression).toHaveLength(68);
    expect(experience.progression.at(0)).toMatchObject({ beat: 0, name: 'Fa♯ mineur' });
    expect(experience.progression.at(-1)).toMatchObject({ beat: 268, name: 'Ré majeur' });
    expect(new Set(experience.progression.map((step) => step.name))).toEqual(new Set(['Fa♯ mineur', 'La majeur', 'Do♯ mineur', 'Ré majeur']));
    for (const exercise of PIANO_CHORD_EXERCISES) for (const step of exercise.progression) {
      expect(step.fingers).toHaveLength(step.midis.length);
      expect(step.fingers.every((finger) => finger >= 1 && finger <= 5)).toBe(true);
    }
    const songsWithChords = PIANO_EXERCISES.filter((exercise) => exercise.hand === 'both' && [...new Set(exercise.notes.filter((note) => note.hand === 'left').map((note) => note.beat))].some((beat) => exercise.notes.filter((note) => note.hand === 'left' && note.beat === beat).length > 1));
    expect([...new Set(songsWithChords.map((exercise) => `${exercise.title}\u0000${exercise.artist ?? ''}`))]).toEqual(PIANO_CHORD_EXERCISES.map((exercise) => `${exercise.songTitle}\u0000${exercise.artist ?? ''}`));
    for (const chordExercise of PIANO_CHORD_EXERCISES) {
      const arrangements = songsWithChords.filter((exercise) => exercise.title === chordExercise.songTitle && exercise.artist === chordExercise.artist);
      expect(arrangements.some((arrangement) => {
        const leftHandMidis = new Set(arrangement.notes.filter((note) => note.hand === 'left').map((note) => note.midi));
        return chordExercise.progression.every((step) => step.midis.every((midi) => leftHandMidis.has(midi)));
      })).toBe(true);
    }
    expect(pianoChordExerciseForSong('Dialogue des deux mains')).toBeUndefined();
  });
  it('separates both-hand arrangements into playable left and right parts', () => {
    const myWay = PIANO_EXERCISES.find((item) => item.id === 'my-way-advanced')!;
    expect(pianoNotesForHand(myWay.notes, 'left').length).toBeGreaterThan(0);
    expect(pianoNotesForHand(myWay.notes, 'right').length).toBeGreaterThan(0);
    expect(pianoNotesForHand(myWay.notes, 'left').length + pianoNotesForHand(myWay.notes, 'right').length).toBe(myWay.notes.length);
    expect(pianoNotesForHand(myWay.notes, 'both')).toHaveLength(myWay.notes.length);
  });
  it('runs practice in real time with one hand and never counts its score', () => {
    const myWay = PIANO_EXERCISES.find((item) => item.id === 'my-way-advanced')!;
    expect(pianoHandChoicesForMode(myWay, 'learning')).toEqual(['right', 'left']);
    expect(pianoHandChoicesForMode(myWay, 'practice')).toEqual(['right', 'left']);
    expect(pianoHandChoicesForMode(myWay, 'game')).toEqual(['both']);
    expect(pianoNotesForMode(myWay, 'learning', 'both')).toEqual(pianoNotesForHand(myWay.notes, 'right'));
    expect(pianoNotesForMode(myWay, 'practice', 'right')).toEqual(pianoNotesForHand(myWay.notes, 'right'));
    expect(pianoNotesForMode(myWay, 'practice', 'left')).toEqual(pianoNotesForHand(myWay.notes, 'left'));
    expect(pianoNotesForMode(myWay, 'game', 'right')).toHaveLength(myWay.notes.length);
    expect(isPianoSessionCounted('practice')).toBe(false);
    expect(isPianoSessionCounted('learning')).toBe(true);
    expect(isPianoSessionCounted('game')).toBe(true);
    expect(pianoSessionCounts(5, [-301, -300, 0, 300, 301], 300)).toEqual({ correctCount: 3, earlyCount: 1, lateCount: 1 });
  });
  it('adds a playable finger number to every falling note', () => {
    expect(PIANO_EXERCISES.every((exercise) => exercise.notes.every((note) => Number.isInteger(note.finger) && note.finger! >= 1 && note.finger! <= 5))).toBe(true);
    const seCanta = PIANO_EXERCISES.find((item) => item.id === 'se-canta-intermediate')!;
    expect(seCanta.notes.slice(0, 3).map((note) => [note.midi, note.finger])).toEqual([[67, 5], [72, 1], [72, 1]]);
    const myWay = PIANO_EXERCISES.find((item) => item.id === 'my-way-advanced')!;
    expect(myWay.notes.filter((note) => note.hand === 'left' && note.beat === 3).map((note) => note.finger)).toEqual([5, 3, 1]);
  });
  it('centers compact keyboards around middle C', () => {
    expect(pianoRange(25)).toContain(60);
    expect(pianoRange(88)).toEqual(expect.arrayContaining([21, 108]));
  });
  it('requires a keyboard that covers every selected note', () => {
    const simplified = PIANO_EXERCISES.find((item) => item.id === 'experience-simplified')!;
    const complete = PIANO_EXERCISES.find((item) => item.id === 'experience-complete')!;
    expect(pianoKeyboardSizeForNotes(simplified.notes)).toBe(49);
    expect(pianoKeyboardSizeForNotes(pianoNotesForHand(complete.notes, 'right'))).toBe(61);
    expect(pianoKeyboardSizeForNotes(pianoNotesForHand(complete.notes, 'left'))).toBe(76);
    expect(pianoKeyboardSizeForNotes(complete.notes)).toBe(76);
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
  it('places measure lines on the musical grid, including pickup offsets', () => {
    expect(pianoMeasureBeats(13, 4)).toEqual([0, 4, 8, 12]);
    expect(pianoMeasureBeats(14, 3, 1)).toEqual([1, 4, 7, 10, 13]);
    expect(pianoMeasureBeats(14, 0)).toEqual([]);
    expect(PIANO_EXERCISES.filter((item) => item.title === 'My Way').every((item) => item.beatsPerMeasure === 4 && item.measureStartBeat === 1)).toBe(true);
    expect(PIANO_EXERCISES.filter((item) => ['Se Canta', 'Ne me quitte pas'].includes(item.title)).every((item) => item.beatsPerMeasure === 3)).toBe(true);
  });
  it('converts varied rhythmic values to exact audio durations', () => {
    const promenade = PIANO_TECHNIQUE_EXERCISES[0];
    expect([...new Set(promenade.notes.map((note) => note.duration))]).toEqual([1, .5, 2]);
    expect(promenade.notes.slice(0, 6).map((note) => note.beat)).toEqual([0, 1, 2, 2.5, 3, 4]);
    expect([.5, 1, 1.5, 2].map((duration) => pianoNoteDurationSeconds(duration, 1000))).toEqual([.5, 1, 1.5, 2]);
    expect(promenade.notes.slice(0, 3).map((note) => pianoNotePlaybackTiming(note, 1250))).toEqual([
      { startMs: 0, durationSeconds: 1.25 },
      { startMs: 1250, durationSeconds: 1.25 },
      { startMs: 2500, durationSeconds: .625 },
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
