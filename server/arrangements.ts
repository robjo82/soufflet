interface ArrangementSourceSong {
  status: string;
  difficulty: number;
  events: Array<{ id: string; beat: number; duration: number; midi: number }>;
  accompaniment?: Array<{ id: string; beat: number; duration: number; rootMidi: number; chord: string; role: 'bass' | 'chord' }>;
}

export interface ArrangementEvent {
  id: string;
  beat: number;
  duration: number;
  midis: number[];
  hand: 'right' | 'left' | 'both';
  fingers?: number[];
  label?: string;
  sourceEventId?: string;
  part?: 'melody' | 'accompaniment';
  positions?: Array<{ string: number; fret: number; finger?: number }>;
}

export interface PianoArrangement {
  instrumentType: 'piano';
  difficulty: number;
  events: ArrangementEvent[];
  provenance: string;
}

export interface GuitarArrangement {
  instrumentType: 'guitar';
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

export function buildPianoArrangement(song: ArrangementSourceSong): PianoArrangement | undefined {
  if (song.status === 'reference-only' || song.events.length === 0) return undefined;
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
  const left: ArrangementEvent[] = (song.accompaniment ?? []).map((event) => {
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

const STANDARD_GUITAR = [
  { string: 6, midi: 40 }, { string: 5, midi: 45 }, { string: 4, midi: 50 },
  { string: 3, midi: 55 }, { string: 2, midi: 59 }, { string: 1, midi: 64 },
];

function guitarPosition(midi: number, previousFret = 0) {
  const candidates = STANDARD_GUITAR
    .map((string) => ({ string: string.string, fret: midi - string.midi }))
    .filter((position) => position.fret >= 0 && position.fret <= 15)
    .sort((left, right) => {
      const leftScore = Math.abs(left.fret - previousFret) + Math.max(0, left.fret - 7) * .25 + left.string * .03;
      const rightScore = Math.abs(right.fret - previousFret) + Math.max(0, right.fret - 7) * .25 + right.string * .03;
      return leftScore - rightScore;
    });
  const selected = candidates[0] ?? { string: 1, fret: Math.max(0, midi - 64) };
  return { ...selected, finger: selected.fret === 0 ? 0 : Math.min(4, Math.max(1, selected.fret)) };
}

function chordVoicing(rootMidi: number, label: string) {
  const root = Math.max(40, Math.min(52, rootMidi));
  return chordIntervals(label).slice(0, 3).map((interval) => root + interval);
}

export function buildGuitarArrangement(song: ArrangementSourceSong): GuitarArrangement | undefined {
  if (song.status === 'reference-only' || song.events.length === 0) return undefined;
  let previousFret = 0;
  const melody = song.events.map((event): ArrangementEvent => {
    const position = guitarPosition(event.midi, previousFret);
    previousFret = position.fret;
    return {
      id: `guitar-melody-${event.id}`, beat: event.beat, duration: event.duration,
      midis: [event.midi], hand: 'both', part: 'melody', positions: [position],
      fingers: [position.finger], label: NOTE_NAMES[event.midi % 12], sourceEventId: event.id,
    };
  });
  const accompaniment = (song.accompaniment ?? [])
    .filter((event) => event.role === 'chord')
    .map((event): ArrangementEvent => {
      const midis = chordVoicing(event.rootMidi, event.chord);
      const positions = midis.map((midi) => guitarPosition(midi));
      return {
        id: `guitar-chord-${event.id}`, beat: event.beat, duration: event.duration,
        midis, hand: 'both', part: 'accompaniment', positions,
        fingers: positions.map((position) => position.finger), label: event.chord, sourceEventId: event.id,
      };
    });
  return {
    instrumentType: 'guitar', difficulty: Math.max(1, song.difficulty),
    events: [...melody, ...accompaniment].sort((a, b) => a.beat - b.beat || (a.part === 'accompaniment' ? -1 : 1)),
    provenance: 'Tablature et accords pédagogiques générés depuis la mélodie et l’harmonie vérifiées de Soufflet.',
  };
}

export function withGeneratedArrangements<T extends ArrangementSourceSong>(song: T): T & { arrangements?: Record<string, PianoArrangement | GuitarArrangement> } {
  const piano = buildPianoArrangement(song);
  const guitar = buildGuitarArrangement(song);
  return piano || guitar ? { ...song, arrangements: { ...(piano ? { piano } : {}), ...(guitar ? { guitar } : {}) } } : song;
}
