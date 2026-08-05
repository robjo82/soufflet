import { describe, expect, it } from 'vitest';
import { classifyPianoAttempt, groupPianoExercises, hasPianoNoteReachedHitLine, isPianoHit, isPianoNoteAtHitLine, isPianoSessionCounted, PIANO_CHORD_EXERCISES, PIANO_CORRECT_TOLERANCE_PX, PIANO_EXERCISES, PIANO_SONGS, PIANO_TECHNIQUE_EXERCISES, PIANO_TIMING_TOLERANCE_PX, pianoChordExerciseForSong, pianoExerciseEndBeat, pianoExerciseMeasureCount, pianoHandChoicesForMode, pianoKeyboardSizeForNotes, pianoKeyGeometry, pianoLyricCueAtBeat, pianoMeasureBeats, pianoNoteDurationSeconds, pianoNoteOffsetPx, pianoNotePlaybackTiming, pianoNotesForHand, pianoNotesForMode, pianoNotesForSection, pianoPracticeSections, pianoRange, pianoScore, pianoSessionCounts, pianoShowsFingerings, resumeTimeline } from './pianoData';

describe('piano V1', () => {
  it('keeps Promenade du matin as an exercise and removes the placeholder pieces', () => {
    expect(PIANO_TECHNIQUE_EXERCISES.map((item) => item.title)).toEqual(['Promenade du matin']);
    expect(PIANO_EXERCISES.some((item) => ['Trois petits pas', 'Cinq lumières', 'Dialogue des deux mains'].includes(item.title))).toBe(false);
    expect(PIANO_EXERCISES.filter((item) => item.hand === 'both')).toHaveLength(9);
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
    expect(complete.lyrics?.at(0)).toMatchObject({ beat: 1, section: 'Couplet 1' });
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
    expect(pianoLyricCueAtBeat(lyrics, -1)).toEqual({ current: null, next: lyrics[0] });
    expect(pianoLyricCueAtBeat(lyrics, 9)).toEqual({ current: lyrics[1], next: lyrics[2] });
    expect(pianoLyricCueAtBeat(lyrics, 246)).toEqual({ current: lyrics.at(-1), next: null });
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
    expect(PIANO_SONGS.map((song) => song.title)).toEqual(['My Way', 'Se Canta', 'Ne me quitte pas', 'Au clair de la lune', 'Experience', 'Le Brise-pied aveyronnais', "Mia & Sebastian's Theme"]);
    expect(PIANO_SONGS.find((song) => song.title === 'My Way')?.levels.map((level) => level.id)).toEqual(['my-way-advanced']);
    expect(PIANO_SONGS.find((song) => song.title === 'Se Canta')?.levels).toHaveLength(1);
    expect(PIANO_SONGS.find((song) => song.title === 'Ne me quitte pas')?.levels).toHaveLength(1);
    expect(PIANO_SONGS.find((song) => song.title === 'Au clair de la lune')?.levels).toHaveLength(1);
    expect(PIANO_SONGS.find((song) => song.title === 'Experience')?.levels).toHaveLength(2);
    expect(PIANO_SONGS.find((song) => song.title === 'Le Brise-pied aveyronnais')?.levels).toHaveLength(1);
    expect(PIANO_SONGS.find((song) => song.title === "Mia & Sebastian's Theme")?.levels.map((level) => level.id)).toEqual(['mia-sebastians-theme-complete-61', 'mia-sebastians-theme-complete']);
    expect(groupPianoExercises([PIANO_EXERCISES[0], { ...PIANO_EXERCISES[0], id: 'same-title-other-artist', artist: 'Autre artiste' }])).toHaveLength(2);
  });
  it('provides complete left-hand chord exercises with beginner fingerings', () => {
    const myWay = pianoChordExerciseForSong('My Way', 'Frank Sinatra')!;
    const seCanta = pianoChordExerciseForSong('Se Canta', 'Traditionnel occitan')!;
    const brel = pianoChordExerciseForSong('Ne me quitte pas', 'Jacques Brel')!;
    const auClair = pianoChordExerciseForSong('Au clair de la lune', 'Traditionnel français')!;
    const experience = pianoChordExerciseForSong('Experience', 'Ludovico Einaudi')!;
    const brisePied = pianoChordExerciseForSong('Le Brise-pied aveyronnais', 'Traditionnel aveyronnais')!;
    const miaSebastian = pianoChordExerciseForSong("Mia & Sebastian's Theme", 'Justin Hurwitz')!;
    expect(PIANO_CHORD_EXERCISES).toHaveLength(7);
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
    expect(miaSebastian.progression).toHaveLength(100);
    expect(miaSebastian.progression.at(0)).toMatchObject({ beat: 0, name: 'Mi majeur' });
    expect(miaSebastian.progression.at(-1)).toMatchObject({ beat: 297, name: 'Ré♭ majeur' });
    expect(new Set(miaSebastian.progression.map((step) => step.name)).size).toBe(22);
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
    const sectionedExercises = PIANO_EXERCISES.filter((item) => ['Experience', 'My Way', 'Ne me quitte pas', "Mia & Sebastian's Theme"].includes(item.title));
    expect(sectionedExercises).toHaveLength(6);
    for (const exercise of sectionedExercises) {
      const sections = pianoPracticeSections(exercise);
      expect(sections).toHaveLength(3);
      expect(sections[0].startBeat).toBe(0);
      expect(sections[1].startBeat).toBe(sections[0].endBeat);
      expect(sections[2].startBeat).toBe(sections[1].endBeat);
      expect(sections[2].endBeat).toBeGreaterThanOrEqual(pianoExerciseEndBeat(exercise.notes));
      expect(sections.flatMap((section) => pianoNotesForSection(exercise.notes, section))).toHaveLength(exercise.notes.length);
    }
    expect(sectionedExercises.map((exercise) => pianoExerciseMeasureCount(exercise))).toEqual([54, 82, 68, 68, 100, 100]);
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
