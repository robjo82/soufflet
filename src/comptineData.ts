export type ComptineFinger = 1 | 2 | 3 | 4 | 5;

export interface ComptineNote {
  midi: number;
  beat: number;
  duration: number;
  hand: 'right' | 'left';
  finger: ComptineFinger;
}

export interface ComptineChordStep {
  beat: number;
  name: string;
  midis: number[];
  fingers: number[];
}

export interface ComptineTempoChange {
  beat: number;
  bpm: number;
  label: string;
}

type ChordId = 'e-minor' | 'g-major' | 'b-minor' | 'd-major' | 'c-major' | 'a-minor';

interface ChordDefinition {
  name: string;
  bass: number;
  tones: [number, number, number];
  right: [number, number, number];
}

const CHORDS: Record<ChordId, ChordDefinition> = {
  'e-minor': { name: 'Mi mineur', bass: 40, tones: [52, 55, 59], right: [64, 67, 71] },
  'g-major': { name: 'Sol majeur', bass: 43, tones: [50, 55, 59], right: [67, 71, 74] },
  'b-minor': { name: 'Si mineur', bass: 47, tones: [54, 59, 62], right: [66, 71, 74] },
  'd-major': { name: 'Ré majeur', bass: 38, tones: [50, 54, 57], right: [62, 66, 69] },
  'c-major': { name: 'Do majeur', bass: 36, tones: [48, 52, 55], right: [64, 67, 72] },
  'a-minor': { name: 'La mineur', bass: 45, tones: [52, 57, 60], right: [64, 69, 72] },
};

const MAIN_CYCLE: ChordId[] = ['e-minor', 'g-major', 'b-minor', 'd-major'];

const fingerForPitch = (midis: number[], midi: number, hand: ComptineNote['hand']): ComptineFinger => {
  const pitches = [...new Set(midis)].sort((left, right) => left - right);
  if (pitches.length === 1) return hand === 'right' ? 3 : 5;
  const rank = pitches.indexOf(midi);
  const position = Math.round(rank * 4 / (pitches.length - 1));
  return (hand === 'right' ? position + 1 : 5 - position) as ComptineFinger;
};

const sequence = (measureIndex: number, hand: ComptineNote['hand'], entries: Array<[midi: number, offset: number, duration: number]>): ComptineNote[] => {
  const midis = entries.map(([midi]) => midi);
  return entries.map(([midi, offset, duration]) => ({
    midi,
    beat: measureIndex * 4 + offset,
    duration,
    hand,
    finger: fingerForPitch(midis, midi, hand),
  }));
};

const chordAt = (measureIndex: number, hand: ComptineNote['hand'], midis: number[], offset: number, duration: number): ComptineNote[] => midis.map((midi) => ({
  midi,
  beat: measureIndex * 4 + offset,
  duration,
  hand,
  finger: fingerForPitch(midis, midi, hand),
}));

const leftEightNotes = (measureIndex: number, chord: ChordDefinition): ComptineNote[] => {
  const [low, middle, high] = chord.tones;
  const midis = [chord.bass, middle, high, middle, low, middle, high, middle];
  const fingers: ComptineFinger[] = [5, 3, 1, 3, 5, 3, 1, 3];
  return midis.map((midi, index) => ({ midi, beat: measureIndex * 4 + index * .5, duration: .5, hand: 'left', finger: fingers[index] }));
};

const leftSixteenthNotes = (measureIndex: number, chord: ChordDefinition): ComptineNote[] => {
  const [low, middle, high] = chord.tones;
  const cell = [chord.bass, low, middle, high, middle, low, middle, high];
  return [...cell, ...cell.map((midi, index) => index < 4 ? midi + 12 : midi)].map((midi, index) => ({
    midi,
    beat: measureIndex * 4 + index * .25,
    duration: .25,
    hand: 'left',
    finger: ([5, 4, 2, 1, 2, 4, 2, 1] as ComptineFinger[])[index % 8],
  }));
};

const motif = (measureIndex: number, transpose = 0, reverse = false): ComptineNote[] => {
  const pitches = [64, 66, 67, 71, 72, 71];
  const ordered = reverse ? [...pitches].reverse() : pitches;
  return sequence(measureIndex, 'right', [
    [ordered[0] + transpose, 1, .5],
    [ordered[1] + transpose, 1.5, .25],
    [ordered[2] + transpose, 1.75, .25],
    [ordered[3] + transpose, 2, .5],
    [ordered[4] + transpose, 2.5, .5],
    [ordered[5] + transpose, 3, 1],
  ]);
};

