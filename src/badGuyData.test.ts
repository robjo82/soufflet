import { describe, expect, it } from 'vitest';
import { BAD_GUY_CHORD_PROGRESSION, BAD_GUY_NOTES } from './badGuyData';
import {
  PIANO_EXERCISES,
  PIANO_SONGS,
  pianoChordExerciseForSong,
  pianoExerciseEndBeat,
  pianoExerciseMeasureCount,
  pianoHandChoicesForMode,
  pianoNotesForHand,
  pianoPracticeSections,
} from './pianoData';

describe('bad guy', () => {
  it('adds the supplied complete 92-measure arrangement', () => {
    const arrangements = PIANO_EXERCISES.filter((exercise) => exercise.title === 'bad guy');
    expect(arrangements).toHaveLength(1);
    const complete = arrangements[0];

    expect(complete).toMatchObject({
      id: 'bad-guy-complete-61',
      artist: 'Billie Eilish',
      bpm: 130,
      hand: 'both',
      beatsPerMeasure: 4,
      level: 'Modéré',
    });
    expect(complete.notes).toBe(BAD_GUY_NOTES);
    expect(complete.lyrics).toBeUndefined();
    expect(pianoExerciseEndBeat(complete.notes)).toBe(368);
    expect(pianoExerciseMeasureCount(complete)).toBe(92);
    expect(pianoNotesForHand(complete.notes, 'right').length).toBeGreaterThan(0);
    expect(pianoNotesForHand(complete.notes, 'left').length).toBeGreaterThan(0);
    expect(Math.min(...complete.notes.map((note) => note.midi))).toBeGreaterThanOrEqual(36);
    expect(Math.max(...complete.notes.map((note) => note.midi))).toBeLessThanOrEqual(96);
    expect(complete.notes.every((note) => Number.isInteger(note.finger) && note.finger! >= 1 && note.finger! <= 5)).toBe(true);
    expect(new Set(complete.notes.map((note) => note.duration))).toEqual(new Set([.25, .5, .75, .8, 1, 1.5, 2, 8, 4]));
  });

  it('keeps the score form, its rests and its final chord intact', () => {
    const rightHand = BAD_GUY_NOTES.filter((note) => note.hand === 'right');
    const leftHand = BAD_GUY_NOTES.filter((note) => note.hand === 'left');

    expect(rightHand.every((note) => note.beat >= 8)).toBe(true);
    expect(rightHand.some((note) => note.beat >= 276 && note.beat < 340 && note.duration === .5)).toBe(true);
    expect(rightHand.filter((note) => note.beat >= 340 && note.beat < 367)).toHaveLength(0);
    expect(rightHand.filter((note) => note.beat === 367).map((note) => note.midi)).toEqual([58, 62, 67]);
    expect(leftHand.filter((note) => note.beat === 364).map((note) => note.midi)).toEqual([43, 46, 50, 55]);
  });

  it('offers both play modes and three complete training parts', () => {
    const complete = PIANO_EXERCISES.find((exercise) => exercise.id === 'bad-guy-complete-61')!;
    expect(pianoHandChoicesForMode(complete, 'practice')).toEqual(['left', 'right']);
    expect(pianoHandChoicesForMode(complete, 'maestro')).toEqual(['both']);
    expect(pianoPracticeSections(complete).map((section) => [section.description, section.startBeat, section.endBeat])).toEqual([
      ['Mesures 1 à 31', 0, 124],
      ['Mesures 32 à 61', 124, 244],
      ['Mesures 62 à 92', 244, 368],
    ]);
    expect(PIANO_SONGS.find((song) => song.title === 'bad guy')?.levels.map((level) => level.id)).toEqual(['bad-guy-complete-61']);
  });

  it('provides the five recurring harmonies as a dedicated chord exercise', () => {
    const exercise = pianoChordExerciseForSong('bad guy', 'Billie Eilish')!;
    expect(exercise).toMatchObject({ id: 'bad-guy-chords', progression: BAD_GUY_CHORD_PROGRESSION });
    expect(exercise.progression).toHaveLength(26);
    expect(new Set(exercise.progression.map((step) => step.name))).toEqual(new Set([
      'Sol mineur',
      'Mi♭ majeur',
      'Ré majeur',
      'Si♭ majeur',
      'Do mineur',
    ]));
    expect(exercise.progression.at(-1)).toMatchObject({ beat: 364, name: 'Sol mineur' });
    expect(exercise.progression.every((step) => step.midis.length === step.fingers.length)).toBe(true);
  });
});
