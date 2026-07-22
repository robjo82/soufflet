export type ExperienceFinger = 1 | 2 | 3 | 4 | 5;

export interface ExperienceNote {
  midi: number;
  beat: number;
  duration: number;
  hand: 'right' | 'left';
  finger: ExperienceFinger;
}

export interface ExperienceChordStep {
  beat: number;
  name: string;
  midis: number[];
  fingers: ExperienceFinger[];
}

type TimedPitch = [midi: number, beat: number, duration: number];
type MeasurePattern = TimedPitch[];

const evenNotes = (midis: number[], duration: number): MeasurePattern => midis.map((midi, index) => [midi, index * duration, duration]);
const repeatedNotes = (midis: number[], repeats: number, duration: number): MeasurePattern => evenNotes(Array.from({ length: repeats }, () => midis).flat(), duration);
const arpeggioMeasure = (tops: number[], inner: number, low: number, lastMidi?: number): MeasurePattern => tops.flatMap((top, index) => {
  const beat = index;
  return [[top, beat, .25], [inner, beat + .25, .25], [low, beat + .5, .25], [index === tops.length - 1 && lastMidi !== undefined ? lastMidi : inner, beat + .75, .25]] as TimedPitch[];
});
const sequentialNotes = (midis: number[], durations: number[]): MeasurePattern => {
  let beat = 0;
  return midis.map((midi, index) => {
    const duration = durations[index];
    const note: TimedPitch = [midi, beat, duration];
    beat += duration;
    return note;
  });
};
const heldNotes = (midis: number[]): MeasurePattern => midis.map((midi) => [midi, 0, 4]);

// Measures 1–68 of the complete 4/4 score supplied by the user. Repeated
// ostinati are stored as measure patterns so the transcription stays auditable.
const EXPERIENCE_RIGHT_PATTERNS: MeasurePattern[] = [
  evenNotes([73, 73, 74, 73], 1),
  evenNotes([73, 71, 73, 74], 1),
  evenNotes([73, 71, 69, 71], 1),
  arpeggioMeasure([73, 73, 73, 73], 69, 61),
  arpeggioMeasure([73, 73, 73, 73], 68, 61),
  arpeggioMeasure([73, 71, 73, 74], 69, 62),
  arpeggioMeasure([73, 71, 73, 74], 69, 62, 61),
  repeatedNotes([69, 61, 73, 61], 4, .25),
  repeatedNotes([69, 68, 73, 61], 4, .25),
  repeatedNotes([69, 61, 68, 66], 4, .25),
  repeatedNotes([69, 62, 68, 66], 4, .25),
  repeatedNotes([73, 61, 71, 69], 4, .25),
  repeatedNotes([73, 62, 71, 69], 4, .25),
  arpeggioMeasure([73, 73, 74, 73], 69, 61),
  arpeggioMeasure([73, 73, 74, 73], 68, 61),
  arpeggioMeasure([73, 71, 73, 74], 66, 62),
  arpeggioMeasure([85, 85, 86, 85], 81, 73),
  arpeggioMeasure([85, 85, 86, 85], 80, 73),
  arpeggioMeasure([85, 83, 85, 86], 78, 74),
  sequentialNotes([69, 61, 69, 68, 61, 69, 68, 61, 69, 68, 61], [.5, .5, .25, .25, .5, .25, .25, .5, .25, .25, .5]),
  sequentialNotes([69, 68, 61, 69, 68, 61, 69, 68, 61, 69, 68, 61], [.25, .25, .5, .25, .25, .5, .25, .25, .5, .25, .25, .5]),
  evenNotes([69, 61, 69, 62, 69, 61, 69, 62], .5),
];

