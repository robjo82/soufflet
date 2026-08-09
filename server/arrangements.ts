import type { SeedSong } from './songSeed.js';

export interface ArrangementEvent {
  id: string;
  beat: number;
  duration: number;
  midis: number[];
  hand: 'right' | 'left' | 'both';
  fingers?: number[];
  label?: string;
  sourceEventId?: string;
}

export interface PianoArrangement {
  instrumentType: 'piano';
  difficulty: number;
  events: ArrangementEvent[];
  provenance: string;
}

const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

function chordIntervals(label: string) {
  if (/m(?!aj)/i.test(label)) return [0, 3, 7];
  if (/7/.test(label)) return [0, 4, 7, 10];
  return [0, 4, 7];
}

function rightFinger(midi: number, previousMidi?: number) {
  if (previousMidi === undefined) return 1;
  const movement = midi - previousMidi;
  if (movement <= -5) return 1;
  if (movement < 0) return 2;
  if (movement === 0) return 3;
  if (movement <= 2) return 3;
  if (movement <= 5) return 4;
  return 5;
}

export function buildPianoArrangement(song: SeedSong): PianoArrangement | undefined {
  if (song.status !== 'ready' || song.events.length === 0) return undefined;
  let previousMidi: number | undefined;
  const melody: ArrangementEvent[] = song.events.map((event) => {
    const finger = rightFinger(event.midi, previousMidi);
    previousMidi = event.midi;
    return {
      id: `piano-right-${event.id}`,
      beat: event.beat,
      duration: event.duration,
      midis: [event.midi],
      hand: 'right',
      fingers: [finger],
      label: NOTE_NAMES[event.midi % 12],
      sourceEventId: event.id,
    };
  });
  const left: ArrangementEvent[] = song.accompaniment.map((event) => {
    const root = Math.min(event.rootMidi, 52);
    const midis = event.role === 'bass'
      ? [root]
      : chordIntervals(event.chord).map((interval) => root + 12 + interval).filter((midi) => midi <= 67);
    return {
      id: `piano-left-${event.id}`,
      beat: event.beat,
      duration: event.duration,
      midis,
      hand: 'left',
      fingers: event.role === 'bass' ? [5] : midis.map((_, index) => [5, 3, 1, 1][index] ?? 1),
      label: event.role === 'bass' ? NOTE_NAMES[root % 12] : event.chord,
      sourceEventId: event.id,
    };
  });
  return {
    instrumentType: 'piano',
    difficulty: Math.max(1, song.difficulty),
    events: [...melody, ...left].sort((a, b) => a.beat - b.beat || (a.hand === 'left' ? -1 : 1)),
    provenance: 'Arrangement pédagogique généré depuis la mélodie et l’accompagnement vérifiés de Soufflet.',
  };
}

export function withBuiltInArrangements(song: SeedSong) {
  const piano = buildPianoArrangement(song);
  return piano ? { ...song, arrangements: { piano } } : song;
}

