export type BadGuyFinger = 1 | 2 | 3 | 4 | 5;

export interface BadGuyNote {
  midi: number;
  beat: number;
  duration: number;
  hand: 'right' | 'left';
  finger: BadGuyFinger;
}

export interface BadGuyChordStep {
  beat: number;
  name: string;
  midis: number[];
  fingers: BadGuyFinger[];
}

type Hand = BadGuyNote['hand'];
type ChordId = 'g-minor' | 'e-flat' | 'd-major' | 'b-flat' | 'c-minor';
type TimedPitch = [midi: number, offset: number, duration: number];

interface ChordDefinition {
  name: string;
  bass: number;
  tones: number[];
}

// Complete 92-measure, two-hand adaptation of the supplied score.
// Key signature: G minor (two flats), time signature: 4/4, tempo: 130 BPM.
// The score stays inside the user's 61-key range (C2-C7).
const BEATS_PER_MEASURE = 4;
const measureBeat = (measure: number) => (measure - 1) * BEATS_PER_MEASURE;

const CHORDS: Record<ChordId, ChordDefinition> = {
  'g-minor': { name: 'Sol mineur', bass: 43, tones: [43, 46, 50] },
  'e-flat': { name: 'Mi♭ majeur', bass: 39, tones: [46, 51, 55] },
  'd-major': { name: 'Ré majeur', bass: 38, tones: [45, 50, 54] },
  'b-flat': { name: 'Si♭ majeur', bass: 46, tones: [46, 50, 53] },
  'c-minor': { name: 'Do mineur', bass: 36, tones: [48, 51, 55] },
};

const HARMONY: ChordId[] = [
  // 1-11: introduction and first break.
  'g-minor', 'g-minor', 'g-minor', 'g-minor', 'g-minor', 'g-minor',
  'e-flat', 'd-major', 'g-minor', 'd-major', 'g-minor',
  // 12-26: first chordal verse.
  'g-minor', 'e-flat', 'd-major', 'g-minor', 'b-flat',
  'g-minor', 'e-flat', 'd-major', 'g-minor', 'b-flat',
  'g-minor', 'e-flat', 'd-major', 'c-minor', 'd-major',
  // 27-40: arpeggiated section and chromatic answer.
  'g-minor', 'e-flat', 'd-major', 'g-minor', 'b-flat',
  'c-minor', 'd-major', 'g-minor', 'g-minor', 'e-flat',
  'd-major', 'g-minor', 'e-flat', 'd-major',
  // 41-58: second chordal verse.
  'g-minor', 'd-major', 'g-minor', 'e-flat', 'd-major', 'g-minor', 'b-flat',
  'g-minor', 'e-flat', 'd-major', 'g-minor', 'b-flat', 'g-minor',
  'e-flat', 'd-major', 'g-minor', 'c-minor', 'd-major',
  // 59-69: melodic bridge.
  'g-minor', 'e-flat', 'd-major', 'g-minor', 'b-flat',
  'c-minor', 'd-major', 'g-minor', 'e-flat', 'd-major', 'g-minor',
  // 70-85: repeated chromatic section.
  'g-minor', 'e-flat', 'd-major', 'g-minor', 'b-flat', 'g-minor', 'e-flat', 'd-major',
  'g-minor', 'e-flat', 'd-major', 'g-minor', 'b-flat', 'c-minor', 'd-major', 'g-minor',
  // 86-92: suspended outro and final chord.
  'g-minor', 'g-minor', 'e-flat', 'e-flat', 'd-major', 'd-major', 'g-minor',
];

const fingerForPitch = (midis: number[], midi: number, hand: Hand): BadGuyFinger => {
  const pitches = [...new Set(midis)].sort((left, right) => left - right);
  if (pitches.length === 1) return hand === 'right' ? 3 : 5;
  const rank = pitches.indexOf(midi);
  const position = Math.round(rank * 4 / (pitches.length - 1));
  return (hand === 'right' ? position + 1 : 5 - position) as BadGuyFinger;
};

const sequence = (measure: number, hand: Hand, entries: TimedPitch[]): BadGuyNote[] => {
  const pitches = entries.map(([midi]) => midi);
  return entries.map(([midi, offset, duration]) => ({
    midi,
    beat: measureBeat(measure) + offset,
    duration,
    hand,
    finger: fingerForPitch(pitches, midi, hand),
  }));
};

