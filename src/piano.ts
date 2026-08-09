import type { InstrumentArrangement, InstrumentArrangementEvent, PianoKeyboardSize } from './types';

export const PIANO_NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export const PIANO_FRENCH_NAMES = ['Do', 'Do♯', 'Ré', 'Ré♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si'];

export function pianoRange(size: PianoKeyboardSize) {
  const startBySize: Record<PianoKeyboardSize, number> = { 25: 48, 32: 41, 49: 36, 61: 36, 76: 28, 88: 21 };
  const start = startBySize[size];
  return Array.from({ length: size }, (_, index) => start + index);
}

export function pianoNoteLabel(midi: number, notation: 'french' | 'english' = 'french') {
  const names = notation === 'french' ? PIANO_FRENCH_NAMES : PIANO_NOTE_NAMES;
  return `${names[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

export function pianoArrangementFor(song: { arrangements?: { piano?: InstrumentArrangement } }) {
  return song.arrangements?.piano?.instrumentType === 'piano' ? song.arrangements.piano : undefined;
}

export function eventsForHand(arrangement: InstrumentArrangement, hand: 'right' | 'left' | 'both') {
  return arrangement.events.filter((event) => hand === 'both' || event.hand === hand || event.hand === 'both');
}

export function matchesPianoEvent(event: InstrumentArrangementEvent, midi: number) {
  return event.midis.includes(midi);
}

