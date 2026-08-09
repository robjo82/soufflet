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
];

