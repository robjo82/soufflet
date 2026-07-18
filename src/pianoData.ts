import type { PianoKeyboardSize } from './types';

export interface PianoExercise {
  id: string;
  title: string;
  artist?: string;
  arrangement?: string;
  level: 'Très simple' | 'Simple' | 'Modéré';
  bpm: number;
  hand: 'right' | 'both';
  notes: Array<{ midi: number; beat: number; duration: number; hand?: 'right' | 'left' }>;
}

export interface PianoSong {
  id: string;
  title: string;
  artist?: string;
  levels: PianoExercise[];
}

type PianoNote = PianoExercise['notes'][number];
export type PianoPracticeHand = 'right' | 'left' | 'both';
export type PianoPlayMode = 'learning' | 'practice' | 'game';

const phrase = (midis: number[], durations?: number[]) => {
  let beat = 0;
  return midis.map((midi, index) => {
    const duration = durations?.[index] ?? 1;
    const note = { midi, beat, duration };
    beat += duration;
    return note;
  });
};

const timedNotes = (entries: Array<[midi: number, beat: number, duration: number]>): PianoNote[] => entries.map(([midi, beat, duration]) => ({ midi, beat, duration }));

const MY_WAY_EASY = timedNotes([
  [60, 0, 1],
  [69, 1, 3], [69, 5, 3], [69, 9, 3],
  [67, 13, 1], [66, 14, 2], [62, 16, 1],
  [70, 17, 3], [70, 21, 3], [70, 25, 3],
  [69, 29, 2], [67, 31, 2], [69, 33, 3],
  [70, 37, 3], [70, 41, 1], [69, 42, 2], [67, 44, 1],
  [69, 45, 3], [67, 49, 3], [65, 53, 4],
  [65, 57, 2], [69, 59, 2], [69, 61, 2],
  [72, 63.5, .5], [70, 64, .5], [68, 64.5, .5], [65, 65, 4],
]);

const MY_WAY_MELODY = timedNotes([
  [60, 0, 1],
  [69, 1, 2], [60, 3.5, .5], [69, 4, .5], [67, 4.5, .5],
  [69, 5, 2], [60, 7.5, .5], [69, 8, .5], [67, 8.5, .5],
  [69, 9, 2], [60, 11.5, .5], [69, 12, .5], [67, 12.5, .5],
  [67, 13, 1], [66, 14, 2], [62, 16, 1],
  [70, 17, 2], [62, 19.5, .5], [70, 20, .5], [69, 20.5, .5],
  [70, 21, 2], [62, 23.5, .5], [70, 24, .5], [69, 24.5, .5],
  [70, 25, 2], [72, 27.5, .5], [65, 28, .5], [64, 28.5, .5],
  [69, 29, 1], [67, 30, 1.5], [65, 32.5, .5],
  [69, 33, 2], [69, 35.5, .5], [70, 36, .5], [72, 36.5, .5],
  [70, 37, 2], [69, 39.5, .5], [70, 40, .5], [69, 40.5, .5],
  [70, 41, 1], [69, 42, 2], [67, 44, .5], [69, 44.5, .5],
  [69, 45, 2], [60, 47.5, .5], [69, 48, .5], [67, 48.5, .5],
  [67, 49, 2], [60, 51.5, .5], [65, 52, .5], [67, 52.5, .5],
  [65, 53, 4],
  [65, 57, 2], [67, 59, .5], [69, 59.5, .5], [70, 60, .5], [72, 60.5, .5],
  [69, 61, 2], [72, 63.5, .5], [70, 64, .5], [68, 64.5, .5],
  [65, 65, 4],
]);

const MY_WAY_HARMONY: Array<[beat: number, root: number, intervals: number[]]> = [
  [1, 41, [0, 4, 7]], [5, 45, [0, 3, 7]], [9, 48, [0, 3, 7]], [13, 50, [0, 4, 10]],
  [17, 43, [0, 3, 7]], [21, 43, [0, 3, 7, 10]], [25, 48, [0, 4, 10]], [29, 41, [0, 4, 7]],
  [33, 41, [0, 4, 10]], [37, 46, [0, 4, 7]], [41, 46, [0, 3, 7]], [45, 41, [0, 4, 7]],
  [49, 48, [0, 4, 10]], [53, 46, [0, 3, 7]], [57, 41, [0, 4, 7]], [61, 41, [0, 4, 10]],
  [65, 41, [0, 4, 7]],
];