const heldPhrase = (measureIndex: number, transpose = 0, variant = 0): ComptineNote[] => {
  const figures = [
    [[71, 0, 1.5], [69, 1.5, .5], [67, 2, 2]],
    [[71, 0, 1.5], [69, 1.5, .5], [66, 2, 2]],
    [[74, 0, 1.5], [72, 1.5, .5], [71, 2, 2]],
    [[76, 0, 1.5], [74, 1.5, .5], [71, 2, 2]],
  ] as Array<Array<[number, number, number]>>;
  return sequence(measureIndex, 'right', figures[variant % figures.length].map(([midi, offset, duration]) => [midi + transpose, offset, duration]));
};

const rightSixteenths = (measureIndex: number, chord: ChordDefinition, variant = 0, octave = 0): ComptineNote[] => {
  const [low, middle, high] = chord.right.map((midi) => midi + octave) as [number, number, number];
  const figures = [
    [low, middle, high, middle, low + 12, middle, high, middle, low, middle, high, low + 12, high, middle, low, middle],
    [middle, low, middle, high, middle, low + 12, high, middle, low, middle, high, middle, low + 12, high, middle, low],
    [high, middle, low, middle, high, low + 12, high, middle, low, middle, high, low + 12, high, middle, low, middle],
  ];
  return sequence(measureIndex, 'right', figures[variant % figures.length].map((midi, index) => [midi, index * .25, .25]));
};

const shortRightForPrintedMeasure = (playedMeasureIndex: number, printedMeasure: number, chord: ChordDefinition): ComptineNote[] => {
  if (printedMeasure <= 4) return [];
  if (printedMeasure <= 8) return motif(playedMeasureIndex, printedMeasure === 8 ? -2 : 0, printedMeasure === 8);
  if (printedMeasure <= 12) return heldPhrase(playedMeasureIndex, 0, printedMeasure - 9);
  if (printedMeasure <= 16) return [
    ...chordAt(playedMeasureIndex, 'right', chord.right, 0, 1.5),
    ...sequence(playedMeasureIndex, 'right', [[chord.right[1], 1.5, .5], [chord.right[2], 2, 2]]),
  ];
  if (printedMeasure <= 24) return rightSixteenths(playedMeasureIndex, chord, printedMeasure, printedMeasure >= 21 ? 12 : 0);
  if (printedMeasure <= 28) return rightSixteenths(playedMeasureIndex, chord, printedMeasure + 1, 12);
  if (printedMeasure <= 36) return [
    ...chordAt(playedMeasureIndex, 'right', chord.right.map((midi) => midi + 12), 0, 1.5),
    ...heldPhrase(playedMeasureIndex, 12, printedMeasure).filter((note) => note.beat % 4 >= 1.5),
  ];
  if (printedMeasure < 45) return rightSixteenths(playedMeasureIndex, chord, printedMeasure, 12);
  return chordAt(playedMeasureIndex, 'right', [64, 67, 71, 76], 0, 4);
};

// The two repeat signs in the supplied 45-measure score expand the actual
// performance to 53 measures: 5–8 and 25–28 are each played twice.
const SHORT_PERFORMANCE_FORM = [
  ...Array.from({ length: 8 }, (_, index) => index + 1),
  ...Array.from({ length: 4 }, (_, index) => index + 5),
  ...Array.from({ length: 20 }, (_, index) => index + 9),
  ...Array.from({ length: 4 }, (_, index) => index + 25),
  ...Array.from({ length: 17 }, (_, index) => index + 29),
];

const shortChordId = (printedMeasure: number): ChordId => {
  if (printedMeasure >= 29 && printedMeasure <= 36) return (['c-major', 'a-minor', 'e-minor', 'b-minor'] as ChordId[])[(printedMeasure - 29) % 4];
  return MAIN_CYCLE[(printedMeasure - 1) % MAIN_CYCLE.length];
};

export const COMPTINE_ORIGINAL_61_KEY_NOTES: ComptineNote[] = SHORT_PERFORMANCE_FORM.flatMap((printedMeasure, playedMeasureIndex) => {
  const chord = CHORDS[shortChordId(printedMeasure)];
  return [...leftEightNotes(playedMeasureIndex, chord), ...shortRightForPrintedMeasure(playedMeasureIndex, printedMeasure, chord)];
}).sort((left, right) => left.beat - right.beat || left.midi - right.midi);

const FULL_HARMONY: ChordId[] = Array.from({ length: 116 }, (_, index) => {
  const measure = index + 1;
  if (measure >= 66 && measure <= 73) return (['c-major', 'a-minor', 'e-minor', 'b-minor'] as ChordId[])[(measure - 66) % 4];
  if (measure >= 94 && measure <= 99) return (['a-minor', 'c-major', 'd-major', 'b-minor'] as ChordId[])[(measure - 94) % 4];
  return MAIN_CYCLE[index % MAIN_CYCLE.length];
});

