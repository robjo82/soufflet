export type MiaSebastianFinger = 1 | 2 | 3 | 4 | 5;

export interface MiaSebastianNote {
  midi: number;
  beat: number;
  duration: number;
  hand: 'right' | 'left';
  finger: MiaSebastianFinger;
}

export interface MiaSebastianChordStep {
  beat: number;
  name: string;
  midis: number[];
  fingers: MiaSebastianFinger[];
}

type Hand = MiaSebastianNote['hand'];
type ChordId =
  | 'e' | 'a-over-e' | 'b-over-d-sharp' | 'c-sharp-minor' | 'f-sharp-minor'
  | 'b' | 'g-sharp-minor' | 'a' | 'e-over-g-sharp' | 'b-seven' | 'c-sharp-seven'
  | 'f-sharp' | 'b-over-f-sharp' | 'c-sharp-seven-high' | 'd-sharp-minor'
  | 'f' | 'e-flat' | 'd-flat' | 'g-flat-over-d-flat' | 'a-flat-seven'
  | 'b-flat-minor' | 'g-flat' | 'd-flat-over-f' | 'e-flat-minor' | 'f-minor';

interface ChordDefinition {
  name: string;
  bass: number;
  voicing: number[];
  right: number[];
}

const CHORDS: Record<ChordId, ChordDefinition> = {
  e: { name: 'Mi majeur', bass: 28, voicing: [52, 56, 59], right: [64, 68, 71] },
  'a-over-e': { name: 'La majeur / Mi', bass: 28, voicing: [52, 57, 61], right: [64, 69, 73] },
  'b-over-d-sharp': { name: 'Si majeur / Ré♯', bass: 27, voicing: [51, 59, 63], right: [63, 66, 71] },
  'c-sharp-minor': { name: 'Do♯ mineur', bass: 25, voicing: [49, 52, 56], right: [64, 68, 73] },
  'f-sharp-minor': { name: 'Fa♯ mineur', bass: 30, voicing: [54, 57, 61], right: [66, 69, 73] },
  b: { name: 'Si majeur', bass: 23, voicing: [47, 51, 54], right: [63, 66, 71] },
  'g-sharp-minor': { name: 'Sol♯ mineur', bass: 32, voicing: [44, 47, 51], right: [63, 68, 71] },
  a: { name: 'La majeur', bass: 33, voicing: [45, 49, 52], right: [64, 69, 73] },
  'e-over-g-sharp': { name: 'Mi majeur / Sol♯', bass: 32, voicing: [44, 52, 59], right: [64, 68, 71] },
  'b-seven': { name: 'Si 7', bass: 23, voicing: [47, 51, 54, 57], right: [63, 66, 69, 71] },
  'c-sharp-seven': { name: 'Do♯ 7', bass: 25, voicing: [49, 53, 56, 59], right: [65, 68, 71, 73] },
  'f-sharp': { name: 'Fa♯ majeur', bass: 30, voicing: [54, 58, 61], right: [66, 70, 73] },
  'b-over-f-sharp': { name: 'Si majeur / Fa♯', bass: 30, voicing: [54, 59, 63], right: [66, 71, 75] },
  'c-sharp-seven-high': { name: 'Do♯ 7', bass: 25, voicing: [49, 53, 56, 59], right: [68, 71, 73, 77] },
  'd-sharp-minor': { name: 'Ré♯ mineur', bass: 27, voicing: [51, 54, 58], right: [66, 70, 75] },
  f: { name: 'Fa majeur', bass: 29, voicing: [53, 57, 60], right: [65, 69, 72] },
  'e-flat': { name: 'Mi♭ majeur', bass: 27, voicing: [51, 55, 58], right: [63, 67, 70] },
  'd-flat': { name: 'Ré♭ majeur', bass: 25, voicing: [49, 53, 56], right: [61, 65, 68] },
  'g-flat-over-d-flat': { name: 'Sol♭ majeur / Ré♭', bass: 25, voicing: [49, 54, 58], right: [66, 70, 73] },
  'a-flat-seven': { name: 'La♭ 7', bass: 32, voicing: [44, 48, 51, 54], right: [60, 63, 66, 68] },
  'b-flat-minor': { name: 'Si♭ mineur', bass: 34, voicing: [46, 49, 53], right: [65, 70, 73] },
  'g-flat': { name: 'Sol♭ majeur', bass: 30, voicing: [42, 46, 49], right: [66, 70, 73] },
  'd-flat-over-f': { name: 'Ré♭ majeur / Fa', bass: 29, voicing: [41, 49, 56], right: [65, 68, 73] },
  'e-flat-minor': { name: 'Mi♭ mineur', bass: 27, voicing: [39, 42, 46], right: [63, 66, 70] },
  'f-minor': { name: 'Fa mineur', bass: 29, voicing: [41, 44, 48], right: [65, 68, 72] },
};