const MY_WAY_TWO_HANDS = [
  ...MY_WAY_MELODY.map((note) => ({ ...note, hand: 'right' as const })),
  ...MY_WAY_HARMONY.flatMap(([beat, root, intervals]) => [
    { midi: root, beat, duration: 1.5, hand: 'left' as const },
    ...intervals.map((interval) => ({ midi: root + interval, beat: beat + 2, duration: 1.5, hand: 'left' as const })),
  ]),
].sort((left, right) => left.beat - right.beat || left.midi - right.midi);

// Traditional melody transcribed in C major from the public-domain ABC source.
// The opening G is an anacrusis; the following notes preserve the original 3/4 pulse.
const SE_CANTA_EASY = timedNotes([
  [67, 0, 1],
  [72, 1, 2], [76, 3, 1],
  [72, 4, 2], [74, 6, 1],
  [76, 7, 3],
  [74, 10, 2], [76, 12, 1],
  [77, 13, 3],
  [76, 16, 2], [72, 18, 1],
  [74, 19, 2], [67, 21, 1],
  [72, 22, 2],
]);

const SE_CANTA_MELODY = timedNotes([
  [67, 0, 1],
  [72, 1, 1], [72, 2, 1], [76, 3, .5], [74, 3.5, .5],
  [72, 4, 1], [72, 5, 1], [72, 6, .5], [74, 6.5, .5],
  [76, 7, 2], [76, 9, 1],
  [74, 10, 2], [74, 12, .5], [76, 12.5, .5],
  [77, 13, 2], [77, 15, 1],
  [76, 16, 1], [76, 17, 1], [72, 18, .5], [76, 18.5, .5],
  [74, 19, 2], [67, 21, 1],
  [72, 22, 2],
]);

const SE_CANTA_HARMONY: Array<[beat: number, root: number, intervals: number[]]> = [
  [1, 48, [0, 4, 7]],
  [4, 48, [0, 4, 7]],
  [7, 48, [0, 4, 7]],
  [10, 43, [0, 4, 7]],
  [13, 41, [0, 4, 7]],
  [16, 48, [0, 4, 7]],
  [19, 43, [0, 4, 7]],
  [22, 48, [0, 4, 7]],
];

const SE_CANTA_TWO_HANDS = [
  ...SE_CANTA_MELODY.map((note) => ({ ...note, hand: 'right' as const })),
  ...SE_CANTA_HARMONY.flatMap(([beat, root, intervals]) => [
    { midi: root, beat, duration: 1, hand: 'left' as const },
    ...intervals.map((interval) => ({ midi: root + interval, beat: beat + 1, duration: beat === 22 ? 1 : 2, hand: 'left' as const })),
  ]),
].sort((left, right) => left.beat - right.beat || left.midi - right.midi);

