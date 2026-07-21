import type { PianoKeyboardSize } from './types';

export interface PianoExercise {
  id: string;
  title: string;
  kind: 'song' | 'exercise';
  artist?: string;
  arrangement?: string;
  level: 'Très simple' | 'Simple' | 'Modéré';
  bpm: number;
  hand: 'right' | 'both';
  notes: Array<{ midi: number; beat: number; duration: number; hand?: 'right' | 'left'; finger?: PianoFinger }>;
  lyrics?: PianoLyricLine[];
}

export interface PianoLyricLine {
  beat: number;
  text: string;
  section: string;
}

export interface PianoSong {
  id: string;
  title: string;
  artist?: string;
  levels: PianoExercise[];
}

export interface PianoChordStep {
  beat: number;
  name: string;
  midis: number[];
  fingers: number[];
}

export interface PianoChordExercise {
  id: string;
  songTitle: string;
  artist?: string;
  progression: PianoChordStep[];
}

type PianoNote = PianoExercise['notes'][number];
export type PianoFinger = 1 | 2 | 3 | 4 | 5;
type PianoHarmonyStep = { beat: number; name: string; root: number; intervals: number[]; fingers: PianoFinger[] };
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

const C_POSITION_FINGERS: Record<number, PianoFinger> = { 0: 1, 1: 1, 2: 2, 3: 2, 4: 3, 5: 4, 6: 4, 7: 5, 8: 5, 9: 5, 10: 5, 11: 5 };
const MY_WAY_FINGERS: Record<number, PianoFinger> = {
  60: 1, 62: 2, 64: 3,
  65: 1, 66: 1, 67: 2, 68: 3, 69: 3, 70: 4,
  72: 1, 74: 2, 75: 3, 76: 3, 77: 4, 79: 5, 81: 5,
};
const BREL_FINGERS: Record<number, PianoFinger> = {
  58: 1, 59: 1, 60: 1, 61: 1, 62: 2, 63: 2, 64: 3, 65: 4,
  66: 4, 67: 5, 69: 2, 70: 3, 71: 4, 72: 1, 74: 2,
};

const withRightHandFingerings = (notes: PianoNote[], profile: 'c-position' | 'my-way' | 'brel' = 'c-position') => notes.map((note) => ({
  ...note,
  finger: profile === 'my-way' ? MY_WAY_FINGERS[note.midi] ?? C_POSITION_FINGERS[note.midi % 12] : profile === 'brel' ? BREL_FINGERS[note.midi] ?? C_POSITION_FINGERS[note.midi % 12] : C_POSITION_FINGERS[note.midi % 12],
}));

const shiftNotes = (notes: PianoNote[], beats: number) => notes.map((note) => ({ ...note, beat: note.beat + beats }));
const shiftHarmony = (steps: PianoHarmonyStep[], beats: number) => steps.map((step) => ({ ...step, beat: step.beat + beats }));

// The supplied score repeats the complete 26-measure form. The first ending
// contains the pickup into the repeat; the second ending closes on F.
const MY_WAY_EASY_COMMON = timedNotes([
  [60, 0, 1],
  [69, 1, 3], [69, 5, 3], [69, 9, 3],
  [67, 13, 1], [66, 14, 2], [62, 16, 1],
  [70, 17, 3], [70, 21, 3], [70, 25, 3],
  [69, 29, 2], [67, 31, 2], [69, 33, 3],
  [70, 37, 3], [70, 41, 1], [69, 42, 2], [67, 44, 1],
  [69, 45, 3], [67, 49, 3], [65, 53, 4],
  [65, 57, 2], [69, 59, 2], [69, 61, 2],
  [72, 63.5, .5], [70, 64, .5], [68, 64.5, .5],
  [69, 65, 3], [74, 69, 3], [74, 73, 3],
  [76, 77, 3], [76, 81, 3], [79, 85, 3], [76, 89, 3],
  [76, 93, 3], [76, 97, 3], [79, 101, 4],
]);

const MY_WAY_EASY = [
  ...MY_WAY_EASY_COMMON,
  { midi: 77, beat: 105, duration: 3 },
  { midi: 60, beat: 108, duration: 1 },
  ...shiftNotes(MY_WAY_EASY_COMMON.filter((note) => note.beat >= 1), 108),
  { midi: 77, beat: 213, duration: 3 },
];