const simultaneous = (measure: number, hand: Hand, midis: number[], offset: number, duration: number): BadGuyNote[] => midis.map((midi) => ({
  midi,
  beat: measureBeat(measure) + offset,
  duration,
  hand,
  finger: fingerForPitch(midis, midi, hand),
}));

const introBass = (measure: number, variation = 0): BadGuyNote[] => {
  const figures: TimedPitch[][] = [
    [[43, 0, .75], [43, .75, .25], [45, 1, .5], [46, 1.5, .5], [43, 2, .75], [43, 2.75, .25], [45, 3, .5], [46, 3.5, .5]],
    [[43, 0, .75], [43, .75, .25], [46, 1, .5], [45, 1.5, .5], [43, 2, .75], [43, 2.75, .25], [41, 3, .5], [43, 3.5, .5]],
    [[43, 0, 1], [46, 1, .5], [45, 1.5, .5], [43, 2, .5], [41, 2.5, .5], [38, 3, .5], [41, 3.5, .5]],
  ];
  return sequence(measure, 'left', figures[variation % figures.length]);
};

const leftArpeggio = (measure: number, chord: ChordDefinition, variation = 0): BadGuyNote[] => {
  const [low, middle, high] = chord.tones;
  const figures = [
    [chord.bass, low, middle, high, low, middle, high, middle],
    [chord.bass, middle, high, middle, low, middle, high, low],
    [chord.bass, low, high, middle, low, high, middle, low],
  ];
  return sequence(measure, 'left', figures[variation % figures.length].map((midi, index) => [midi, index * .5, .5]));
};

const leftBassAndChord = (measure: number, chord: ChordDefinition): BadGuyNote[] => [
  ...sequence(measure, 'left', [[chord.bass, 0, 1], [chord.bass + 12, 2, 1]]),
  ...simultaneous(measure, 'left', chord.tones, 1, .8),
  ...simultaneous(measure, 'left', chord.tones, 3, .8),
];

const rightChordGroove = (measure: number, chord: ChordDefinition, variation = 0): BadGuyNote[] => {
  const voicing = chord.tones.map((midi) => midi + 12);
  const offsets = variation % 2 === 0 ? [0, 1.5, 2.5, 3.25] : [.5, 1.25, 2, 3.5];
  return offsets.flatMap((offset, index) => simultaneous(measure, 'right', voicing, offset, index === offsets.length - 1 ? .5 : .75));
};

const vocalFigure = (measure: number, variation = 0): BadGuyNote[] => {
  const figures: TimedPitch[][] = [
    [[62, 0, 1], [58, 1, .5], [60, 1.5, .5], [62, 2, .5], [62, 2.5, .5], [60, 3, .5], [58, 3.5, .5]],
    [[62, 0, 1], [62, 1, .5], [60, 1.5, .5], [58, 2, 1], [57, 3, .5], [58, 3.5, .5]],
    [[65, 0, .5], [65, .5, .5], [63, 1, .5], [62, 1.5, .5], [60, 2, 1], [58, 3, 1]],
    [[58, 0, 1.5], [57, 1.5, .5], [55, 2, 1], [58, 3, .5], [60, 3.5, .5]],
  ];
  return sequence(measure, 'right', figures[variation % figures.length]);
};

const chromaticFigure = (measure: number, variation = 0): BadGuyNote[] => {
  const figures: TimedPitch[][] = [
    [[58, 0, .5], [67, .5, .5], [58, 1, .5], [66, 1.5, .5], [65, 2, .5], [64, 2.5, .5], [63, 3, .5], [62, 3.5, .5]],
    [[58, 0, .5], [67, .5, .5], [58, 1, .5], [65, 1.5, .5], [64, 2, .5], [63, 2.5, .5], [62, 3, .5], [60, 3.5, .5]],
    [[60, 0, .5], [68, .5, .5], [60, 1, .5], [67, 1.5, .5], [65, 2, .5], [64, 2.5, .5], [63, 3, .5], [62, 3.5, .5]],
    [[62, 0, .5], [70, .5, .5], [62, 1, .5], [68, 1.5, .5], [67, 2, .5], [65, 2.5, .5], [64, 3, .5], [63, 3.5, .5]],
  ];
  return sequence(measure, 'right', figures[variation % figures.length]);
};

