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

const rightFinger = (midi: number): ExperienceFinger => {
  const pitchClass = midi % 12;
  if (pitchClass === 1) return 1;
  if (pitchClass === 2 || pitchClass === 3) return 2;
  if (pitchClass === 4) return 3;
  if (pitchClass === 6) return 4;
  return 5;
};

const leftFinger = (pattern: MeasurePattern, midi: number): ExperienceFinger => {
  const pitches = [...new Set(pattern.map(([pitch]) => pitch))].sort((left, right) => left - right);
  const index = pitches.indexOf(midi);
  if (pitches.length <= 1 || index === 0) return 5;
  if (index === pitches.length - 1) return 1;
  return pitches.length >= 4 && index === pitches.length - 2 ? 2 : 3;
};

const notesFromMeasures = (patterns: MeasurePattern[], sequence: number[], hand: 'right' | 'left', startMeasure = 0, transpose = 0): ExperienceNote[] => sequence.flatMap((patternId, measureIndex) => {
  const pattern = patterns[patternId];
  return pattern.map(([midi, beat, duration]) => ({
    midi: midi + transpose,
    beat: (startMeasure + measureIndex) * 4 + beat,
    duration,
    hand,
    finger: hand === 'right' ? rightFinger(midi + transpose) : leftFinger(pattern, midi),
  }));
});

const sortNotes = (notes: ExperienceNote[]) => notes.sort((left, right) => left.beat - right.beat || left.midi - right.midi);

export const EXPERIENCE_FULL_NOTES = sortNotes([
  ...notesFromMeasures(EXPERIENCE_RIGHT_PATTERNS, EXPERIENCE_RIGHT_SEQUENCE, 'right'),
  ...notesFromMeasures(EXPERIENCE_LEFT_PATTERNS, EXPERIENCE_LEFT_SEQUENCE, 'left'),
]);

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
