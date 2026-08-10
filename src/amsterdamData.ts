export type AmsterdamFinger = 1 | 2 | 3 | 4 | 5;

export interface AmsterdamNote {
  midi: number;
  beat: number;
  duration: number;
  hand: 'right' | 'left';
  finger: AmsterdamFinger;
}

export interface AmsterdamChordStep {
  beat: number;
  name: string;
  midis: number[];
  fingers: number[];
}

type MelodyTuple = [midi: number, beat: number, duration: number];
type ArpeggioShape = {
  name: string;
  notes: [bass: number, low: number, middle: number, high: number];
  chord: number[];
  fingers: number[];
};

// Vocal line from the supplied 6/4 score, cross-checked against its MIDI
// rendering. One 16-measure phrase is shared by the four verses.
const AMSTERDAM_MELODY_CYCLE: MelodyTuple[] = [
  [64, 0, .5], [64, .5, .5], [69, 1, 1], [69, 2, 1], [71, 3, 1], [72, 4, 2],
  [74, 6, .5], [72, 6.5, .5], [71, 7, 1], [67, 8, 1], [67, 9, 1], [67, 10, 2],
  [69, 12, .5], [71, 12.5, .5], [72, 13, 1], [69, 14, 1], [69, 15, 1], [69, 16, 2],
  [67, 18, .5], [69, 18.5, .5], [71, 19, 1], [71, 20, 1], [68, 21, 1], [64, 22, 2],
  [64, 24, .5], [64, 24.5, .5], [69, 25, 1], [69, 26, 1], [71, 27, 1], [72, 28, 2],
  [74, 30, .5], [72, 30.5, .5], [71, 31, 1], [67, 32, 1], [67, 33, 1], [67, 34, 2],
  [69, 36, .5], [71, 36.5, .5], [72, 37, 1], [69, 38, 1], [69, 39, 1], [68, 40, 2],
  [66, 42, .5], [68, 42.5, .5], [69, 43, 1], [69, 44, 1], [69, 45, 1], [69, 46, 2],
  [72, 48, .5], [74, 48.5, .5], [76, 49, 1], [76, 50, 1], [76, 51, 1], [76, 52, 2],
  [77, 54, .5], [76, 54.5, .5], [74, 55, 1], [74, 56, 1], [74, 57, 1], [74, 58, 2],
  [76, 60, .5], [74, 60.5, .5], [72, 61, 1], [69, 62, 1], [69, 63, 1], [69, 64, 2],
  [71, 66, .5], [72, 66.5, .5], [71, 67, 1], [71, 68, 1], [68, 69, 1], [64, 70, 2],
  [64, 72, .5], [64, 72.5, .5], [69, 73, 1], [69, 74, 1], [69, 75, 1], [69, 76, 2],
  [72, 78, .5], [69, 78.5, .5], [71, 79, 1], [67, 80, 1], [67, 81, 1], [67, 82, 2],
  [69, 84, .5], [71, 84.5, .5], [72, 85, 1], [69, 86, 1], [69, 87, 1], [68, 88, 2],
  [66, 90, .5], [68, 90.5, .5], [69, 91, 1], [69, 92, 1], [69, 93, 1], [69, 94, 2],
];

const RIGHT_FINGERS: Record<number, AmsterdamFinger> = {
  64: 1, 66: 2, 67: 2, 68: 2, 69: 3, 71: 4, 72: 1, 74: 2, 76: 3, 77: 4,
};

const melodyCycleAt = (startBeat: number): AmsterdamNote[] => AMSTERDAM_MELODY_CYCLE.map(([midi, beat, duration]) => ({
  midi,
  beat: startBeat + beat,
  duration,
  hand: 'right',
  finger: RIGHT_FINGERS[midi] ?? 1,
}));

const A_MINOR: ArpeggioShape = { name: 'La mineur', notes: [45, 57, 60, 64], chord: [57, 60, 64], fingers: [5, 3, 1] };
const E_MINOR: ArpeggioShape = { name: 'Mi mineur', notes: [40, 55, 59, 64], chord: [55, 59, 64], fingers: [5, 3, 1] };
const F_MAJOR: ArpeggioShape = { name: 'Fa majeur', notes: [41, 57, 60, 65], chord: [57, 60, 65], fingers: [5, 3, 1] };
const E_SEVEN: ArpeggioShape = { name: 'Mi 7', notes: [40, 56, 62, 64], chord: [56, 62, 64], fingers: [5, 3, 1] };
const A_MINOR_OVER_E: ArpeggioShape = { name: 'La mineur / Mi', notes: [40, 57, 60, 64], chord: [57, 60, 64], fingers: [5, 3, 1] };
const C_MAJOR: ArpeggioShape = { name: 'Do majeur', notes: [48, 55, 60, 64], chord: [55, 60, 64], fingers: [5, 3, 1] };
const G_SEVEN: ArpeggioShape = { name: 'Sol 7', notes: [43, 55, 59, 65], chord: [55, 59, 65], fingers: [5, 3, 1] };
const D_MINOR_SEVEN: ArpeggioShape = { name: 'Ré mineur 7', notes: [50, 57, 60, 65], chord: [50, 57, 60, 65], fingers: [5, 3, 2, 1] };