export const PIANO_EXERCISES: PianoExercise[] = [
  { id: 'piano-three-steps', title: 'Trois petits pas', level: 'Très simple', bpm: 60, hand: 'right', notes: phrase([60, 62, 64, 62, 60, 62, 64, 60], [.5, .5, 1, 1.5, .5, 2, 1, .5]) },
  { id: 'piano-five-lights', title: 'Cinq lumières', level: 'Simple', bpm: 72, hand: 'right', notes: phrase([60, 62, 64, 65, 67, 65, 64, 62, 60, 62, 64, 65, 67, 60]) },
  { id: 'piano-morning-walk', title: 'Promenade du matin', level: 'Modéré', bpm: 80, hand: 'right', notes: phrase([60, 62, 64, 65, 67, 69, 67, 65, 64, 62, 60, 64, 67, 69, 67, 64, 62, 65, 69, 67, 65, 64, 62, 60], [1, 1, .5, .5, 1, 2, 1, 1, .5, .5, 2, 1, 1, 2, .5, .5, 1, 1, 1, 2, .5, .5, 1, 2]) },
  { id: 'piano-two-hands', title: 'Dialogue des deux mains', level: 'Simple', bpm: 64, hand: 'both', notes: phrase([48, 60, 50, 62, 52, 64, 53, 65, 55, 67, 53, 65, 52, 64, 50, 62, 48, 60]).map((note) => ({ ...note, hand: note.midi < 60 ? 'left' as const : 'right' as const })) },
  { id: 'my-way-beginner', title: 'My Way', artist: 'Frank Sinatra', arrangement: 'Niveau 1 · Mélodie simplifiée', level: 'Très simple', bpm: 54, hand: 'right', notes: MY_WAY_EASY },
  { id: 'my-way-intermediate', title: 'My Way', artist: 'Frank Sinatra', arrangement: 'Niveau 2 · Mélodie complète', level: 'Simple', bpm: 64, hand: 'right', notes: MY_WAY_MELODY },
  { id: 'my-way-advanced', title: 'My Way', artist: 'Frank Sinatra', arrangement: 'Niveau 3 · Mélodie et accompagnement', level: 'Modéré', bpm: 72, hand: 'both', notes: MY_WAY_TWO_HANDS },
  { id: 'se-canta-beginner', title: 'Se Canta', artist: 'Traditionnel occitan', arrangement: 'Niveau 1 · Thème simplifié', level: 'Très simple', bpm: 54, hand: 'right', notes: SE_CANTA_EASY },
  { id: 'se-canta-intermediate', title: 'Se Canta', artist: 'Traditionnel occitan', arrangement: 'Niveau 2 · Mélodie complète', level: 'Simple', bpm: 64, hand: 'right', notes: SE_CANTA_MELODY },
  { id: 'se-canta-advanced', title: 'Se Canta', artist: 'Traditionnel occitan', arrangement: 'Niveau 3 · Mélodie et accompagnement', level: 'Modéré', bpm: 72, hand: 'both', notes: SE_CANTA_TWO_HANDS },
];

export function groupPianoExercises(exercises: PianoExercise[]) {
  const songs = new Map<string, PianoSong>();
  for (const exercise of exercises) {
    const key = `${exercise.title}\u0000${exercise.artist ?? ''}`;
    const song = songs.get(key) ?? { id: exercise.id, title: exercise.title, artist: exercise.artist, levels: [] };
    song.levels.push(exercise);
    songs.set(key, song);
  }
  return [...songs.values()];
}

export const PIANO_SONGS = groupPianoExercises(PIANO_EXERCISES);

export function pianoNotesForHand(notes: PianoExercise['notes'], hand: PianoPracticeHand) {
  if (hand === 'both') return notes;
  return notes.filter((note) => (note.hand ?? 'right') === hand);
}

export function pianoNotesForMode(exercise: PianoExercise, mode: PianoPlayMode, hand: PianoPracticeHand) {
  return exercise.hand === 'both' && mode !== 'game' ? pianoNotesForHand(exercise.notes, hand) : exercise.notes;
}

export function isPianoSessionCounted(mode: PianoPlayMode) {
  return mode !== 'practice';
}

export function pianoSessionCounts(correct: number, timings: number[], correctToleranceMs: number) {
  const earlyCount = timings.filter((value) => value < -correctToleranceMs).length;
  const lateCount = timings.filter((value) => value > correctToleranceMs).length;
  return { correctCount: Math.max(0, correct - earlyCount - lateCount), earlyCount, lateCount };
}

export const PIANO_CHORDS = [
  { name: 'Do majeur', midis: [60, 64, 67] },
  { name: 'Sol majeur', midis: [59, 62, 67] },
  { name: 'Fa majeur', midis: [60, 65, 69] },
  { name: 'La mineur', midis: [60, 64, 69] },
  { name: 'Mi mineur', midis: [59, 64, 67] },
];

const START_BY_SIZE: Record<PianoKeyboardSize, number> = { 25: 48, 32: 45, 49: 36, 61: 36, 76: 28, 88: 21 };
export const pianoRange = (size: PianoKeyboardSize) => Array.from({ length: size }, (_, index) => START_BY_SIZE[size] + index);
export const isBlackKey = (midi: number) => [1, 3, 6, 8, 10].includes(midi % 12);
export const frenchNote = (midi: number) => `${['Do', 'Do♯', 'Ré', 'Ré♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si'][midi % 12]}${Math.floor(midi / 12) - 1}`;