const EXPERIENCE_RIGHT_SEQUENCE = [
  0, 0, 0, 1, 0, 0, 0, 2,
  3, 3, 4, 5, 3, 3, 4, 6,
  7, 7, 8, 7, 7, 7, 7, 7,
  9, 9, 9, 10, 9, 9, 9, 10,
  11, 11, 11, 12, 9, 9, 9, 9,
  13, 13, 14, 15, 13, 13, 14, 15,
  16, 16, 17, 18, 16, 16, 17, 18,
  19, 20, 20, 21, 20, 20, 20, 21,
  7, 7, 8, 7,
];

const EXPERIENCE_LEFT_PATTERNS: MeasurePattern[] = [
  repeatedNotes([54, 61, 66, 61], 2, .5),
  repeatedNotes([57, 64, 69, 64], 2, .5),
  repeatedNotes([49, 56, 64, 56], 2, .5),
  repeatedNotes([50, 57, 66, 57], 2, .5),
  repeatedNotes([54, 61, 69, 61], 2, .5),
  [[50, 0, .5], [57, .5, .5], [66, 1, .5], [57, 1.5, .5], [50, 2, .5], [57, 2.5, .5], [54, 3, 1]],
  heldNotes([54]), heldNotes([57]), heldNotes([49]), heldNotes([50]), heldNotes([61]), heldNotes([62]),
  heldNotes([42, 49, 57]), heldNotes([45, 52, 57]), heldNotes([49, 52, 56]), heldNotes([50, 54, 57]), heldNotes([45, 50, 57]),
  repeatedNotes([42, 49, 57, 49], 4, .25),
  repeatedNotes([45, 52, 57, 52], 4, .25),
  repeatedNotes([49, 52, 56, 52], 4, .25),
  repeatedNotes([50, 54, 57, 54], 4, .25),
  evenNotes([50, 54, 57, 54, 50, 54, 57, 54, 50, 54, 52, 50, 49, 47, 45, 44], .25),
  repeatedNotes([37, 44, 52, 44], 4, .25),
  evenNotes([38, 45, 54, 45, 38, 45, 54, 45, 38, 54, 52, 50, 49, 47, 45, 44], .25),
  heldNotes([30, 42]), heldNotes([33, 45]), heldNotes([37, 49]), heldNotes([38, 50]),
  heldNotes([42, 49, 54]), heldNotes([37, 44, 49]), heldNotes([38, 45, 50]),
];

const EXPERIENCE_LEFT_SEQUENCE = [
  0, 1, 2, 3, 4, 1, 2, 5,
  6, 7, 8, 9, 6, 7, 10, 11,
  12, 13, 14, 15, 12, 13, 14, 15,
  12, 16, 14, 15, 12, 13, 14, 15,
  17, 18, 19, 20, 17, 18, 19, 21,
  17, 18, 22, 23, 17, 18, 22, 23,
  17, 18, 22, 23, 17, 18, 22, 23,
  24, 25, 26, 27, 28, 13, 29, 30,
  24, 25, 25, 30,
];

const EXPERIENCE_MELODY_FINGERS: Record<number, ExperienceFinger> = { 69: 1, 71: 2, 73: 3, 74: 4 };
const EXPERIENCE_OSTINATO_FINGERS: Record<number, Record<number, ExperienceFinger>> = {
  7: { 61: 1, 69: 2, 73: 4 },
  8: { 61: 1, 68: 2, 69: 3, 73: 5 },
  9: { 61: 1, 66: 3, 68: 4, 69: 5 },
  10: { 62: 1, 66: 3, 68: 4, 69: 5 },
  11: { 61: 1, 69: 3, 71: 4, 73: 5 },
  12: { 62: 1, 69: 3, 71: 4, 73: 5 },
};
const EXPERIENCE_ENDING_FINGERS: Record<number, ExperienceFinger> = { 61: 1, 62: 1, 68: 3, 69: 4 };
const EXPERIENCE_ARPEGGIO_PATTERNS = new Set([3, 4, 5, 6, 13, 14, 15, 16, 17, 18]);