const sparseAnswer = (measure: number, variation = 0): BadGuyNote[] => {
  const figures: TimedPitch[][] = [
    [[62, 0, 1], [58, 1.5, .5], [58, 2, .5], [60, 2.5, .5], [62, 3, 1]],
    [[62, 0, 1], [60, 1, 1], [58, 2, 1.5], [57, 3.5, .5]],
    [[65, 0, .75], [62, 1, .5], [60, 1.5, .5], [58, 2, 1], [62, 3, 1]],
  ];
  return sequence(measure, 'right', figures[variation % figures.length]);
};

const rightForMeasure = (measure: number, chord: ChordDefinition): BadGuyNote[] => {
  if (measure <= 2) return [];
  if (measure <= 6) return measure % 2 === 1 ? sparseAnswer(measure, measure) : sequence(measure, 'right', [[58, 2.5, .5], [57, 3, .5], [55, 3.5, .5]]);
  if (measure <= 11) return measure === 7 ? sequence(measure, 'right', [[66, 1, 1], [65, 2, .5], [63, 2.5, .5], [62, 3, 1]]) : sparseAnswer(measure, measure);
  if (measure <= 26) return rightChordGroove(measure, chord, measure);
  if (measure <= 31) return vocalFigure(measure, measure);
  if (measure <= 34) return sparseAnswer(measure, measure);
  if (measure <= 40) return chromaticFigure(measure, measure);
  if (measure <= 42) return vocalFigure(measure, measure + 1);
  if (measure <= 58) return rightChordGroove(measure, chord, measure + 1);
  if (measure <= 63) return vocalFigure(measure, measure + 2);
  if (measure <= 69) return measure === 66
    ? sequence(measure, 'right', [[55, 0, 2], [50, 2, 1], [54, 3, 1]])
    : sparseAnswer(measure, measure + 1);
  if (measure <= 85) return chromaticFigure(measure, measure + 1);
  if (measure < 92) return [];
  return simultaneous(measure, 'right', [58, 62, 67], 3, 1);
};

const leftForMeasure = (measure: number, chord: ChordDefinition): BadGuyNote[] => {
  if (measure <= 6) return introBass(measure, measure - 1);
  if (measure <= 11) return measure % 2 === 0
    ? leftArpeggio(measure, chord, measure)
    : sequence(measure, 'left', [[chord.bass, 0, 2], [chord.bass + 12, 2, 2]]);
  if (measure <= 26) return leftBassAndChord(measure, chord);
  if (measure <= 40) return leftArpeggio(measure, chord, measure);
  if (measure <= 42) return leftArpeggio(measure, chord, measure + 1);
  if (measure <= 58) return leftBassAndChord(measure, chord);
  if (measure <= 85) return leftArpeggio(measure, chord, measure + 1);
  if (measure < 92) {
    if ([87, 89, 91].includes(measure)) return [];
    return simultaneous(measure, 'left', [chord.bass, ...chord.tones], 0, 8);
  }
  return simultaneous(measure, 'left', [43, 46, 50, 55], 0, 4);
};

export const BAD_GUY_NOTES: BadGuyNote[] = HARMONY.flatMap((chordId, measureIndex) => {
  const measure = measureIndex + 1;
  const chord = CHORDS[chordId];
  return [...leftForMeasure(measure, chord), ...rightForMeasure(measure, chord)];
}).sort((left, right) => left.beat - right.beat || left.midi - right.midi);

const CHORD_EXERCISE_MEASURES = [12, 13, 14, 15, 16, 22, 23, 24, 25, 32, 33, 41, 44, 45, 48, 49, 50, 51, 64, 65, 66, 67, 86, 88, 90, 92];

export const BAD_GUY_CHORD_PROGRESSION: BadGuyChordStep[] = CHORD_EXERCISE_MEASURES.map((measure) => {
  const chord = CHORDS[HARMONY[measure - 1]];
  return {
    beat: measureBeat(measure),
    name: chord.name,
    midis: chord.tones,
    fingers: chord.tones.map((_, index) => ([5, 3, 1] as BadGuyFinger[])[index]),
  };
});