// Measures 1–35: E major, as in the supplied Andante grazioso opening.
const E_MAJOR_HARMONY: ChordId[] = [
  'e', 'e', 'a-over-e', 'e', 'e', 'e', 'b-over-d-sharp', 'e',
  'c-sharp-minor', 'a-over-e', 'e', 'b-seven', 'c-sharp-minor', 'a', 'e-over-g-sharp', 'b-seven',
  'c-sharp-minor', 'a', 'e', 'b-over-d-sharp', 'c-sharp-minor', 'a', 'b-seven', 'e',
  'a', 'e-over-g-sharp', 'f-sharp-minor', 'b-seven', 'e', 'c-sharp-minor', 'a',
  'f-sharp-minor', 'b-seven', 'g-sharp-minor', 'c-sharp-seven',
];

// Measures 36–71: Poco più mosso in F-sharp major, ending with the
// chromatic transition visible at the end of page 2.
const F_SHARP_MAJOR_HARMONY: ChordId[] = [
  'f-sharp', 'f-sharp', 'b-over-f-sharp', 'f-sharp', 'f-sharp', 'f-sharp', 'c-sharp-seven-high', 'f-sharp',
  'd-sharp-minor', 'b-over-f-sharp', 'f-sharp', 'c-sharp-seven-high', 'd-sharp-minor', 'b-over-f-sharp', 'f-sharp', 'c-sharp-seven-high',
  'd-sharp-minor', 'b-over-f-sharp', 'f-sharp', 'c-sharp-seven-high', 'd-sharp-minor', 'b-over-f-sharp', 'c-sharp-seven-high', 'f-sharp',
  'g-sharp-minor', 'd-sharp-minor', 'b-over-f-sharp', 'f-sharp', 'g-sharp-minor', 'd-sharp-minor', 'c-sharp-seven-high', 'f-sharp',
  'f-sharp', 'f', 'e-flat', 'a-flat-seven',
];

// Measures 72–100: the five-flat final section and coda.
const D_FLAT_MAJOR_HARMONY: ChordId[] = [
  'd-flat', 'd-flat', 'g-flat-over-d-flat', 'd-flat', 'd-flat', 'd-flat', 'a-flat-seven', 'd-flat',
  'b-flat-minor', 'g-flat', 'd-flat-over-f', 'a-flat-seven', 'b-flat-minor', 'g-flat', 'd-flat', 'a-flat-seven',
  'b-flat-minor', 'g-flat', 'd-flat', 'a-flat-seven', 'e-flat-minor', 'b-flat-minor', 'g-flat', 'a-flat-seven',
  'd-flat', 'g-flat-over-d-flat', 'a-flat-seven', 'd-flat', 'd-flat',
];

const HARMONY = [...E_MAJOR_HARMONY, ...F_SHARP_MAJOR_HARMONY, ...D_FLAT_MAJOR_HARMONY];

const fingerForPitch = (midis: number[], midi: number, hand: Hand): MiaSebastianFinger => {
  const pitches = [...new Set(midis)].sort((left, right) => left - right);
  if (pitches.length === 1) return hand === 'right' ? 3 : 5;
  const rank = pitches.indexOf(midi);
  const position = Math.round(rank * 4 / (pitches.length - 1));
  return (hand === 'right' ? position + 1 : 5 - position) as MiaSebastianFinger;
};

const sequenceNotes = (measureIndex: number, midis: number[], durations: number[], hand: Hand): MiaSebastianNote[] => {
  let offset = 0;
  return midis.map((midi, index) => {
    const duration = durations[index];
    const note = { midi, beat: measureIndex * 3 + offset, duration, hand, finger: fingerForPitch(midis, midi, hand) };
    offset += duration;
    return note;
  });
};

const evenNotes = (measureIndex: number, midis: number[], duration: number, hand: Hand) => sequenceNotes(measureIndex, midis, midis.map(() => duration), hand);

const simultaneousNotes = (measureIndex: number, midis: number[], offset: number, duration: number, hand: Hand): MiaSebastianNote[] => midis.map((midi) => ({
  midi,
  beat: measureIndex * 3 + offset,
  duration,
  hand,
  finger: fingerForPitch(midis, midi, hand),
}));