const concertRightForMeasure = (measureIndex: number, chord: ChordDefinition): ComptineNote[] => {
  const measure = measureIndex + 1;
  if (measure <= 3) return [];
  if (measure <= 9) return motif(measureIndex, 0, measure % 4 === 0);
  if (measure <= 16) return heldPhrase(measureIndex, 0, measure);
  if (measure <= 21) return [
    ...chordAt(measureIndex, 'right', chord.right, 0, 1.5),
    ...sequence(measureIndex, 'right', [[chord.right[1], 1.5, .5], [chord.right[2], 2, 2]]),
  ];
  if (measure <= 35) return rightSixteenths(measureIndex, chord, measure, measure >= 30 ? 12 : 0);
  if (measure <= 43) return measure % 2 ? heldPhrase(measureIndex, 12, measure) : rightSixteenths(measureIndex, chord, measure, 12);
  if (measure <= 52) return rightSixteenths(measureIndex, chord, measure, 12);
  if (measure <= 59) return [0, 1, 2, 3].flatMap((offset) => chordAt(measureIndex, 'right', chord.right.map((midi) => midi + 12), offset, .8));
  if (measure <= 65) return rightSixteenths(measureIndex, chord, measure, 12);
  if (measure <= 74) return measure % 2 ? motif(measureIndex, 12, measure % 3 === 0) : rightSixteenths(measureIndex, chord, measure, 12);
  if (measure <= 93) return rightSixteenths(measureIndex, chord, measure, measure >= 88 ? 24 : 12);
  if (measure <= 99) return rightSixteenths(measureIndex, chord, measure, 12);
  if (measure <= 107) return heldPhrase(measureIndex, 12, measure);
  if (measure < 116) return motif(measureIndex, 12, measure % 2 === 0);
  return chordAt(measureIndex, 'right', [64, 67, 71, 76, 83], 0, 4);
};

const concertLeftForMeasure = (measureIndex: number, chord: ChordDefinition): ComptineNote[] => {
  const measure = measureIndex + 1;
  if (measure >= 53 && measure <= 59) return [0, 1, 2, 3].flatMap((offset) => chordAt(measureIndex, 'left', chord.tones, offset, .8));
  if (measure >= 60 && measure <= 99) return leftSixteenthNotes(measureIndex, chord);
  if (measure === 116) return chordAt(measureIndex, 'left', [40, 47, 52, 55, 59], 0, 4);
  return leftEightNotes(measureIndex, chord);
};

const concertSourceNotes = FULL_HARMONY.flatMap((chordId, measureIndex) => {
  const chord = CHORDS[chordId];
  return [...concertLeftForMeasure(measureIndex, chord), ...concertRightForMeasure(measureIndex, chord)];
}).sort((left, right) => left.beat - right.beat || left.midi - right.midi);

const rangeKey = (note: ComptineNote) => `${note.hand}-${Math.floor(note.beat / 4)}`;
const measureHandRanges = new Map<string, { lowest: number; highest: number }>();
for (const note of concertSourceNotes) {
  const key = rangeKey(note);
  const range = measureHandRanges.get(key) ?? { lowest: note.midi, highest: note.midi };
  range.lowest = Math.min(range.lowest, note.midi);
  range.highest = Math.max(range.highest, note.midi);
  measureHandRanges.set(key, range);
}

// The supplied concert score uses octave signs beyond a 61-key keyboard.
// Complete hand-sized passages are moved by whole octaves, preserving every
// interval, rhythm and fingering while keeping the result inside C2–C7.
export const COMPTINE_CONCERT_61_KEY_NOTES: ComptineNote[] = concertSourceNotes.map((note) => {
  const range = measureHandRanges.get(rangeKey(note))!;
  let octaveShift = 0;
  while (range.lowest + octaveShift < 36) octaveShift += 12;
  while (range.highest + octaveShift > 96) octaveShift -= 12;
  return { ...note, midi: note.midi + octaveShift };
});

export const COMPTINE_CONCERT_TEMPO_CHANGES: ComptineTempoChange[] = [
  { beat: 236, bpm: 120, label: 'Excited' },
  { beat: 296, bpm: 110, label: 'Un peu plus lent' },
  { beat: 396, bpm: 90, label: 'Tempo primo' },
];

export const COMPTINE_CHORD_PROGRESSION: ComptineChordStep[] = SHORT_PERFORMANCE_FORM.map((printedMeasure, playedMeasureIndex) => {
  const chord = CHORDS[shortChordId(printedMeasure)];
  return {
    beat: playedMeasureIndex * 4,
    name: chord.name,
    midis: chord.tones,
    fingers: [5, 3, 1],
  };
});
