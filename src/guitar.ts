import type { GuitarConfig, InstrumentArrangement, InstrumentArrangementEvent, InstrumentPosition } from './types';

export const GUITAR_NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export const GUITAR_FRENCH_NAMES = ['Do', 'Do♯', 'Ré', 'Ré♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si'];

export function guitarNoteLabel(midi: number, french = true) {
  const names = french ? GUITAR_FRENCH_NAMES : GUITAR_NOTE_NAMES;
  return `${names[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

export function guitarFrequency(midi: number) {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function positionsForGuitar(midis: number[], guitar: GuitarConfig, previousFret = 0): InstrumentPosition[] {
  return midis.map((midi) => {
    const candidates = guitar.strings.map((string) => ({ string: string.number, fret: midi - string.midi - guitar.capo }))
      .filter((position) => position.fret >= 0 && position.fret <= guitar.fretCount)
      .sort((left, right) => Math.abs(left.fret - previousFret) - Math.abs(right.fret - previousFret) || left.fret - right.fret);
    const selected = candidates[0] ?? { string: guitar.strings.at(-1)?.number ?? 1, fret: Math.max(0, midi - (guitar.strings.at(-1)?.midi ?? 64) - guitar.capo) };
    return { ...selected, finger: selected.fret === 0 ? 0 : Math.min(4, Math.max(1, selected.fret)) };
  });
}

export function guitarEventsForPart(arrangement: InstrumentArrangement, part: 'melody' | 'accompaniment' | 'both') {
  return arrangement.events.filter((event) => part === 'both' || event.part === part);
}

export function adaptGuitarEvent(event: InstrumentArrangementEvent, guitar: GuitarConfig): InstrumentArrangementEvent {
  return { ...event, positions: positionsForGuitar(event.midis, guitar, event.positions?.[0]?.fret ?? 0) };
}

export function nearestGuitarString(midi: number, guitar: GuitarConfig) {
  return [...guitar.strings].sort((left, right) => Math.abs(left.midi + guitar.capo - midi) - Math.abs(right.midi + guitar.capo - midi))[0];
}

