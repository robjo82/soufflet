import type { GuitarConfig, InstrumentArrangement, InstrumentArrangementEvent, InstrumentPosition, LyricLine } from './types';

export const GUITAR_NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export const GUITAR_FRENCH_NAMES = ['Do', 'Do♯', 'Ré', 'Ré♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si'];
export const GUITAR_TIMELINE_HISTORY_BEATS = 1;
export const GUITAR_TIMELINE_LOOKAHEAD_BEATS = 16;

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

export function guitarTimelineLayout(
  events: InstrumentArrangementEvent[],
  beat: number,
  historyBeats = GUITAR_TIMELINE_HISTORY_BEATS,
  lookAheadBeats = GUITAR_TIMELINE_LOOKAHEAD_BEATS,
) {
  const windowBeats = Math.max(1, historyBeats + lookAheadBeats);
  return events
    .filter((event) => event.beat + event.duration >= beat - historyBeats && event.beat <= beat + lookAheadBeats)
    .map((event) => ({
      event,
      left: Math.max(0, (event.beat - beat + historyBeats) / windowBeats * 100),
      width: Math.max(1.35, Math.min(100, event.duration / windowBeats * 100)),
    }));
}

export function guitarLyricCueAtBeat(lyrics: LyricLine[], beat: number, totalBeats: number) {
  const ordered = [...lyrics].sort((left, right) => left.beat - right.beat);
  let currentIndex = -1;
  for (let index = 0; index < ordered.length && ordered[index].beat <= beat; index += 1) currentIndex = index;
  const current = currentIndex >= 0 ? ordered[currentIndex] : undefined;
  const next = ordered[currentIndex + 1];
  if (!current) return { current, next, words: [] as string[], activeWord: -1, progress: 0 };
  const words = current.text.match(/\S+/g) ?? [];
  const endBeat = next?.beat ?? totalBeats;
  const progress = Math.max(0, Math.min(1, (beat - current.beat) / Math.max(.25, endBeat - current.beat)));
  return {
    current,
    next,
    words,
    activeWord: words.length ? Math.min(words.length - 1, Math.floor(progress * words.length)) : -1,
    progress,
  };
}