const MY_WAY_COMMON_MELODY = timedNotes([
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
  [69, 65, 2], [69, 67.5, .5], [70, 68, .5], [72, 68.5, .5],
  [74, 69, 2], [72, 71, .5], [72, 71.5, .5], [74, 72, .5], [72, 72.5, .5],
  [74, 73, 2], [72, 75.5, .5], [75, 76, .5], [77, 76.5, .5],
  [76, 77, 2], [72, 79.5, .5], [79, 80, .5], [72, 80.5, .5],
  [76, 81, 2], [76, 83.5, .5], [77, 84, .5], [79, 84.5, .5],
  [79, 85, 2], [81, 87.5, .5], [76, 88, .5], [79, 88.5, .5],
  [76, 89, 2], [72, 91.5, .5], [76, 92, .5], [77, 92.5, .5],
  [76, 93, 2], [72, 95.5, .5], [77, 96, .5], [72, 96.5, .5],
  [76, 97, 2], [76, 99.5, .5], [77, 100, .5], [79, 100.5, .5],
  [79, 101, 4],
]);

const MY_WAY_MELODY = [
  ...MY_WAY_COMMON_MELODY,
  { midi: 77, beat: 105, duration: 3 },
  { midi: 60, beat: 108, duration: 1 },
  ...shiftNotes(MY_WAY_COMMON_MELODY.filter((note) => note.beat >= 1), 108),
  { midi: 77, beat: 213, duration: 3 },
];

const MY_WAY_COMMON_HARMONY: PianoHarmonyStep[] = [
  { beat: 1, name: 'Fa majeur', root: 41, intervals: [0, 4, 7], fingers: [5, 3, 1] },
  { beat: 5, name: 'La mineur', root: 45, intervals: [0, 3, 7], fingers: [5, 3, 1] },
  { beat: 9, name: 'Do mineur', root: 48, intervals: [0, 3, 7], fingers: [5, 3, 1] },
  { beat: 13, name: 'Ré 7', root: 50, intervals: [0, 4, 10], fingers: [5, 2, 1] },
  { beat: 17, name: 'Sol mineur', root: 43, intervals: [0, 3, 7], fingers: [5, 3, 1] },
  { beat: 21, name: 'Sol mineur 7', root: 43, intervals: [0, 3, 7, 10], fingers: [5, 3, 2, 1] },
  { beat: 25, name: 'Do 7', root: 48, intervals: [0, 4, 10], fingers: [5, 2, 1] },
  { beat: 29, name: 'Fa majeur', root: 41, intervals: [0, 4, 7], fingers: [5, 3, 1] },
  { beat: 33, name: 'Fa 7', root: 41, intervals: [0, 4, 10], fingers: [5, 2, 1] },
  { beat: 37, name: 'Si♭ majeur', root: 46, intervals: [0, 4, 7], fingers: [5, 3, 1] },
  { beat: 41, name: 'Si♭ mineur', root: 46, intervals: [0, 3, 7], fingers: [5, 3, 1] },
  { beat: 45, name: 'Fa majeur', root: 41, intervals: [0, 4, 7], fingers: [5, 3, 1] },
  { beat: 49, name: 'Do 7', root: 48, intervals: [0, 4, 10], fingers: [5, 2, 1] },
  { beat: 53, name: 'Si♭ mineur', root: 46, intervals: [0, 3, 7], fingers: [5, 3, 1] },
  { beat: 57, name: 'Fa majeur', root: 41, intervals: [0, 4, 7], fingers: [5, 3, 1] },
  { beat: 61, name: 'Fa majeur', root: 41, intervals: [0, 4, 7], fingers: [5, 3, 1] },
  { beat: 65, name: 'Fa 7', root: 41, intervals: [0, 4, 10], fingers: [5, 2, 1] },
  { beat: 69, name: 'Si♭ majeur', root: 46, intervals: [0, 4, 7], fingers: [5, 3, 1] },
  { beat: 73, name: 'Si♭ majeur', root: 46, intervals: [0, 4, 7], fingers: [5, 3, 1] },
  { beat: 77, name: 'Sol mineur 7', root: 43, intervals: [0, 3, 7, 10], fingers: [5, 3, 2, 1] },
  { beat: 81, name: 'Do 7', root: 48, intervals: [0, 4, 10], fingers: [5, 2, 1] },
  { beat: 85, name: 'La mineur 7', root: 45, intervals: [0, 3, 7, 10], fingers: [5, 3, 2, 1] },
  { beat: 89, name: 'Ré mineur', root: 50, intervals: [0, 3, 7], fingers: [5, 3, 1] },
  { beat: 93, name: 'Sol mineur 7', root: 43, intervals: [0, 3, 7, 10], fingers: [5, 3, 2, 1] },
  { beat: 97, name: 'Do 7', root: 48, intervals: [0, 4, 10], fingers: [5, 2, 1] },
  { beat: 101, name: 'Si♭ mineur', root: 46, intervals: [0, 3, 7], fingers: [5, 3, 1] },
];