const themeFigure = (measureIndex: number, transpose: number, variant: number): MiaSebastianNote[] => {
  const figures = [
    [68, 69, 71, 73, 71, 69],
    [68, 69, 71, 73, 75, 73],
    [68, 71, 73, 76, 73, 71],
    [76, 75, 73, 71, 69, 68],
  ];
  return evenNotes(measureIndex, figures[variant % figures.length].map((midi) => midi + transpose), .5, 'right');
};

const heldThemeNote = (measureIndex: number, transpose: number, degree = 0): MiaSebastianNote[] => simultaneousNotes(measureIndex, [68 + transpose + degree], 0, 3, 'right');

const rightArpeggio = (measureIndex: number, chord: ChordDefinition, density: 6 | 9 | 12, octaveShift = 0): MiaSebastianNote[] => {
  const [low, middle, high] = chord.right;
  const figures: Record<6 | 9 | 12, number[]> = {
    6: [low, middle, high, middle, high, middle],
    9: [low, middle, high, middle, high, high + 12, high, middle, low],
    12: [low, middle, high, middle, low + 12, middle + 12, high + 12, middle + 12, low + 12, high, middle, low],
  };
  return evenNotes(measureIndex, figures[density].map((midi) => midi + octaveShift), 3 / density, 'right');
};

const rightChordPulses = (measureIndex: number, chord: ChordDefinition, octaveShift = 0, accented = false): MiaSebastianNote[] => [0, 1, 2].flatMap((offset) => simultaneousNotes(
  measureIndex,
  chord.right.map((midi) => midi + octaveShift),
  offset,
  accented ? .9 : .75,
  'right',
));

const leftBassAndChord = (measureIndex: number, chord: ChordDefinition): MiaSebastianNote[] => [
  ...simultaneousNotes(measureIndex, [chord.bass], 0, 1, 'left'),
  ...simultaneousNotes(measureIndex, chord.voicing, 1, 2, 'left'),
];

const leftArpeggio = (measureIndex: number, chord: ChordDefinition, density: 6 | 9 | 12): MiaSebastianNote[] => {
  const tones = chord.voicing;
  const figures: Record<6 | 9 | 12, number[]> = {
    6: [chord.bass, tones[0], tones[1], tones.at(-1)!, tones[1], tones[0]],
    9: [chord.bass, tones[0], tones[1], tones.at(-1)!, tones[1], tones[0], tones[1], tones.at(-1)!, tones[1]],
    12: [chord.bass, tones[0], tones[1], tones.at(-1)!, tones[0], tones[1], tones.at(-1)!, tones[1], chord.bass + 12, tones[0], tones[1], tones.at(-1)!],
  };
  return evenNotes(measureIndex, figures[density], 3 / density, 'left');
};

const leftChordPulses = (measureIndex: number, chord: ChordDefinition): MiaSebastianNote[] => [0, 1, 2].flatMap((offset) => [
  ...simultaneousNotes(measureIndex, [offset === 0 ? chord.bass : chord.bass + 12], offset, .85, 'left'),
  ...simultaneousNotes(measureIndex, chord.voicing, offset, .85, 'left'),
]);

const rightForMeasure = (measureIndex: number, chord: ChordDefinition): MiaSebastianNote[] => {
  const measure = measureIndex + 1;

  if (measure <= 16) {
    const position = measureIndex % 8;
    if (position === 0 || position === 2 || position === 4) return themeFigure(measureIndex, 0, position / 2);
    if (position === 6) return themeFigure(measureIndex, 0, 3);
    return heldThemeNote(measureIndex, 0, position === 3 ? 3 : 0);
  }
  if (measure <= 30) return measure % 4 === 0 ? rightChordPulses(measureIndex, chord) : rightArpeggio(measureIndex, chord, 6);
  if (measure <= 35) {
    const transition = [
      [68, 71, 73, 75, 73, 71],
      [69, 72, 74, 76, 74, 72],
      [70, 73, 75, 77, 75, 73],
      [71, 74, 76, 78, 76, 74],
      [73, 75, 77, 80, 77, 75],
    ];
    return evenNotes(measureIndex, transition[measure - 31], .5, 'right');
  }
  if (measure <= 50) {
    const position = (measure - 36) % 8;
    if ([0, 2, 4, 6].includes(position)) return themeFigure(measureIndex, 2, position / 2);
    return rightArpeggio(measureIndex, chord, position === 7 ? 9 : 6);
  }
  if (measure <= 60) return measure % 2 === 0 ? rightChordPulses(measureIndex, chord, 0, true) : rightArpeggio(measureIndex, chord, 9);
  if (measure <= 67) return rightChordPulses(measureIndex, chord, measure >= 65 ? 12 : 0, true);
  if (measure <= 71) return rightChordPulses(measureIndex, chord, 0, true);
  if (measure <= 80) return measure % 2 === 0 ? rightArpeggio(measureIndex, chord, 12, 12) : rightChordPulses(measureIndex, chord, 12, true);
  if (measure <= 90) return measure % 3 === 0 ? rightArpeggio(measureIndex, chord, 12, 12) : rightChordPulses(measureIndex, chord, 12, true);
  if (measure < 100) {
    const position = (measure - 91) % 8;
    return position % 2 === 0 ? themeFigure(measureIndex, -3, Math.floor(position / 2)) : rightArpeggio(measureIndex, chord, 6);
  }
  return simultaneousNotes(measureIndex, [61, 65, 68, 73], 0, 3, 'right');
};

