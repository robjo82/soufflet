import { describe, expect, it } from 'vitest';
import { classifyPianoAttempt, groupPianoExercises, hasPianoNoteReachedHitLine, isPianoHit, isPianoNoteAtHitLine, isPianoSessionCounted, PIANO_CHORD_EXERCISES, PIANO_CORRECT_TOLERANCE_PX, PIANO_EXERCISES, PIANO_SONGS, PIANO_TECHNIQUE_EXERCISES, PIANO_TIMING_TOLERANCE_PX, pianoBeatToMs, pianoChordExerciseForSong, pianoExerciseEndBeat, pianoExerciseMeasureCount, pianoHandChoicesForMode, pianoKeyboardSizeForNotes, pianoKeyGeometry, pianoLyricCueAtBeat, pianoMeasureBeats, pianoMsToBeat, pianoNoteDurationSeconds, pianoNoteOffsetPx, pianoNotePlaybackTiming, pianoNotePlaybackTimingWithTempo, pianoNotesForHand, pianoNotesForMode, pianoNotesForSection, pianoPracticeSections, pianoRange, pianoScore, pianoSessionCounts, pianoShowsFingerings, pianoTempoAtBeat, resumeTimeline } from './pianoData';

describe('piano V1', () => {
  it('keeps Promenade du matin as an exercise and removes the placeholder pieces', () => {
    expect(PIANO_TECHNIQUE_EXERCISES.map((item) => item.title)).toEqual(['Promenade du matin']);
    expect(PIANO_EXERCISES.some((item) => ['Trois petits pas', 'Cinq lumières', 'Dialogue des deux mains'].includes(item.title))).toBe(false);
    expect(PIANO_EXERCISES.filter((item) => item.hand === 'both')).toHaveLength(13);
    expect(PIANO_EXERCISES.filter((item) => item.kind === 'song').every((item) => !item.id.includes('beginner') && !item.id.includes('simplified') && !item.arrangement?.includes('simplifiée'))).toBe(true);
    expect(PIANO_EXERCISES.filter((item) => item.hand !== 'both').every((item) => new Set(item.notes.map((note) => note.beat)).size === item.notes.length)).toBe(true);
  });
  it('offers the complete supplied My Way score with synchronized lyrics', () => {
    const arrangements = PIANO_EXERCISES.filter((item) => item.title === 'My Way');
    expect(arrangements).toHaveLength(1);
    const complete = arrangements[0];
    expect(complete).toMatchObject({ artist: 'Frank Sinatra', level: 'Modéré', hand: 'both', bpm: 72 });
    expect(complete.notes).toHaveLength(424);
    expect(complete.notes.some((note) => note.midi < 60)).toBe(true);
    expect(new Set(complete.notes.map((note) => note.beat)).size).toBeLessThan(complete.notes.length);
    expect(pianoExerciseEndBeat(complete.notes)).toBe(216.5);
    expect(pianoNotesForHand(complete.notes, 'right').some((note) => note.beat === 108 && note.midi === 60)).toBe(true);
    expect(complete.lyrics).toHaveLength(28);
    expect(complete.lyrics?.at(0)).toMatchObject({ beat: 0, section: 'Couplet 1' });
    expect(complete.lyrics?.at(-1)).toMatchObject({ beat: 213, section: 'Finale' });
    expect(complete.lyrics?.every((line, index) => index === 0 || line.beat > complete.lyrics![index - 1].beat)).toBe(true);
  });
  it('offers the complete Se Canta arrangement with the classic Occitan lyrics', () => {
    const arrangements = PIANO_EXERCISES.filter((item) => item.title === 'Se Canta');
    expect(arrangements).toHaveLength(1);
    const complete = arrangements[0];
    expect(complete).toMatchObject({ artist: 'Traditionnel occitan', level: 'Modéré', hand: 'both', bpm: 72 });
    expect(complete.notes).toHaveLength(61);
    expect(pianoNotesForHand(complete.notes, 'left')).toHaveLength(36);
    expect(pianoNotesForHand(complete.notes, 'right')).toHaveLength(25);
    expect(pianoExerciseEndBeat(complete.notes)).toBe(28);
    expect(complete.lyrics).toHaveLength(8);
    expect(complete.lyrics?.at(0)).toMatchObject({ beat: 0, text: 'Se canta, que cante', section: 'Couplet' });
    expect(complete.lyrics?.at(-1)).toMatchObject({ beat: 22, text: 'Mas amors ont son', section: 'Refrain' });
  });
  it('offers the complete traditional Brise-pied in every piano mode', () => {
    const arrangements = PIANO_EXERCISES.filter((item) => item.title === 'Le Brise-pied aveyronnais');
    const [advanced] = arrangements;
    expect(arrangements).toHaveLength(1);
    expect(advanced).toMatchObject({ level: 'Modéré', artist: 'Traditionnel aveyronnais', bpm: 104 });
    expect(advanced.notes).toHaveLength(246);
    expect(pianoExerciseEndBeat(advanced.notes)).toBe(64);
    expect(pianoNotesForHand(advanced.notes, 'right').slice(0, 8).map((note) => [note.midi, note.beat, note.duration, note.finger])).toEqual([
      [67, 0, .5, 1], [76, .5, .5, 5], [76, 1, .5, 5], [76, 1.5, .5, 5],
      [67, 2, .5, 1], [76, 2.5, .5, 5], [76, 3, .5, 5], [76, 3.5, .5, 5],
    ]);
    expect(pianoNotesForHand(advanced.notes, 'right')).toHaveLength(106);
    expect(pianoNotesForHand(advanced.notes, 'left')).toHaveLength(140);
    expect(pianoHandChoicesForMode(advanced, 'practice')).toEqual(['left', 'right']);
    expect(pianoHandChoicesForMode(advanced, 'maestro')).toEqual(['both']);
    expect(pianoNotesForMode(advanced, 'practice', 'left')).toHaveLength(140);
    expect(pianoNotesForMode(advanced, 'maestro', 'right')).toHaveLength(246);
  });
  it('transcribes the supplied Le 31 du mois d’Août score in 6/8 for a 61-key piano', () => {
    const arrangements = PIANO_EXERCISES.filter((item) => item.title === 'Le 31 du mois d’Août');
    expect(arrangements).toHaveLength(1);
    const complete = arrangements[0];
    expect(complete).toMatchObject({ artist: 'Traditionnel marin', level: 'Modéré', hand: 'both', bpm: 100, beatsPerMeasure: 2, measureStartBeat: 1 });
    expect(complete.notes).toHaveLength(215);
    const melody = pianoNotesForHand(complete.notes, 'right');
    expect(melody).toHaveLength(98);
    expect(pianoNotesForHand(complete.notes, 'left')).toHaveLength(117);
    expect(pianoExerciseEndBeat(complete.notes)).toBe(48);
    expect(pianoExerciseMeasureCount(complete)).toBe(24);
    expect([Math.min(...complete.notes.map((note) => note.midi)), Math.max(...complete.notes.map((note) => note.midi))]).toEqual([36, 72]);
    expect(complete.notes.every((note) => pianoRange(61).includes(note.midi))).toBe(true);
    expect(melody.slice(0, 8).map((note) => [note.midi, note.beat, note.duration, note.finger])).toEqual([
      [62, 0, 1 / 3, 2], [62, 1 / 3, 1 / 3, 2], [62, 2 / 3, 1 / 3, 2], [67, 1, 2 / 3, 1],
      [71, 2, 1 / 3, 3], [71, 2 + 1 / 3, 1 / 3, 3], [71, 2 + 2 / 3, 1 / 3, 3], [67, 3, 2 / 3, 1],
    ]);
    expect(melody.filter((note) => note.midi === 72).map((note) => note.beat)).toEqual([17, 25, 37]);
    expect(complete.lyrics).toHaveLength(10);
    expect(complete.lyrics?.at(0)).toMatchObject({ beat: 0, text: 'Le trente et un du mois d’Août', section: 'Couplet' });
    expect(complete.lyrics?.find((line) => line.beat === 28)).toMatchObject({ text: 'Buvons un coup, buvons en deux', section: 'Refrain' });
    expect(pianoHandChoicesForMode(complete, 'practice')).toEqual(['left', 'right']);
    expect(pianoHandChoicesForMode(complete, 'maestro')).toEqual(['both']);
  });
  it('adds the complete Amsterdam form with four verses and its coda on 61 keys', () => {
    const arrangements = PIANO_EXERCISES.filter((item) => item.title === 'Amsterdam');
    expect(arrangements).toHaveLength(1);
    const complete = arrangements[0];
    expect(complete).toMatchObject({ artist: 'Jacques Brel', level: 'Modéré', hand: 'both', bpm: 140, beatsPerMeasure: 6, measureStartBeat: 6 });
    expect(complete.notes).toHaveLength(1220);
    const melody = pianoNotesForHand(complete.notes, 'right');
    expect(melody).toHaveLength(390);
    expect(pianoNotesForHand(complete.notes, 'left')).toHaveLength(830);
    expect(pianoExerciseEndBeat(complete.notes)).toBe(420);
    expect(pianoExerciseMeasureCount(complete)).toBe(69);
    expect([Math.min(...complete.notes.map((note) => note.midi)), Math.max(...complete.notes.map((note) => note.midi))]).toEqual([40, 77]);
    expect(complete.notes.every((note) => pianoRange(61).includes(note.midi))).toBe(true);
    expect(melody.slice(0, 8).map((note) => [note.midi, note.beat, note.duration])).toEqual([
      [64, 11, .5], [64, 11.5, .5], [69, 12, 1], [69, 13, 1],
      [71, 14, 1], [72, 15, 2], [74, 17, .5], [72, 17.5, .5],
    ]);
    expect(complete.lyrics).toHaveLength(65);
    expect(complete.lyrics?.at(0)).toMatchObject({ beat: 11, text: 'Dans le port d’Amsterdam', section: 'Couplet 1' });
    expect(complete.lyrics?.at(16)).toMatchObject({ beat: 107, text: 'Dans le port d’Amsterdam', section: 'Couplet 2' });
    expect(complete.lyrics?.at(-1)).toMatchObject({ beat: 395, text: 'Dans le port d’Amsterdam', section: 'Finale' });
    expect(pianoHandChoicesForMode(complete, 'practice')).toEqual(['left', 'right']);
    expect(pianoHandChoicesForMode(complete, 'maestro')).toEqual(['both']);
  });
  it('adds both supplied Comptine d’un autre été arrangements on 61 keys', () => {
    const arrangements = PIANO_EXERCISES.filter((item) => item.title === 'Comptine d’un autre été');
    const original = arrangements.find((item) => item.id === 'comptine-autre-ete-original-61')!;
    const concert = arrangements.find((item) => item.id === 'comptine-autre-ete-kyle-landry-61')!;
    expect(arrangements).toHaveLength(2);
    expect(arrangements.map((item) => item.artist)).toEqual(['Yann Tiersen', 'Yann Tiersen']);
    expect(arrangements.map((item) => item.level)).toEqual(['Simple', 'Modéré']);
    expect(arrangements.every((item) => item.hand === 'both' && item.beatsPerMeasure === 4)).toBe(true);
    expect(original).toMatchObject({ bpm: 95, arrangement: 'Version L’après-midi · 45 mesures avec reprises · 61 touches' });
    expect(pianoExerciseEndBeat(original.notes)).toBe(212);
    expect(pianoExerciseMeasureCount(original)).toBe(53);
    expect(original.notes).toHaveLength(932);
    expect(pianoNotesForHand(original.notes, 'left')).toHaveLength(424);
    expect(pianoNotesForHand(original.notes, 'right')).toHaveLength(508);
    expect(concert).toMatchObject({ bpm: 90, arrangement: 'Arrangement concert 2021 · Kyle Landry · 61 touches' });
    expect(pianoExerciseEndBeat(concert.notes)).toBe(464);
    expect(pianoExerciseMeasureCount(concert)).toBe(116);
    expect(concert.notes).toHaveLength(2560);
    expect(concert.tempoChanges).toEqual([
      { beat: 236, bpm: 120, label: 'Excited' },
      { beat: 296, bpm: 110, label: 'Un peu plus lent' },
      { beat: 396, bpm: 90, label: 'Tempo primo' },
    ]);
    for (const arrangement of arrangements) {
      expect(pianoNotesForHand(arrangement.notes, 'left').length).toBeGreaterThan(0);
      expect(pianoNotesForHand(arrangement.notes, 'right').length).toBeGreaterThan(0);
      expect(arrangement.notes.every((note) => pianoRange(61).includes(note.midi))).toBe(true);
      expect(pianoKeyboardSizeForNotes(arrangement.notes)).toBe(61);
      expect(pianoHandChoicesForMode(arrangement, 'practice')).toEqual(['left', 'right']);
      expect(pianoHandChoicesForMode(arrangement, 'maestro')).toEqual(['both']);
      expect(pianoPracticeSections(arrangement)).toHaveLength(3);
    }
  });
  it('offers only the complete supplied Ne me quitte pas form', () => {
    const arrangements = PIANO_EXERCISES.filter((item) => item.title === 'Ne me quitte pas');
    expect(arrangements).toHaveLength(1);
    const complete = arrangements[0];
    expect(complete).toMatchObject({ artist: 'Jacques Brel', level: 'Modéré', hand: 'both', bpm: 70 });
    expect(complete.notes).toHaveLength(715);
    expect(pianoNotesForHand(complete.notes, 'left')).toHaveLength(330);
    const completeMelody = pianoNotesForHand(complete.notes, 'right');
    expect(completeMelody).toHaveLength(385);
    expect(pianoExerciseEndBeat(complete.notes)).toBe(246);
    expect(completeMelody.filter((note) => note.midi === 60 && [9, 105, 201].includes(note.beat))).toHaveLength(3);
    expect(completeMelody.some((note) => note.beat === 55)).toBe(true);
    expect(completeMelody.some((note) => note.beat === 151)).toBe(true);
    expect(complete.lyrics).toHaveLength(80);
    const lyrics = complete.lyrics!;
    expect(lyrics.at(0)).toMatchObject({ beat: 7, text: 'Ne me quitte pas', section: 'Couplet 1' });
    expect(lyrics.at(-1)).toMatchObject({ beat: 243, text: 'Ne me quitte pas', section: 'Couplet 5' });
    expect(lyrics.every((line, index) => index === 0 || line.beat > lyrics[index - 1].beat)).toBe(true);
    expect(pianoLyricCueAtBeat(lyrics, -1)).toEqual({ current: null, next: lyrics[0], note: null });
    expect(pianoLyricCueAtBeat(lyrics, 9)).toMatchObject({ current: lyrics[1], next: lyrics[2], note: { beat: 9, duration: 1, startWord: 0, endWord: 0, measure: 4 } });
    expect(pianoLyricCueAtBeat(lyrics, 246)).toMatchObject({ current: lyrics.at(-1), next: null, note: { beat: 245.5, measure: 82 } });
  });
  it('offers only the corrected complete version of all four Au clair de la lune verses', () => {
    const arrangements = PIANO_EXERCISES.filter((item) => item.title === 'Au clair de la lune');
    expect(arrangements).toHaveLength(1);
    const complete = arrangements[0];
    expect(complete).toMatchObject({ artist: 'Traditionnel français', level: 'Modéré', hand: 'both', bpm: 88 });
    expect(complete.notes).toHaveLength(456);
    expect(pianoNotesForHand(complete.notes, 'left')).toHaveLength(280);
    const melody = pianoNotesForHand(complete.notes, 'right');
    expect(melody).toHaveLength(176);
    expect(pianoExerciseEndBeat(complete.notes)).toBe(264);
    expect(melody.filter((note) => [44, 46, 108, 110, 172, 174, 236, 238].includes(note.beat)).map((note) => note.midi)).toEqual(Array(8).fill(57));
    expect(complete.lyrics).toHaveLength(32);
    expect(complete.lyrics?.at(0)).toMatchObject({ beat: 8, text: 'Au clair de la lune', section: 'Couplet 1' });
    expect(complete.lyrics?.at(-1)).toMatchObject({ beat: 256, text: 'Sur eux se ferma', section: 'Couplet 4' });
  });
  it('synchronizes every sung melody note with words and its exact measure', () => {
    const songsWithLyrics = PIANO_EXERCISES.filter((exercise) => exercise.lyrics?.length);
    expect(songsWithLyrics.map((exercise) => exercise.title)).toEqual(['My Way', 'Se Canta', 'Ne me quitte pas', 'Au clair de la lune', 'Le 31 du mois d’Août', 'Amsterdam']);
    const expectedCueCounts: Record<string, number> = { 'My Way': 200, 'Se Canta': 25, 'Ne me quitte pas': 385, 'Au clair de la lune': 176, 'Le 31 du mois d’Août': 98, Amsterdam: 390 };
    for (const exercise of songsWithLyrics) {
      const melody = pianoNotesForHand(exercise.notes, 'right');
      const noteCues = exercise.lyrics!.flatMap((line) => line.noteCues);
      expect(noteCues).toHaveLength(expectedCueCounts[exercise.title]);
      expect(noteCues.map(({ beat, duration }) => [beat, duration])).toEqual(melody.map(({ beat, duration }) => [beat, duration]));
      expect(exercise.lyrics!.every((line, index) => line.words.join(' ') === line.text && line.endBeat === (exercise.lyrics![index + 1]?.beat ?? pianoExerciseEndBeat(melody)))).toBe(true);
      expect(noteCues.every((cue) => cue.measure === (cue.beat < (exercise.measureStartBeat ?? 0) ? 0 : Math.floor((cue.beat - (exercise.measureStartBeat ?? 0)) / exercise.beatsPerMeasure) + 1))).toBe(true);
      expect(noteCues.every((cue) => cue.startWord >= 0 && cue.endWord >= cue.startWord)).toBe(true);
    }
    const myWay = songsWithLyrics.find((exercise) => exercise.title === 'My Way')!;
    expect(myWay.lyrics![0].noteCues.map((cue) => [cue.beat, cue.startWord, cue.endWord, cue.measure])).toEqual([
      [0, 0, 0, 0], [1, 1, 1, 1], [3.5, 2, 2, 1], [4, 3, 3, 1], [4.5, 4, 4, 1], [5, 5, 5, 2], [7.5, 5, 5, 2], [8, 5, 5, 2], [8.5, 5, 5, 2],
    ]);
    const auClair = songsWithLyrics.find((exercise) => exercise.title === 'Au clair de la lune')!;
    expect(auClair.lyrics![0].noteCues.map((cue) => [cue.beat, cue.startWord, cue.endWord, cue.measure])).toEqual([
      [8, 0, 0, 3], [9, 1, 1, 3], [10, 2, 2, 3], [11, 3, 3, 3], [12, 4, 4, 4], [14, 4, 4, 4],
    ]);
  });
  it('offers the two complete Experience variants without a simplified arrangement', () => {
    const arrangements = PIANO_EXERCISES.filter((item) => item.title === 'Experience');
    const adapted = arrangements.find((item) => item.id === 'experience-complete-61')!;
    const complete = arrangements.find((item) => item.id === 'experience-complete')!;
    expect(arrangements).toHaveLength(2);
    expect(arrangements.map((item) => item.artist)).toEqual(['Ludovico Einaudi', 'Ludovico Einaudi']);
    expect(arrangements.map((item) => item.level)).toEqual(['Modéré', 'Modéré']);
    expect(arrangements.map((item) => item.bpm)).toEqual([92, 92]);
    expect(arrangements.every((item) => item.hand === 'both' && item.beatsPerMeasure === 4)).toBe(true);
    expect(arrangements.map((item) => item.notes.length)).toEqual([1483, 1483]);
    expect(arrangements.map((item) => pianoExerciseEndBeat(item.notes))).toEqual([272, 272]);
    expect(pianoNotesForHand(complete.notes, 'right')).toHaveLength(951);
    expect(pianoNotesForHand(complete.notes, 'left')).toHaveLength(532);
    expect(pianoNotesForHand(complete.notes, 'right').slice(0, 4).map((note) => [note.midi, note.beat, note.duration, note.finger])).toEqual([[73, 0, 1, 3], [73, 1, 1, 3], [74, 2, 1, 4], [73, 3, 1, 3]]);
    expect(pianoNotesForHand(complete.notes, 'right').filter((note) => note.beat >= 32 && note.beat < 33).map((note) => note.midi)).toEqual([73, 69, 61, 69]);
    expect(pianoNotesForHand(complete.notes, 'right').filter((note) => note.beat >= 32 && note.beat < 33).map((note) => note.finger)).toEqual([4, 2, 1, 2]);
    expect(pianoNotesForHand(complete.notes, 'right').filter((note) => note.beat >= 64 && note.beat < 65).map((note) => [note.midi, note.finger])).toEqual([[69, 2], [61, 1], [73, 4], [61, 1]]);
    expect(pianoNotesForHand(complete.notes, 'left').slice(0, 4).map((note) => [note.midi, note.finger])).toEqual([[54, 5], [61, 2], [66, 1], [61, 2]]);
    expect(Math.max(...complete.notes.map((note) => note.midi))).toBe(86);
    expect(Math.min(...complete.notes.map((note) => note.midi))).toBe(30);
    expect(Math.min(...adapted.notes.map((note) => note.midi))).toBeGreaterThanOrEqual(36);
    expect(Math.max(...adapted.notes.map((note) => note.midi))).toBeLessThanOrEqual(96);
    expect(adapted.notes.every((note, index) => note.beat === complete.notes[index].beat && note.duration === complete.notes[index].duration && note.hand === complete.notes[index].hand && note.finger === complete.notes[index].finger && (note.midi - complete.notes[index].midi) % 12 === 0)).toBe(true);
  });
  it("offers the complete 100-measure Mia & Sebastian's Theme adaptations", () => {
    const arrangements = PIANO_EXERCISES.filter((item) => item.title === "Mia & Sebastian's Theme");
    expect(arrangements).toHaveLength(2);
    const adapted = arrangements.find((item) => item.id === 'mia-sebastians-theme-complete-61')!;
    const complete = arrangements.find((item) => item.id === 'mia-sebastians-theme-complete')!;
    expect(arrangements.every((item) => item.artist === 'Justin Hurwitz' && item.level === 'Modéré' && item.hand === 'both' && item.bpm === 88 && item.beatsPerMeasure === 3)).toBe(true);
    expect(arrangements.map((item) => item.notes.length)).toEqual([1520, 1520]);
    expect(pianoNotesForHand(complete.notes, 'right')).toHaveLength(732);
    expect(pianoNotesForHand(complete.notes, 'left')).toHaveLength(788);
    expect(arrangements.map((item) => pianoExerciseEndBeat(item.notes))).toEqual([300, 300]);
    expect(arrangements.map(pianoExerciseMeasureCount)).toEqual([100, 100]);
    expect([Math.min(...complete.notes.map((note) => note.midi)), Math.max(...complete.notes.map((note) => note.midi))]).toEqual([23, 97]);
    expect(Math.min(...adapted.notes.map((note) => note.midi))).toBeGreaterThanOrEqual(36);
    expect(Math.max(...adapted.notes.map((note) => note.midi))).toBeLessThanOrEqual(96);
    expect(adapted.notes.every((note, index) => note.beat === complete.notes[index].beat && note.duration === complete.notes[index].duration && note.hand === complete.notes[index].hand && note.finger === complete.notes[index].finger && (note.midi - complete.notes[index].midi) % 12 === 0)).toBe(true);
    expect(new Set(complete.notes.map((note) => note.duration))).toEqual(new Set([.25, 1 / 3, .5, .75, .85, .9, 1, 2, 3]));
  });
  it('groups arrangements by song before the level choice', () => {
    expect(PIANO_SONGS.map((song) => song.title)).toEqual(['My Way', 'Se Canta', 'Ne me quitte pas', 'Au clair de la lune', 'Experience', 'Le Brise-pied aveyronnais', 'Le 31 du mois d’Août', "Mia & Sebastian's Theme", 'Amsterdam', 'Comptine d’un autre été']);
    expect(PIANO_SONGS.find((song) => song.title === 'My Way')?.levels.map((level) => level.id)).toEqual(['my-way-advanced']);
    expect(PIANO_SONGS.find((song) => song.title === 'Se Canta')?.levels).toHaveLength(1);
    expect(PIANO_SONGS.find((song) => song.title === 'Ne me quitte pas')?.levels).toHaveLength(1);
    expect(PIANO_SONGS.find((song) => song.title === 'Au clair de la lune')?.levels).toHaveLength(1);
    expect(PIANO_SONGS.find((song) => song.title === 'Experience')?.levels).toHaveLength(2);
    expect(PIANO_SONGS.find((song) => song.title === 'Le Brise-pied aveyronnais')?.levels).toHaveLength(1);
    expect(PIANO_SONGS.find((song) => song.title === 'Le 31 du mois d’Août')?.levels).toHaveLength(1);
    expect(PIANO_SONGS.find((song) => song.title === "Mia & Sebastian's Theme")?.levels.map((level) => level.id)).toEqual(['mia-sebastians-theme-complete-61', 'mia-sebastians-theme-complete']);
    expect(PIANO_SONGS.find((song) => song.title === 'Amsterdam')?.levels.map((level) => level.id)).toEqual(['amsterdam-complete-61']);
    expect(PIANO_SONGS.find((song) => song.title === 'Comptine d’un autre été')?.levels.map((level) => level.id)).toEqual(['comptine-autre-ete-original-61', 'comptine-autre-ete-kyle-landry-61']);
    expect(groupPianoExercises([PIANO_EXERCISES[0], { ...PIANO_EXERCISES[0], id: 'same-title-other-artist', artist: 'Autre artiste' }])).toHaveLength(2);
  });
  it('provides complete left-hand chord exercises with beginner fingerings', () => {
    const myWay = pianoChordExerciseForSong('My Way', 'Frank Sinatra')!;
    const seCanta = pianoChordExerciseForSong('Se Canta', 'Traditionnel occitan')!;
    const brel = pianoChordExerciseForSong('Ne me quitte pas', 'Jacques Brel')!;
    const auClair = pianoChordExerciseForSong('Au clair de la lune', 'Traditionnel français')!;
    const experience = pianoChordExerciseForSong('Experience', 'Ludovico Einaudi')!;
    const brisePied = pianoChordExerciseForSong('Le Brise-pied aveyronnais', 'Traditionnel aveyronnais')!;
    const le31Aout = pianoChordExerciseForSong('Le 31 du mois d’Août', 'Traditionnel marin')!;
    const miaSebastian = pianoChordExerciseForSong("Mia & Sebastian's Theme", 'Justin Hurwitz')!;
    const amsterdam = pianoChordExerciseForSong('Amsterdam', 'Jacques Brel')!;
    const comptine = pianoChordExerciseForSong('Comptine d’un autre été', 'Yann Tiersen')!;
    expect(PIANO_CHORD_EXERCISES).toHaveLength(10);
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
    expect(brisePied.progression).toHaveLength(16);
    expect(brisePied.progression.at(-1)).toMatchObject({ beat: 60, name: 'Do majeur' });
    expect(new Set(brisePied.progression.map((step) => step.name))).toEqual(new Set(['Do majeur', 'Fa majeur', 'Sol 7']));
    expect(le31Aout.progression).toHaveLength(34);
    expect(le31Aout.progression.at(0)).toMatchObject({ beat: 1, name: 'Sol majeur' });
    expect(le31Aout.progression.at(-1)).toMatchObject({ beat: 47, name: 'Sol majeur' });
    expect(new Set(le31Aout.progression.map((step) => step.name))).toEqual(new Set(['Sol majeur', 'Ré majeur', 'Sol / Si', 'Sol / Ré', 'Do majeur', 'Mi mineur', 'La mineur', 'Ré 7', 'Sol / La']));
    expect(miaSebastian.progression).toHaveLength(100);
    expect(miaSebastian.progression.at(0)).toMatchObject({ beat: 0, name: 'Mi majeur' });
    expect(miaSebastian.progression.at(-1)).toMatchObject({ beat: 297, name: 'Ré♭ majeur' });
    expect(new Set(miaSebastian.progression.map((step) => step.name)).size).toBe(22);
    expect(amsterdam.progression).toHaveLength(77);
    expect(amsterdam.progression.at(0)).toMatchObject({ beat: 6, name: 'La mineur' });
    expect(amsterdam.progression.at(-1)).toMatchObject({ beat: 414, name: 'La mineur' });
    expect(new Set(amsterdam.progression.map((step) => step.name))).toEqual(new Set(['La mineur', 'Mi mineur', 'Fa majeur', 'Mi 7', 'La mineur / Mi', 'Do majeur', 'Sol 7', 'Ré mineur 7']));
    expect(comptine.progression).toHaveLength(53);
    expect(comptine.progression.at(0)).toMatchObject({ beat: 0, name: 'Mi mineur' });
    expect(comptine.progression.at(-1)).toMatchObject({ beat: 208, name: 'Mi mineur' });
    expect(new Set(comptine.progression.map((step) => step.name))).toEqual(new Set(['Mi mineur', 'Sol majeur', 'Si mineur', 'Ré majeur', 'Do majeur', 'La mineur']));
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
    expect(pianoHandChoicesForMode(myWay, 'practice')).toEqual(['left', 'right']);
    expect(pianoHandChoicesForMode(myWay, 'maestro')).toEqual(['both']);
    expect(pianoNotesForMode(myWay, 'practice', 'right')).toEqual(pianoNotesForHand(myWay.notes, 'right'));
    expect(pianoNotesForMode(myWay, 'practice', 'left')).toEqual(pianoNotesForHand(myWay.notes, 'left'));
    expect(pianoNotesForMode(myWay, 'maestro', 'right')).toHaveLength(myWay.notes.length);
    expect(isPianoSessionCounted('practice')).toBe(false);
    expect(isPianoSessionCounted('maestro')).toBe(true);
    expect(pianoShowsFingerings('practice')).toBe(true);
    expect(pianoShowsFingerings('maestro')).toBe(false);
    expect(pianoSessionCounts(5, [-301, -300, 0, 300, 301], 300)).toEqual({ correctCount: 3, earlyCount: 1, lateCount: 1 });
  });
  it('splits every long-form selected song into three complete practice sections', () => {
    const sectionedExercises = PIANO_EXERCISES.filter((item) => ['Experience', 'My Way', 'Ne me quitte pas', "Mia & Sebastian's Theme", 'Amsterdam', 'Comptine d’un autre été'].includes(item.title));
    expect(sectionedExercises).toHaveLength(9);
    for (const exercise of sectionedExercises) {
      const sections = pianoPracticeSections(exercise);
      expect(sections).toHaveLength(3);
      expect(sections[0].startBeat).toBe(0);
      expect(sections[1].startBeat).toBe(sections[0].endBeat);
      expect(sections[2].startBeat).toBe(sections[1].endBeat);
      expect(sections[2].endBeat).toBeGreaterThanOrEqual(pianoExerciseEndBeat(exercise.notes));
      expect(sections.flatMap((section) => pianoNotesForSection(exercise.notes, section))).toHaveLength(exercise.notes.length);
    }
    expect(sectionedExercises.map((exercise) => pianoExerciseMeasureCount(exercise))).toEqual([54, 82, 68, 68, 100, 100, 69, 53, 116]);
    expect(pianoPracticeSections(sectionedExercises[0]).map((section) => [section.description, section.startBeat, section.endBeat])).toEqual([
      ['Mesures 1 à 18', 0, 73],
      ['Mesures 19 à 36', 73, 145],
      ['Mesures 37 à 54', 145, 217],
    ]);
    const neMeQuittePas = sectionedExercises.find((exercise) => exercise.id === 'ne-me-quitte-pas-advanced')!;
    expect(pianoPracticeSections(neMeQuittePas).map((section) => [section.description, section.startBeat, section.endBeat])).toEqual([
      ['Mesures 1 à 27', 0, 81],
      ['Mesures 28 à 55', 81, 165],
      ['Mesures 56 à 82', 165, 246],
    ]);
    const experience61 = sectionedExercises.find((exercise) => exercise.id === 'experience-complete-61')!;
    expect(pianoPracticeSections(experience61).map((section) => [section.description, section.startBeat, section.endBeat])).toEqual([
      ['Mesures 1 à 23', 0, 92],
      ['Mesures 24 à 45', 92, 180],
      ['Mesures 46 à 68', 180, 272],
    ]);
    for (const miaSebastian of sectionedExercises.filter((exercise) => exercise.title === "Mia & Sebastian's Theme")) {
      expect(pianoPracticeSections(miaSebastian).map((section) => [section.description, section.startBeat, section.endBeat])).toEqual([
        ['Mesures 1 à 33', 0, 99],
        ['Mesures 34 à 67', 99, 201],
        ['Mesures 68 à 100', 201, 300],
      ]);
    }
    const amsterdam = sectionedExercises.find((exercise) => exercise.title === 'Amsterdam')!;
    expect(pianoPracticeSections(amsterdam).map((section) => [section.description, section.startBeat, section.endBeat])).toEqual([
      ['Mesures 1 à 23', 0, 144],
      ['Mesures 24 à 46', 144, 282],
      ['Mesures 47 à 69', 282, 420],
    ]);
    const comptineOriginal = sectionedExercises.find((exercise) => exercise.id === 'comptine-autre-ete-original-61')!;
    expect(pianoPracticeSections(comptineOriginal).map((section) => [section.description, section.startBeat, section.endBeat])).toEqual([
      ['Mesures 1 à 18', 0, 72],
      ['Mesures 19 à 35', 72, 140],
      ['Mesures 36 à 53', 140, 212],
    ]);
    const comptineConcert = sectionedExercises.find((exercise) => exercise.id === 'comptine-autre-ete-kyle-landry-61')!;
    expect(pianoPracticeSections(comptineConcert).map((section) => [section.description, section.startBeat, section.endBeat])).toEqual([
      ['Mesures 1 à 39', 0, 156],
      ['Mesures 40 à 77', 156, 308],
      ['Mesures 78 à 116', 308, 464],
    ]);

    const experience = PIANO_EXERCISES.find((item) => item.id === 'experience-complete-61')!;
    const sections = pianoPracticeSections(experience);
    const rightHand = pianoNotesForMode(experience, 'practice', 'right');
    const sectionNotes = sections.map((section) => pianoNotesForSection(rightHand, section));
    expect(sections.map((section) => [section.id, section.startBeat, section.endBeat])).toEqual([
      ['part-1', 0, 92],
      ['part-2', 92, 180],
      ['part-3', 180, 272],
    ]);
    expect(sectionNotes.every((sectionNotesForPart, index) => sectionNotesForPart.length > 0 && sectionNotesForPart[0].beat >= 0 && pianoExerciseEndBeat(sectionNotesForPart) <= sections[index].endBeat - sections[index].startBeat)).toBe(true);
    expect(sectionNotes.reduce((total, notes) => total + notes.length, 0)).toBe(rightHand.length);
    expect(pianoNotesForSection(rightHand)).toBe(rightHand);
    expect(pianoPracticeSections(PIANO_EXERCISES.find((item) => item.id === 'se-canta-advanced')!)).toEqual([]);
  });
  it('adds a playable finger number to every falling note', () => {
    expect(PIANO_EXERCISES.every((exercise) => exercise.notes.every((note) => Number.isInteger(note.finger) && note.finger! >= 1 && note.finger! <= 5))).toBe(true);
    const seCanta = PIANO_EXERCISES.find((item) => item.id === 'se-canta-advanced')!;
    expect(pianoNotesForHand(seCanta.notes, 'right').slice(0, 3).map((note) => [note.midi, note.finger])).toEqual([[67, 5], [72, 1], [72, 1]]);
    const myWay = PIANO_EXERCISES.find((item) => item.id === 'my-way-advanced')!;
    expect(myWay.notes.filter((note) => note.hand === 'left' && note.beat === 3).map((note) => note.finger)).toEqual([5, 3, 1]);
  });
  it('centers compact keyboards around middle C', () => {
    expect(pianoRange(25)).toContain(60);
    expect(pianoRange(61)).toEqual(expect.arrayContaining([36, 84, 96]));
    expect(pianoRange(61).at(-1)! - pianoRange(49).at(-1)!).toBe(12);
    expect(pianoRange(88)).toEqual(expect.arrayContaining([21, 108]));
  });
  it('requires a keyboard that covers every selected note', () => {
    const adapted = PIANO_EXERCISES.find((item) => item.id === 'experience-complete-61')!;
    const complete = PIANO_EXERCISES.find((item) => item.id === 'experience-complete')!;
    expect(pianoKeyboardSizeForNotes(adapted.notes)).toBe(61);
    expect(pianoKeyboardSizeForNotes(pianoNotesForHand(complete.notes, 'right'))).toBe(61);
    expect(pianoKeyboardSizeForNotes(pianoNotesForHand(complete.notes, 'left'))).toBe(76);
    expect(pianoKeyboardSizeForNotes(complete.notes)).toBe(76);
    const miaSebastian61 = PIANO_EXERCISES.find((item) => item.id === 'mia-sebastians-theme-complete-61')!;
    const miaSebastian = PIANO_EXERCISES.find((item) => item.id === 'mia-sebastians-theme-complete')!;
    expect(pianoKeyboardSizeForNotes(miaSebastian61.notes)).toBe(61);
    expect(pianoKeyboardSizeForNotes(miaSebastian.notes)).toBe(88);
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
    expect(pianoMeasureBeats(8, 2, 1)).toEqual([1, 3, 5, 7]);
    expect(pianoMeasureBeats(14, 0)).toEqual([]);
    expect(PIANO_EXERCISES.filter((item) => item.title === 'My Way').every((item) => item.beatsPerMeasure === 4 && item.measureStartBeat === 1)).toBe(true);
    expect(PIANO_EXERCISES.filter((item) => ['Se Canta', 'Ne me quitte pas'].includes(item.title)).every((item) => item.beatsPerMeasure === 3)).toBe(true);
    expect(PIANO_EXERCISES.find((item) => item.title === 'Le 31 du mois d’Août')).toMatchObject({ beatsPerMeasure: 2, measureStartBeat: 1 });
    expect(PIANO_EXERCISES.find((item) => item.title === 'Amsterdam')).toMatchObject({ beatsPerMeasure: 6, measureStartBeat: 6 });
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
  it('keeps the concert tempo changes synchronized with the piano roll and note audio', () => {
    const tempoChanges = [
      { beat: 4, bpm: 120 },
      { beat: 8, bpm: 60 },
    ];
    expect(pianoTempoAtBeat(60, tempoChanges, 3.99)).toBe(60);
    expect(pianoTempoAtBeat(60, tempoChanges, 4)).toBe(120);
    expect(pianoBeatToMs(4, 60, 100, tempoChanges)).toBe(4000);
    expect(pianoBeatToMs(8, 60, 100, tempoChanges)).toBe(6000);
    expect(pianoBeatToMs(10, 60, 100, tempoChanges)).toBe(8000);
    expect(pianoMsToBeat(6000, 60, 100, tempoChanges)).toBe(8);
    expect(pianoMsToBeat(8000, 60, 100, tempoChanges)).toBe(10);
    expect(pianoBeatToMs(8, 60, 50, tempoChanges)).toBe(12000);
    expect(pianoNotePlaybackTimingWithTempo({ beat: 3, duration: 2 }, 60, 100, tempoChanges)).toEqual({ startMs: 3000, durationSeconds: 1.5 });
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