const rightFinger = (patternId: number, midi: number): ExperienceFinger => {
  if (patternId <= 2) return EXPERIENCE_MELODY_FINGERS[midi] ?? 3;
  if (EXPERIENCE_ARPEGGIO_PATTERNS.has(patternId)) {
    const highRegister = patternId >= 16;
    if (midi >= (highRegister ? 83 : 71)) {
      if (midi % 12 === 2) return 5;
      return midi % 12 === 11 ? 3 : 4;
    }
    return midi >= (highRegister ? 78 : 66) ? 2 : 1;
  }
  return EXPERIENCE_OSTINATO_FINGERS[patternId]?.[midi] ?? EXPERIENCE_ENDING_FINGERS[midi] ?? 3;
};

const leftFinger = (pattern: MeasurePattern, midi: number): ExperienceFinger => {
  const pitches = [...new Set(pattern.map(([pitch]) => pitch))].sort((left, right) => left - right);
  const index = pitches.indexOf(midi);
  const isHeldPosition = pattern.every(([, beat, duration]) => beat === 0 && duration === 4);
  if (pitches.length === 1) return 2;
  if (index === 0) return 5;
  if (pitches.length === 2) return 2;
  if (index === pitches.length - 1) return 1;
  if (pitches.length === 3) return isHeldPosition ? 3 : 2;
  if (pitches.length === 4) return index === 1 ? 3 : 2;
  return index === pitches.length - 2 ? 2 : 3;
};

const notesFromMeasures = (patterns: MeasurePattern[], sequence: number[], hand: 'right' | 'left', startMeasure = 0, transpose = 0): ExperienceNote[] => sequence.flatMap((patternId, measureIndex) => {
  const pattern = patterns[patternId];
  return pattern.map(([midi, beat, duration]) => ({
    midi: midi + transpose,
    beat: (startMeasure + measureIndex) * 4 + beat,
    duration,
    hand,
    finger: hand === 'right' ? rightFinger(patternId, midi) : leftFinger(pattern, midi),
  }));
});

const sortNotes = (notes: ExperienceNote[]) => notes.sort((left, right) => left.beat - right.beat || left.midi - right.midi);

export const EXPERIENCE_FULL_NOTES = sortNotes([
  ...notesFromMeasures(EXPERIENCE_RIGHT_PATTERNS, EXPERIENCE_RIGHT_SEQUENCE, 'right'),
  ...notesFromMeasures(EXPERIENCE_LEFT_PATTERNS, EXPERIENCE_LEFT_SEQUENCE, 'left'),
]);

const experienceMeasureKey = (note: ExperienceNote) => `${note.hand}-${Math.floor(note.beat / 4)}`;
const experienceMeasureRanges = new Map<string, { lowest: number; highest: number }>();
for (const note of EXPERIENCE_FULL_NOTES) {
  const key = experienceMeasureKey(note);
  const range = experienceMeasureRanges.get(key) ?? { lowest: note.midi, highest: note.midi };
  range.lowest = Math.min(range.lowest, note.midi);
  range.highest = Math.max(range.highest, note.midi);
  experienceMeasureRanges.set(key, range);
}

// The complete arrangement adapted to the C2–C6 range of a 49-key piano.
// Whole hand/measure passages move by an octave so their melodic contour and
// every rhythmic event remain intact.
export const EXPERIENCE_49_KEY_NOTES = EXPERIENCE_FULL_NOTES.map((note) => {
  const range = experienceMeasureRanges.get(experienceMeasureKey(note))!;
  const octaveShift = range.lowest < 36 ? 12 : range.highest > 84 ? -12 : 0;
  return { ...note, midi: note.midi + octaveShift };
});