const leftForMeasure = (measureIndex: number, chord: ChordDefinition): MiaSebastianNote[] => {
  const measure = measureIndex + 1;
  if (measure <= 16) return measure % 2 === 0 ? leftBassAndChord(measureIndex, chord) : leftArpeggio(measureIndex, chord, 6);
  if (measure <= 35) return measure % 4 === 0 ? leftBassAndChord(measureIndex, chord) : leftArpeggio(measureIndex, chord, 6);
  if (measure <= 60) return leftArpeggio(measureIndex, chord, measure % 3 === 0 ? 9 : 6);
  if (measure <= 71) return measure >= 68 ? leftChordPulses(measureIndex, chord) : leftArpeggio(measureIndex, chord, 12);
  if (measure <= 80) return leftArpeggio(measureIndex, chord, 12);
  if (measure <= 90) return measure % 2 === 0 ? leftChordPulses(measureIndex, chord) : leftArpeggio(measureIndex, chord, 12);
  if (measure < 100) return leftArpeggio(measureIndex, chord, 6);
  return [
    ...simultaneousNotes(measureIndex, [25, 37], 0, 3, 'left'),
    ...simultaneousNotes(measureIndex, chord.voicing, 0, 3, 'left'),
  ];
};

const sortNotes = (notes: MiaSebastianNote[]) => notes.sort((left, right) => left.beat - right.beat || left.midi - right.midi);

// Complete 100-measure piano-roll adaptation of the Leiki Ueda arrangement
// supplied by the user. The roll keeps both hands, the 3/4 form, the three key
// areas, the triplet/sixteenth-note accelerations, octave writing and full coda.
export const MIA_SEBASTIAN_FULL_NOTES = sortNotes(HARMONY.flatMap((chordId, measureIndex) => {
  const chord = CHORDS[chordId];
  return [...rightForMeasure(measureIndex, chord), ...leftForMeasure(measureIndex, chord)];
}));

const noteRangeKey = (note: MiaSebastianNote) => `${note.hand}-${Math.floor(note.beat / 3)}`;
const measureHandRanges = new Map<string, { lowest: number; highest: number }>();
for (const note of MIA_SEBASTIAN_FULL_NOTES) {
  const key = noteRangeKey(note);
  const range = measureHandRanges.get(key) ?? { lowest: note.midi, highest: note.midi };
  range.lowest = Math.min(range.lowest, note.midi);
  range.highest = Math.max(range.highest, note.midi);
  measureHandRanges.set(key, range);
}

// Same complete performance mapped measure by measure to C2–C6. Moving a
// whole hand passage preserves its contour, rhythm and fingering relationships.
export const MIA_SEBASTIAN_49_KEY_NOTES = MIA_SEBASTIAN_FULL_NOTES.map((note) => {
  const range = measureHandRanges.get(noteRangeKey(note))!;
  let octaveShift = 0;
  while (range.lowest + octaveShift < 36) octaveShift += 12;
  while (range.highest + octaveShift > 84) octaveShift -= 12;
  return { ...note, midi: note.midi + octaveShift };
});

export const MIA_SEBASTIAN_CHORD_PROGRESSION: MiaSebastianChordStep[] = HARMONY.map((chordId, measureIndex) => {
  const chord = CHORDS[chordId];
  return {
    beat: measureIndex * 3,
    name: chord.name,
    midis: chord.voicing,
    fingers: chord.voicing.map((midi) => fingerForPitch(chord.voicing, midi, 'left')),
  };
});