export function pianoKeyGeometry(size: PianoKeyboardSize) {
  const keys = pianoRange(size);
  const whiteCount = keys.filter((midi) => !isBlackKey(midi)).length;
  const whiteWidth = 100 / whiteCount;
  let whitesBefore = 0;
  return keys.map((midi) => {
    const black = isBlackKey(midi);
    const width = black ? whiteWidth * .62 : whiteWidth;
    const left = black ? whitesBefore * whiteWidth - width / 2 : whitesBefore * whiteWidth;
    if (!black) whitesBefore += 1;
    return { midi, black, left, width };
  });
}

export const PIANO_PIXELS_PER_BEAT = 72;
export const PIANO_CORRECT_TOLERANCE_PX = 18;
export const PIANO_TIMING_TOLERANCE_PX = 54;

export function pianoNoteOffsetPx(noteBeat: number, elapsedBeat: number, pixelsPerBeat = PIANO_PIXELS_PER_BEAT) {
  return (noteBeat - elapsedBeat) * pixelsPerBeat;
}

export function isPianoNoteAtHitLine(offsetPx: number, tolerancePx = 1) {
  return Math.abs(offsetPx) <= tolerancePx;
}

export function hasPianoNoteReachedHitLine(offsetPx: number, tolerancePx = 1) {
  return offsetPx <= tolerancePx;
}

export function pianoNoteDurationSeconds(durationBeats: number, beatMs: number) {
  return Math.max(.08, durationBeats * beatMs / 1000);
}

export function pianoNotePlaybackTiming(note: Pick<PianoExercise['notes'][number], 'beat' | 'duration'>, beatMs: number) {
  return {
    startMs: note.beat * beatMs,
    durationSeconds: pianoNoteDurationSeconds(note.duration, beatMs),
  };
}

export function pianoExerciseEndBeat(notes: PianoExercise['notes']) {
  return notes.reduce((endBeat, note) => Math.max(endBeat, note.beat + note.duration), 0);
}

export function pianoScore(correct: number, missed: number, timingErrors: number[], correctToleranceMs = 300) {
  const total = correct + missed;
  const averageDelay = timingErrors.length ? Math.round(timingErrors.reduce((sum, value) => sum + value, 0) / timingErrors.length) : 0;
  const rhythmAccuracy = timingErrors.length ? Math.round(timingErrors.filter((value) => Math.abs(value) <= correctToleranceMs).length / timingErrors.length * 100) : 0;
  const global = total ? Math.round((correct / total * .7 + rhythmAccuracy / 100 * .3) * 100) : 0;
  const advice = missed > correct / 2 ? 'Ralentis et repère les positions des touches.' : averageDelay > 180 ? 'Anticipe légèrement l’arrivée des notes.' : rhythmAccuracy < 75 ? 'Refais le morceau plus lentement.' : 'Très bien : tu peux essayer le niveau suivant.';
  return { correct, missed, averageDelay, rhythmAccuracy, global, advice };
}

export function isPianoHit(expectedMidi: number, playedMidi: number, timingDeltaMs: number, toleranceMs = 300) {
  return expectedMidi === playedMidi && Math.abs(timingDeltaMs) <= toleranceMs;
}

export function classifyPianoAttempt(expectedMidi: number, playedMidi: number, noteOffsetPx: number, correctTolerancePx = PIANO_CORRECT_TOLERANCE_PX, timingTolerancePx = PIANO_TIMING_TOLERANCE_PX) {
  if (expectedMidi !== playedMidi || Math.abs(noteOffsetPx) > timingTolerancePx) return 'wrong' as const;
  return Math.abs(noteOffsetPx) <= correctTolerancePx ? 'correct' as const : 'timing' as const;
}

export function resumeTimeline(startTime: number, pausedAt: number, resumedAt: number) {
  return startTime + Math.max(0, resumedAt - pausedAt);
}