const easyPulse = (pattern: MeasurePattern): MeasurePattern => pattern.filter(([, beat]) => beat % 1 === 0 || beat % 1 === .25).map(([midi, beat]) => [midi, Math.floor(beat) + (beat % 1 === .25 ? .5 : 0), .5]);
const easyRightPatterns = EXPERIENCE_RIGHT_PATTERNS.map(easyPulse);
const easyLeftFinalPatterns = [heldNotes([42, 54]), heldNotes([45, 57]), heldNotes([49, 52, 56]), heldNotes([50, 54, 57])];
const easySectionA = [3, 3, 4, 5];
const easySectionB = [3, 3, 4, 6];
const easyLeftSectionA = [6, 7, 8, 9];

export const EXPERIENCE_EASY_NOTES = sortNotes([
  ...notesFromMeasures(EXPERIENCE_RIGHT_PATTERNS, EXPERIENCE_RIGHT_SEQUENCE.slice(0, 8), 'right', 0, -2),
  ...notesFromMeasures(EXPERIENCE_LEFT_PATTERNS, EXPERIENCE_LEFT_SEQUENCE.slice(0, 8), 'left', 0, -2),
  ...notesFromMeasures(easyRightPatterns, easySectionA, 'right', 8, -2),
  ...notesFromMeasures(EXPERIENCE_LEFT_PATTERNS, easyLeftSectionA, 'left', 8, -2),
  ...notesFromMeasures(easyRightPatterns, easySectionA, 'right', 12, -2),
  ...notesFromMeasures(EXPERIENCE_LEFT_PATTERNS, easyLeftSectionA, 'left', 12, -2),
  ...notesFromMeasures(easyRightPatterns, easySectionB, 'right', 16, -2),
  ...notesFromMeasures(easyLeftFinalPatterns, [0, 1, 2, 3], 'left', 16, -2),
  ...notesFromMeasures(easyRightPatterns, easySectionB, 'right', 20, -2),
  ...notesFromMeasures(easyLeftFinalPatterns, [0, 1, 2, 3], 'left', 20, -2),
]);

type ExperienceHarmony = 'f-sharp-minor' | 'a-major' | 'c-sharp-minor' | 'd-major';
const EXPERIENCE_HARMONY_BY_PATTERN: Record<number, ExperienceHarmony> = {
  0: 'f-sharp-minor', 1: 'a-major', 2: 'c-sharp-minor', 3: 'd-major', 4: 'f-sharp-minor', 5: 'd-major',
  6: 'f-sharp-minor', 7: 'a-major', 8: 'c-sharp-minor', 9: 'd-major', 10: 'c-sharp-minor', 11: 'd-major',
  12: 'f-sharp-minor', 13: 'a-major', 14: 'c-sharp-minor', 15: 'd-major', 16: 'd-major', 17: 'f-sharp-minor',
  18: 'a-major', 19: 'c-sharp-minor', 20: 'd-major', 21: 'd-major', 22: 'c-sharp-minor', 23: 'd-major',
  24: 'f-sharp-minor', 25: 'a-major', 26: 'c-sharp-minor', 27: 'd-major', 28: 'f-sharp-minor',
  29: 'c-sharp-minor', 30: 'd-major',
};
const EXPERIENCE_CHORDS: Record<ExperienceHarmony, Omit<ExperienceChordStep, 'beat'>> = {
  'f-sharp-minor': { name: 'Fa♯ mineur', midis: [42, 45, 49], fingers: [5, 3, 1] },
  'a-major': { name: 'La majeur', midis: [45, 49, 52], fingers: [5, 3, 1] },
  'c-sharp-minor': { name: 'Do♯ mineur', midis: [49, 52, 56], fingers: [5, 3, 1] },
  'd-major': { name: 'Ré majeur', midis: [50, 54, 57], fingers: [5, 3, 1] },
};

export const EXPERIENCE_CHORD_PROGRESSION: ExperienceChordStep[] = EXPERIENCE_LEFT_SEQUENCE.map((patternId, measureIndex) => ({
  beat: measureIndex * 4,
  ...EXPERIENCE_CHORDS[EXPERIENCE_HARMONY_BY_PATTERN[patternId]],
}));
