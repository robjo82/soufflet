import type { InstrumentArrangement, InstrumentArrangementEvent, LyricLine, PianoKeyboardSize } from './types';

export const PIANO_NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export const PIANO_FRENCH_NAMES = ['Do', 'Do♯', 'Ré', 'Ré♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si'];

export function pianoRange(size: PianoKeyboardSize) {
  const startBySize: Record<PianoKeyboardSize, number> = { 25: 48, 32: 41, 49: 36, 61: 36, 76: 28, 88: 21 };
  const start = startBySize[size];
  return Array.from({ length: size }, (_, index) => start + index);
}

export interface PianoKeyGeometry {
  midi: number;
  black: boolean;
  left: number;
  width: number;
}

export function pianoKeyGeometry(midis: number[]): PianoKeyGeometry[] {
  const blackPitchClasses = new Set([1, 3, 6, 8, 10]);
  const whiteMidis = midis.filter((midi) => !blackPitchClasses.has(((midi % 12) + 12) % 12));
  const whiteWidth = 100 / Math.max(1, whiteMidis.length);
  return midis.map((midi) => {
    const black = blackPitchClasses.has(((midi % 12) + 12) % 12);
    if (!black) {
      return { midi, black, left: whiteMidis.indexOf(midi) * whiteWidth, width: whiteWidth };
    }
    const whitesBefore = whiteMidis.filter((whiteMidi) => whiteMidi < midi).length;
    const width = whiteWidth * .62;
    return { midi, black, left: whitesBefore * whiteWidth - width / 2, width };
  });
}

export function pianoVisibleRange(allMidis: number[], events: InstrumentArrangementEvent[], minimumKeys = 25) {
  if (!allMidis.length || !events.length) return allMidis;
  const playedMidis = events.flatMap((event) => event.midis).filter((midi) => allMidis.includes(midi));
  if (!playedMidis.length) return allMidis;
  let start = Math.max(0, allMidis.indexOf(Math.min(...playedMidis)) - 5);
  let end = Math.min(allMidis.length, allMidis.indexOf(Math.max(...playedMidis)) + 6);
  while (end - start < Math.min(minimumKeys, allMidis.length)) {
    if (start > 0) start -= 1;
    if (end - start >= minimumKeys) break;
    if (end < allMidis.length) end += 1;
    if (start === 0 && end === allMidis.length) break;
  }
  return allMidis.slice(start, end);
}

/**
 * Chooses the keyboard area that the score camera should follow from the
 * timeline alone. This deliberately does not depend on a detected or clicked
 * note: demo and guided playback must keep moving even when the learner is
 * only watching.
 */
export function pianoTimelineFocusMidi(events: InstrumentArrangementEvent[], beat: number) {
  const playable = events.filter((event) => event.midis.length > 0);
  if (!playable.length) return undefined;

  const current = playable.filter((event) => event.beat <= beat + .05 && event.beat + event.duration >= beat - .05);
  let focusEvents = current;
  if (!focusEvents.length) {
    const nextBeat = playable.reduce<number | undefined>((next, event) => {
      if (event.beat < beat - .05) return next;
      return next === undefined || event.beat < next ? event.beat : next;
    }, undefined);
    if (nextBeat === undefined) return undefined;
    focusEvents = playable.filter((event) => Math.abs(event.beat - nextBeat) < .001);
  }

  const midis = [...new Set(focusEvents.flatMap((event) => event.midis))].sort((left, right) => left - right);
  return midis[Math.floor((midis.length - 1) / 2)];
}

export function pianoLyricCueAtBeat(lyrics: LyricLine[], beat: number, totalBeats: number) {
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
