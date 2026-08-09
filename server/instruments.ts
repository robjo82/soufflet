export interface StoredInstrumentConfig {
  id: string;
  instrumentType: 'piano' | 'guitar';
  name: string;
  builtIn: boolean;
  [key: string]: unknown;
}

export const BUILT_IN_INSTRUMENTS: StoredInstrumentConfig[] = [
  {
    id: 'piano-standard-61',
    instrumentType: 'piano',
    name: 'Piano numérique 61 touches',
    keyboardSize: 61,
    input: 'midi',
    notation: 'french',
    builtIn: true,
  },
  {
    id: 'piano-acoustic-88',
    instrumentType: 'piano',
    name: 'Piano acoustique 88 touches',
    keyboardSize: 88,
    input: 'microphone',
    notation: 'french',
    builtIn: true,
  },
  {
    id: 'guitar-standard-6',
    instrumentType: 'guitar',
    name: 'Guitare 6 cordes · standard',
    strings: [
      { number: 6, note: 'E2', midi: 40 }, { number: 5, note: 'A2', midi: 45 },
      { number: 4, note: 'D3', midi: 50 }, { number: 3, note: 'G3', midi: 55 },
      { number: 2, note: 'B3', midi: 59 }, { number: 1, note: 'E4', midi: 64 },
    ],
    fretCount: 20,
    capo: 0,
    handedness: 'right',
    input: 'microphone',
    builtIn: true,
  },
  {
    id: 'guitar-dadgad-6',
    instrumentType: 'guitar',
    name: 'Guitare 6 cordes · DADGAD',
    strings: [
      { number: 6, note: 'D2', midi: 38 }, { number: 5, note: 'A2', midi: 45 },
      { number: 4, note: 'D3', midi: 50 }, { number: 3, note: 'G3', midi: 55 },
      { number: 2, note: 'A3', midi: 57 }, { number: 1, note: 'D4', midi: 62 },
    ],
    fretCount: 20,
    capo: 0,
    handedness: 'right',
    input: 'microphone',
    builtIn: true,
  },
];