const MY_WAY_HARMONY: PianoHarmonyStep[] = [
  ...MY_WAY_COMMON_HARMONY,
  { beat: 105, name: 'Fa majeur', root: 41, intervals: [0, 4, 7], fingers: [5, 3, 1] },
  ...shiftHarmony(MY_WAY_COMMON_HARMONY, 108),
  { beat: 213, name: 'Fa majeur', root: 41, intervals: [0, 4, 7], fingers: [5, 3, 1] },
];

const MY_WAY_TWO_HANDS = [
  ...withRightHandFingerings(MY_WAY_MELODY, 'my-way').map((note) => ({ ...note, hand: 'right' as const })),
  ...MY_WAY_HARMONY.flatMap(({ beat, root, intervals, fingers }) => [
    { midi: root, beat, duration: 1.5, hand: 'left' as const, finger: 5 as const },
    ...intervals.map((interval, index) => ({ midi: root + interval, beat: beat + 2, duration: 1.5, hand: 'left' as const, finger: fingers[index] })),
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
  [72, 22, 1.5], [67, 24, 1], [72, 25, 3],
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
  [72, 22, 1.5], [67, 24, 1], [72, 25, 3],
]);

const SE_CANTA_HARMONY: PianoHarmonyStep[] = [
  { beat: 1, name: 'Do majeur', root: 48, intervals: [0, 4, 7], fingers: [5, 3, 1] },
  { beat: 4, name: 'Do majeur', root: 48, intervals: [0, 4, 7], fingers: [5, 3, 1] },
  { beat: 7, name: 'Do majeur', root: 48, intervals: [0, 4, 7], fingers: [5, 3, 1] },
  { beat: 10, name: 'Sol majeur', root: 43, intervals: [0, 4, 7], fingers: [5, 3, 1] },
  { beat: 13, name: 'Fa majeur', root: 41, intervals: [0, 4, 7], fingers: [5, 3, 1] },
  { beat: 16, name: 'Do majeur', root: 48, intervals: [0, 4, 7], fingers: [5, 3, 1] },
  { beat: 19, name: 'Sol majeur', root: 43, intervals: [0, 4, 7], fingers: [5, 3, 1] },
  { beat: 22, name: 'Do majeur', root: 48, intervals: [0, 4, 7], fingers: [5, 3, 1] },
  { beat: 25, name: 'Do majeur', root: 48, intervals: [0, 4, 7], fingers: [5, 3, 1] },
];

const SE_CANTA_TWO_HANDS = [
  ...withRightHandFingerings(SE_CANTA_MELODY).map((note) => ({ ...note, hand: 'right' as const })),
  ...SE_CANTA_HARMONY.flatMap(({ beat, root, intervals, fingers }) => [
    { midi: root, beat, duration: 1, hand: 'left' as const, finger: 5 as const },
    ...intervals.map((interval, index) => ({ midi: root + interval, beat: beat + 1, duration: beat === 22 ? 1 : 2, hand: 'left' as const, finger: fingers[index] })),
  ]),
].sort((left, right) => left.beat - right.beat || left.midi - right.midi);

// Complete pedagogical form from the supplied two-page score: A-B-A-B-A.
// Every measure keeps the score's 3/4 pulse (quarter note, then four eighths).
// The melody uses the supplied score's compact C-minor teaching range; the
// advanced harmony transposes the supplied TuneScribers progression to match it.
type WaltzMeasure = number[];

const BREL_A_MEASURES: WaltzMeasure[] = [
  [60, 60, 60, 62, 60], [60, 60, 60, 62, 60], [60, 60, 60, 62, 60],
  [60, 60, 60, 62, 60], [60, 60, 60, 62, 60], [60, 60, 60, 62, 60],
  [60, 60, 60, 62, 60], [60, 60, 60, 62, 60], [59, 59, 59, 60, 59],
  [59, 59, 59, 60, 59], [60, 60, 60, 62, 60], [60, 60, 60, 62, 60],
  [60, 60, 60, 62, 60], [59, 59, 59, 60, 59], [60, 60, 60, 62, 60],
];

const BREL_B_MEASURES: WaltzMeasure[] = [
  [60, 60, 62, 64], [65, 65, 65, 67, 65], [69, 69, 69, 67, 65],
  [67, 67, 67, 64, 60], [65, 60, 60, 62, 64], [67, 67, 67, 69, 67],
  [71, 71, 71, 69, 67], [65, 65, 60, 65, 64], [62, 62, 65, 67, 69],
  [60, 60, 60, 64, 60], [59, 59, 59, 62, 59], [57, 57, 57, 55, 57],
  [57, 57, 57, 57, 59], [60, 60, 60, 62, 60], [59, 59, 59, 60, 59],
  [57, 57, 57, 59, 57], [57],
];

const waltzMelody = (measures: WaltzMeasure[]) => measures.flatMap((measure, measureIndex) => {
  if (measure.length === 1) return [{ midi: measure[0], beat: measureIndex * 3, duration: 3 }];
  const pickup = measure.length === 4;
  return measure.map((midi, noteIndex) => ({
    midi,
    beat: measureIndex * 3 + (pickup ? 1 + noteIndex * .5 : noteIndex === 0 ? 0 : 1 + (noteIndex - 1) * .5),
    duration: pickup || noteIndex > 0 ? .5 : 1,
  }));
});

const simplifiedWaltzMelody = (measures: WaltzMeasure[]) => measures.flatMap((measure, measureIndex) => {
  if (measure.length === 1) return [{ midi: measure[0], beat: measureIndex * 3, duration: 3 }];
  if (measure.length === 4) return [
    { midi: measure[0], beat: measureIndex * 3 + 1, duration: 1 },
    { midi: measure[2], beat: measureIndex * 3 + 2, duration: 1 },
  ];
  return [
    { midi: measure[0], beat: measureIndex * 3, duration: 1.5 },
    { midi: measure[2], beat: measureIndex * 3 + 1.5, duration: 1.5 },
  ];
});

const BREL_A_MELODY = waltzMelody(BREL_A_MEASURES);
const BREL_B_MELODY = waltzMelody(BREL_B_MEASURES);
const BREL_A_EASY = simplifiedWaltzMelody(BREL_A_MEASURES);
const BREL_B_EASY = simplifiedWaltzMelody(BREL_B_MEASURES);
const BREL_MELODY = [
  ...shiftNotes(BREL_A_MELODY, 9), ...shiftNotes(BREL_B_MELODY, 54),
  ...shiftNotes(BREL_A_MELODY, 105), ...shiftNotes(BREL_B_MELODY, 150),
  ...shiftNotes(BREL_A_MELODY, 201),
];
const BREL_EASY = [
  ...shiftNotes(BREL_A_EASY, 9), ...shiftNotes(BREL_B_EASY, 54),
  ...shiftNotes(BREL_A_EASY, 105), ...shiftNotes(BREL_B_EASY, 150),
  ...shiftNotes(BREL_A_EASY, 201),
];

const BREL_VERSE_1 = [
  'Il faut oublier', 'Tout peut s’oublier', 'Qui s’enfuit déjà', 'Oublier le temps',
  'Des malentendus', 'Et le temps perdu', 'À savoir comment', 'Oublier ces heures',
  'Qui tuaient parfois', 'À coups de pourquoi', 'Le cœur du bonheur',
  'Ne me quitte pas', 'Ne me quitte pas', 'Ne me quitte pas', 'Ne me quitte pas',
];
const BREL_VERSE_2 = [
  'Moi, je t’offrirai', 'Des perles de pluie', 'Venues de pays', 'Où il ne pleut pas',
  'Je creuserai la terre', 'Jusqu’après ma mort', 'Pour couvrir ton corps', 'D’or et de lumière',
  ['Je ferai', 'un domaine'].join(' '),
  ['Où l’amour', 'sera roi'].join(' '),
  ['Où l’amour', 'sera loi'].join(' '),
  'Où tu seras reine',
  'Ne me quitte pas', 'Ne me quitte pas', 'Ne me quitte pas', 'Ne me quitte pas',
];
const BREL_VERSE_3 = [
  'Je t’inventerai', 'Des mots insensés', 'Que tu comprendras', 'Je te parlerai',
  'De ces amants-là',
  'Qui ont vu deux fois',
  'Leurs cœurs s’embraser',
  'Je te raconterai',
  'L’histoire de ce roi',
  'Mort de n’avoir pas',
  'Pu te rencontrer',
  'Ne me quitte pas', 'Ne me quitte pas', 'Ne me quitte pas', 'Ne me quitte pas',
];
const BREL_VERSE_4 = [
  'On a vu souvent', 'Rejaillir le feu', 'De l’ancien volcan', 'Qu’on croyait trop vieux',
  'Il est paraît-il',
  'Des terres brûlées',
  'Donnant plus de blé',
  'Qu’un meilleur avril',
  'Et quand vient le soir',
  'Pour qu’un ciel flamboie',
  'Le rouge et le noir',
  'Ne s’épousent-ils pas',
  'Ne me quitte pas', 'Ne me quitte pas', 'Ne me quitte pas', 'Ne me quitte pas',
];
const BREL_VERSE_5_PARTS = [
  'Je n’vais plus pleurer', 'Je n’vais plus parler', 'Je me cacherai là', 'À te regarder',
  'Danser', 'et sourire',
  'Et à t’écouter',
  'Chanter et puis rire',
  'Laisse-moi devenir',
  'L’ombre de ton ombre',
  'L’ombre de ta main',
  'L’ombre de ton chien',
  'Ne me quitte pas', 'Ne me quitte pas', 'Ne me quitte pas', 'Ne me quitte pas',
];
const BREL_VERSE_5 = [...BREL_VERSE_5_PARTS.slice(0, 4), BREL_VERSE_5_PARTS.slice(4, 6).join(' '), ...BREL_VERSE_5_PARTS.slice(6)];

const brelLyricMeasures = (startBeat: number, section: string, lines: string[], pickup = false): PianoLyricLine[] => lines.map((text, index) => ({
  beat: startBeat + (pickup && index === 0 ? 1 : index * 3),
  text,
  section,
}));
const BREL_LYRICS: PianoLyricLine[] = [
  { beat: 7, text: 'Ne me quitte pas', section: 'Couplet 1' },
  ...brelLyricMeasures(9, 'Couplet 1', BREL_VERSE_1),
  ...brelLyricMeasures(54, 'Couplet 2', BREL_VERSE_2, true),
  { beat: 102, text: 'Ne me quitte pas', section: 'Couplet 3' },
  ...brelLyricMeasures(105, 'Couplet 3', BREL_VERSE_3),
  ...brelLyricMeasures(150, 'Couplet 4', BREL_VERSE_4, true),
  { beat: 198, text: 'Ne me quitte pas', section: 'Couplet 5' },
  ...brelLyricMeasures(201, 'Couplet 5', BREL_VERSE_5),
];

type BrelChordName = 'c-minor' | 'b-flat-major' | 'f-minor-over-a-flat' | 'a-flat-major' | 'g-seven' | 'e-flat-major' | 'f-minor';
const BREL_CHORDS: Record<BrelChordName, Omit<PianoHarmonyStep, 'beat'>> = {
  'c-minor': { name: 'Do mineur', root: 48, intervals: [0, 3, 7], fingers: [5, 3, 1] },
  'b-flat-major': { name: 'Si♭ majeur', root: 46, intervals: [0, 4, 7], fingers: [5, 3, 1] },
  'f-minor-over-a-flat': { name: 'Fa mineur / La♭', root: 44, intervals: [0, 4, 9], fingers: [5, 3, 1] },
  'a-flat-major': { name: 'La♭ majeur', root: 44, intervals: [0, 4, 7], fingers: [5, 3, 1] },
  'g-seven': { name: 'Sol 7', root: 43, intervals: [0, 4, 7, 10], fingers: [5, 3, 2, 1] },
  'e-flat-major': { name: 'Mi♭ majeur', root: 51, intervals: [0, 4, 7], fingers: [5, 3, 1] },
  'f-minor': { name: 'Fa mineur', root: 41, intervals: [0, 3, 7], fingers: [5, 3, 1] },
};
const BREL_A_CHORDS: BrelChordName[] = [
  'c-minor', 'b-flat-major', 'f-minor-over-a-flat', 'b-flat-major', 'a-flat-major',
  'g-seven', 'c-minor', 'c-minor', 'b-flat-major', 'f-minor-over-a-flat',
  'b-flat-major', 'a-flat-major', 'g-seven', 'c-minor', 'c-minor',
];
const BREL_B_CHORDS: BrelChordName[] = [
  'c-minor', 'c-minor', 'b-flat-major', 'b-flat-major', 'a-flat-major',
  'a-flat-major', 'g-seven', 'g-seven', 'c-minor', 'e-flat-major',
  'a-flat-major', 'f-minor', 'g-seven', 'c-minor', 'g-seven',
  'c-minor', 'c-minor',
];
const brelHarmonyPhrase = (chords: BrelChordName[], startBeat: number): PianoHarmonyStep[] => chords.map((chord, index) => ({ beat: startBeat + index * 3, ...BREL_CHORDS[chord] }));
const BREL_HARMONY = [
  ...brelHarmonyPhrase(BREL_A_CHORDS, 9), ...brelHarmonyPhrase(BREL_B_CHORDS, 54),
  ...brelHarmonyPhrase(BREL_A_CHORDS, 105), ...brelHarmonyPhrase(BREL_B_CHORDS, 150),
  ...brelHarmonyPhrase(BREL_A_CHORDS, 201),
];
const BREL_TWO_HANDS = [
  ...withRightHandFingerings(BREL_MELODY, 'brel').map((note) => ({ ...note, hand: 'right' as const })),
  ...BREL_HARMONY.flatMap(({ beat, root, intervals, fingers }) => [
    { midi: root, beat, duration: 1, hand: 'left' as const, finger: 5 as const },
    ...intervals.map((interval, index) => ({ midi: root + interval, beat: beat + 1, duration: 2, hand: 'left' as const, finger: fingers[index] })),
  ]),
].sort((left, right) => left.beat - right.beat || left.midi - right.midi);

const harmonyToChordProgression = (steps: PianoHarmonyStep[]): PianoChordStep[] => steps.map(({ beat, name, root, intervals, fingers }) => ({ beat, name, midis: intervals.map((interval) => root + interval), fingers }));

export const PIANO_CHORD_EXERCISES: PianoChordExercise[] = [
  { id: 'my-way-chords', songTitle: 'My Way', artist: 'Frank Sinatra', progression: harmonyToChordProgression(MY_WAY_HARMONY) },
  { id: 'se-canta-chords', songTitle: 'Se Canta', artist: 'Traditionnel occitan', progression: harmonyToChordProgression(SE_CANTA_HARMONY) },
  { id: 'ne-me-quitte-pas-chords', songTitle: 'Ne me quitte pas', artist: 'Jacques Brel', progression: harmonyToChordProgression(BREL_HARMONY) },
];

export function pianoChordExerciseForSong(title: string, artist?: string) {
  return PIANO_CHORD_EXERCISES.find((exercise) => exercise.songTitle === title && exercise.artist === artist);
}

export const PIANO_EXERCISES: PianoExercise[] = [
  { id: 'piano-morning-walk', title: 'Promenade du matin', kind: 'exercise', arrangement: 'Régularité et déplacements de la main droite', level: 'Modéré', bpm: 80, hand: 'right', notes: withRightHandFingerings(phrase([60, 62, 64, 65, 67, 69, 67, 65, 64, 62, 60, 64, 67, 69, 67, 64, 62, 65, 69, 67, 65, 64, 62, 60], [1, 1, .5, .5, 1, 2, 1, 1, .5, .5, 2, 1, 1, 2, .5, .5, 1, 1, 1, 2, .5, .5, 1, 2])) },
  { id: 'my-way-beginner', title: 'My Way', kind: 'song', artist: 'Frank Sinatra', arrangement: 'Niveau 1 · Mélodie simplifiée', level: 'Très simple', bpm: 54, hand: 'right', notes: withRightHandFingerings(MY_WAY_EASY, 'my-way') },
  { id: 'my-way-intermediate', title: 'My Way', kind: 'song', artist: 'Frank Sinatra', arrangement: 'Niveau 2 · Mélodie complète', level: 'Simple', bpm: 64, hand: 'right', notes: withRightHandFingerings(MY_WAY_MELODY, 'my-way') },
  { id: 'my-way-advanced', title: 'My Way', kind: 'song', artist: 'Frank Sinatra', arrangement: 'Niveau 3 · Mélodie et accompagnement', level: 'Modéré', bpm: 72, hand: 'both', notes: MY_WAY_TWO_HANDS },
  { id: 'se-canta-beginner', title: 'Se Canta', kind: 'song', artist: 'Traditionnel occitan', arrangement: 'Niveau 1 · Thème simplifié', level: 'Très simple', bpm: 54, hand: 'right', notes: withRightHandFingerings(SE_CANTA_EASY) },
  { id: 'se-canta-intermediate', title: 'Se Canta', kind: 'song', artist: 'Traditionnel occitan', arrangement: 'Niveau 2 · Mélodie complète', level: 'Simple', bpm: 64, hand: 'right', notes: withRightHandFingerings(SE_CANTA_MELODY) },
  { id: 'se-canta-advanced', title: 'Se Canta', kind: 'song', artist: 'Traditionnel occitan', arrangement: 'Niveau 3 · Mélodie et accompagnement', level: 'Modéré', bpm: 72, hand: 'both', notes: SE_CANTA_TWO_HANDS },
  { id: 'ne-me-quitte-pas-beginner', title: 'Ne me quitte pas', kind: 'song', artist: 'Jacques Brel', arrangement: 'Niveau 1 · Mélodie simplifiée', level: 'Très simple', bpm: 52, hand: 'right', notes: withRightHandFingerings(BREL_EASY, 'brel'), lyrics: BREL_LYRICS },
  { id: 'ne-me-quitte-pas-intermediate', title: 'Ne me quitte pas', kind: 'song', artist: 'Jacques Brel', arrangement: 'Niveau 2 · Mélodie complète', level: 'Simple', bpm: 62, hand: 'right', notes: withRightHandFingerings(BREL_MELODY, 'brel'), lyrics: BREL_LYRICS },
  { id: 'ne-me-quitte-pas-advanced', title: 'Ne me quitte pas', kind: 'song', artist: 'Jacques Brel', arrangement: 'Niveau 3 · Mélodie et accompagnement', level: 'Modéré', bpm: 70, hand: 'both', notes: BREL_TWO_HANDS, lyrics: BREL_LYRICS },
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

export const PIANO_TECHNIQUE_EXERCISES = PIANO_EXERCISES.filter((exercise) => exercise.kind === 'exercise');
export const PIANO_SONGS = groupPianoExercises(PIANO_EXERCISES.filter((exercise) => exercise.kind === 'song'));

export function pianoLyricCueAtBeat(lyrics: PianoLyricLine[], beat: number) {
  let currentIndex = -1;
  for (let index = 0; index < lyrics.length && lyrics[index].beat <= beat; index += 1) currentIndex = index;
  return {
    current: currentIndex >= 0 ? lyrics[currentIndex] : null,
    next: lyrics[currentIndex + 1] ?? null,
  };
}

export function pianoNotesForHand(notes: PianoExercise['notes'], hand: PianoPracticeHand) {
  if (hand === 'both') return notes;
  return notes.filter((note) => (note.hand ?? 'right') === hand);
}

export function pianoNotesForMode(exercise: PianoExercise, mode: PianoPlayMode, hand: PianoPracticeHand) {
  if (exercise.hand !== 'both' || mode === 'game') return exercise.notes;
  return pianoNotesForHand(exercise.notes, hand === 'left' ? 'left' : 'right');
}

export function pianoHandChoicesForMode(exercise: PianoExercise, mode: PianoPlayMode): PianoPracticeHand[] {
  if (exercise.hand !== 'both') return ['right'];
  return mode === 'game' ? ['both'] : ['right', 'left'];
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