// Each entry spans three quarter-note beats. Pairs form one 6/4 measure.
const AMSTERDAM_ARPEGGIO_CYCLE: ArpeggioShape[] = [
  A_MINOR, A_MINOR, A_MINOR, A_MINOR, E_MINOR, E_MINOR, F_MAJOR, F_MAJOR,
  E_SEVEN, E_SEVEN, A_MINOR, A_MINOR, E_MINOR, E_MINOR, F_MAJOR, E_SEVEN,
  A_MINOR_OVER_E, A_MINOR_OVER_E, C_MAJOR, C_MAJOR, G_SEVEN, E_SEVEN, A_MINOR, A_MINOR,
  E_SEVEN, E_SEVEN, F_MAJOR, F_MAJOR, E_MINOR, E_MINOR, D_MINOR_SEVEN, E_SEVEN,
];

const arpeggioAt = (shape: ArpeggioShape, beat: number): AmsterdamNote[] => {
  const [bass, low, middle, high] = shape.notes;
  return [bass, low, middle, high, middle, low].map((midi, index) => ({
    midi,
    beat: beat + index * .5,
    duration: .5,
    hand: 'left',
    finger: ([5, 5, 3, 1, 3, 5] as AmsterdamFinger[])[index],
  }));
};

const verseArpeggiosAt = (startBeat: number) => AMSTERDAM_ARPEGGIO_CYCLE.flatMap((shape, index) => arpeggioAt(shape, startBeat + index * 3));
const verseChordsAt = (startBeat: number): AmsterdamChordStep[] => AMSTERDAM_ARPEGGIO_CYCLE.map((shape, index) => ({
  beat: startBeat + index * 3,
  name: shape.name,
  midis: shape.chord,
  fingers: shape.fingers,
}));

const VERSE_STARTS = [11, 107, 203, 299];
const ACCOMPANIMENT_STARTS = [6, 102, 198, 294];

export const AMSTERDAM_VOCAL_NOTES: AmsterdamNote[] = [
  ...VERSE_STARTS.flatMap(melodyCycleAt),
  { midi: 64, beat: 395, duration: .5, hand: 'right', finger: 1 },
  { midi: 64, beat: 395.5, duration: .5, hand: 'right', finger: 1 },
  { midi: 69, beat: 396, duration: 1, hand: 'right', finger: 3 },
  { midi: 69, beat: 397, duration: 1, hand: 'right', finger: 3 },
  { midi: 71, beat: 398, duration: 1, hand: 'right', finger: 4 },
  { midi: 72, beat: 399, duration: 3, hand: 'right', finger: 1 },
];

const AMSTERDAM_CODA_SHAPES = [A_MINOR, A_MINOR, E_MINOR, E_MINOR, D_MINOR_SEVEN, E_SEVEN, A_MINOR, A_MINOR];
const AMSTERDAM_LEFT_HAND_NOTES: AmsterdamNote[] = [
  ...ACCOMPANIMENT_STARTS.flatMap(verseArpeggiosAt),
  ...arpeggioAt(A_MINOR, 390),
  ...arpeggioAt(A_MINOR, 393),
  ...AMSTERDAM_CODA_SHAPES.flatMap((shape, index) => arpeggioAt(shape, 396 + index * 3)),
  { midi: 60, beat: 419.5, duration: .5, hand: 'left', finger: 3 },
  { midi: 64, beat: 419.5, duration: .5, hand: 'left', finger: 1 },
];

export const AMSTERDAM_61_KEY_NOTES: AmsterdamNote[] = [
  ...AMSTERDAM_VOCAL_NOTES,
  ...AMSTERDAM_LEFT_HAND_NOTES,
].sort((left, right) => left.beat - right.beat || left.midi - right.midi);

const AMSTERDAM_CHORD_STEPS: AmsterdamChordStep[] = [
  ...ACCOMPANIMENT_STARTS.flatMap(verseChordsAt),
  ...verseChordsAt(390).slice(0, 2),
  ...AMSTERDAM_CODA_SHAPES.map((shape, index) => ({
    beat: 396 + index * 3,
    name: shape.name,
    midis: shape.chord,
    fingers: shape.fingers,
  })),
];

export const AMSTERDAM_CHORD_PROGRESSION = AMSTERDAM_CHORD_STEPS.filter((step, index) => {
  const previous = AMSTERDAM_CHORD_STEPS[index - 1];
  return !previous || step.name !== previous.name || step.midis.some((midi, noteIndex) => midi !== previous.midis[noteIndex]);
});
