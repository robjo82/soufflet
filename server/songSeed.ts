interface SeedEvent {
  id: string;
  beat: number;
  duration: number;
  midi: number;
  note: string;
  buttonId: string;
  direction: 'push' | 'pull';
  finger: number;
  confidence: number;
}

export interface SeedSong {
  id: string;
  title: string;
  artist: string;
  sourceType: 'lesson' | 'youtube';
  sourceUrl?: string;
  bpm: number;
  timeSignature: [number, number];
  key: string;
  duration: number;
  difficulty: number;
  status: 'ready' | 'reference-only';
  events: SeedEvent[];
  confidence: number;
  builtIn: true;
  license: string;
  provenance: string;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const noteFromMidi = (midi: number) => `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;

function eventsFromMidi(steps: Array<number | [number, number]>, beatsPerNote = 1): SeedEvent[] {
  let beat = 0;
  return steps.map((step, index) => {
    const [midi, duration] = Array.isArray(step) ? step : [step, beatsPerNote];
    const event = {
      id: `n${index + 1}`,
      beat,
      duration,
      midi,
      note: noteFromMidi(midi),
      buttonId: '',
      direction: 'push' as const,
      finger: 2,
      confidence: 1,
    };
    beat += duration;
    return event;
  });
}

function traditional(
  id: string,
  title: string,
  bpm: number,
  key: string,
  notes: Array<number | [number, number]>,
  options: Partial<Pick<SeedSong, 'artist' | 'timeSignature' | 'difficulty' | 'license' | 'provenance'>> = {},
): SeedSong {
  const events = eventsFromMidi(notes);
  const totalBeats = events.at(-1) ? events.at(-1)!.beat + events.at(-1)!.duration : 0;
  return {
    id,
    title,
    artist: options.artist ?? 'Air traditionnel',
    sourceType: 'lesson',
    bpm,
    timeSignature: options.timeSignature ?? [4, 4],
    key,
    duration: Math.ceil(totalBeats * 60 / bpm),
    difficulty: options.difficulty ?? 1,
    status: 'ready',
    events,
    confidence: 1,
    builtIn: true,
    license: options.license ?? 'Domaine public',
    provenance: options.provenance ?? 'Mélodie traditionnelle, édition pédagogique Soufflet.',
  };
}

const C4 = 60;
const D4 = 62;
const E4 = 64;
const F4 = 65;
const G4 = 67;
const A4 = 69;
const B4 = 71;
const C5 = 72;
const D5 = 74;
const E5 = 76;
const F5 = 77;
const G5 = 79;
const A5 = 81;

function brisePieds(): SeedSong {
  type TabNote = [number, number, number, string, 'push' | 'pull'];
  const measures: TabNote[][] = [
    [[G4, 0, 1, 'c1-out-5', 'push'], [D5, .75, .25, 'c1-out-7', 'pull'], [A4, 1, 1, 'c1-out-5', 'pull'], [G4, 2, 1, 'c1-out-5', 'push'], [D5, 2.75, .25, 'c1-out-7', 'pull'], [A4, 3, 1, 'c1-out-5', 'pull']],
    [[G4, 0, 1, 'c1-out-5', 'push'], [E5, 1, .5, 'c1-out-7', 'push'], [F5, 1.5, .5, 'c1-out-8', 'pull'], [E5, 2, 1, 'c1-out-7', 'push'], [F5, 2.75, .25, 'c1-out-8', 'pull'], [D5, 3, 1, 'c1-out-7', 'pull']],
    [[F5, 0, .25, 'c1-out-8', 'pull'], [G4, .25, .75, 'c1-out-5', 'push'], [D5, .75, .25, 'c1-out-7', 'pull'], [A4, 1, 1, 'c1-out-5', 'pull'], [G4, 2, 1, 'c1-out-5', 'push'], [D5, 2.75, .25, 'c1-out-7', 'pull'], [A4, 3, 1, 'c1-out-5', 'pull']],
    [[G4, 0, 1, 'c1-out-5', 'push'], [E5, 1, .5, 'c1-out-7', 'push'], [D5, 1.5, .5, 'c1-out-7', 'pull'], [C5, 2, 2, 'c1-out-6', 'push']],
    [[E5, 0, .5, 'c1-out-7', 'push'], [D5, .5, .5, 'c1-out-7', 'pull'], [E5, 1, .5, 'c1-out-7', 'push'], [F5, 1.5, .5, 'c1-out-8', 'pull'], [E5, 2, 1, 'c1-out-7', 'push'], [F5, 2.75, .25, 'c1-out-8', 'pull'], [D5, 3, 1, 'c1-out-7', 'pull']],
    [[D5, 0, .5, 'c1-out-7', 'pull'], [C5, .5, .5, 'c1-out-6', 'push'], [B4, 1, .5, 'c1-out-6', 'pull'], [C5, 1.5, .5, 'c1-out-6', 'push'], [D5, 2, 2, 'c1-out-7', 'pull']],
    [[F5, 0, .25, 'c1-out-8', 'pull'], [G5, .25, .375, 'c1-out-8', 'push'], [A5, .625, .375, 'c1-out-9', 'pull'], [G5, 1, .5, 'c1-out-8', 'push'], [F5, 1.5, .5, 'c1-out-8', 'pull'], [E5, 2, .5, 'c1-out-7', 'push'], [D5, 2.5, .5, 'c1-out-7', 'pull'], [E5, 3, .5, 'c1-out-7', 'push'], [F5, 3.5, .5, 'c1-out-8', 'pull']],
    [[E5, 0, 1, 'c1-out-7', 'push'], [F5, .75, .25, 'c1-out-8', 'pull'], [D5, 1, 1, 'c1-out-7', 'pull'], [E5, 2, 1, 'c1-out-7', 'push'], [C5, 3, 1, 'c1-out-6', 'push']],
    [[E5, 0, .5, 'c1-out-7', 'push'], [D5, .5, .5, 'c1-out-7', 'pull'], [E5, 1, .5, 'c1-out-7', 'push'], [F5, 1.5, .5, 'c1-out-8', 'pull'], [E5, 2, 1, 'c1-out-7', 'push'], [F5, 2.75, .25, 'c1-out-8', 'pull'], [D5, 3, 1, 'c1-out-7', 'pull']],
    [[D5, 0, .5, 'c1-out-7', 'pull'], [C5, .5, .5, 'c1-out-6', 'push'], [B4, 1, .5, 'c1-out-6', 'pull'], [C5, 1.5, .5, 'c1-out-6', 'push'], [D5, 2, 2, 'c1-out-7', 'pull']],
    [[F5, 0, .25, 'c1-out-8', 'pull'], [G5, .25, .375, 'c1-out-8', 'push'], [A5, .625, .375, 'c1-out-9', 'pull'], [G5, 1, .5, 'c1-out-8', 'push'], [F5, 1.5, .5, 'c1-out-8', 'pull'], [E5, 2, .5, 'c1-out-7', 'push'], [D5, 2.5, .5, 'c1-out-7', 'pull'], [E5, 3, .5, 'c1-out-7', 'push'], [F5, 3.5, .5, 'c1-out-8', 'pull']],
    [[E5, 0, 1, 'c1-out-7', 'push'], [F5, .75, .25, 'c1-out-8', 'pull'], [D5, 1, 1, 'c1-out-7', 'pull'], [C5, 2, 2, 'c1-out-6', 'push']],
  ];
  const events = measures.flatMap((measure, measureIndex) => measure.map(([midi, localBeat, duration, buttonId, direction], eventIndex) => ({
    id: `m${measureIndex + 1}-${eventIndex + 1}`,
    beat: measureIndex * 4 + localBeat,
    duration,
    midi,
    note: noteFromMidi(midi),
    buttonId,
    direction,
    finger: Math.min(5, Math.max(2, Number(buttonId.match(/(\d+)$/)?.[1] ?? 5) - 3)),
    confidence: 1,
  })));
  return {
    id: 'le-brise-pieds-aveyronnais', title: 'Le Brise-pieds', artist: 'Air traditionnel (Scottish)', sourceType: 'youtube',
    sourceUrl: 'https://www.youtube.com/watch?v=QtRURW4IZog', bpm: 104, timeSignature: [4, 4], key: 'Do majeur', duration: 28,
    difficulty: 3, status: 'ready', events, confidence: 1, builtIn: true, license: 'Domaine public',
    provenance: 'Transcription Victor Laroussinie, contrôlée et saisie mesure par mesure à partir de la partition fournie.',
  };
}

export const SONG_SEEDS: SeedSong[] = [
  brisePieds(),
  traditional('au-clair-de-la-lune', 'Au clair de la lune', 76, 'Do majeur', [C4, C4, C4, D4, E4, [D4, 2], C4, E4, D4, D4, [C4, 3]]),
  traditional('frere-jacques', 'Frère Jacques', 92, 'Do majeur', [C4, D4, E4, C4, C4, D4, E4, C4, E4, F4, [G4, 2], E4, F4, [G4, 2], G4, A4, G4, F4, E4, C4, G4, A4, G4, F4, E4, C4, C4, G4, [C4, 2], C4, G4, [C4, 2]]),
  traditional('ah-vous-dirai-je-maman', 'Ah ! vous dirai-je, maman', 88, 'Do majeur', [C4, C4, G4, G4, A4, A4, [G4, 2], F4, F4, E4, E4, D4, D4, [C4, 2], G4, G4, F4, F4, E4, E4, [D4, 2], G4, G4, F4, F4, E4, E4, [D4, 2], C4, C4, G4, G4, A4, A4, [G4, 2], F4, F4, E4, E4, D4, D4, [C4, 2]]),
  traditional('ode-a-la-joie', 'Ode à la joie', 96, 'Do majeur', [E4, E4, F4, G4, G4, F4, E4, D4, C4, C4, D4, E4, [E4, 1.5], [D4, .5], [D4, 2], E4, E4, F4, G4, G4, F4, E4, D4, C4, C4, D4, E4, [D4, 1.5], [C4, .5], [C4, 2]], { artist: 'Ludwig van Beethoven', provenance: 'Thème du quatrième mouvement de la Symphonie n° 9, édition pédagogique.' }),
  traditional('mary-had-a-little-lamb', 'Mary Had a Little Lamb', 88, 'Do majeur', [E4, D4, C4, D4, E4, E4, [E4, 2], D4, D4, [D4, 2], E4, G4, [G4, 2], E4, D4, C4, D4, E4, E4, E4, E4, D4, D4, E4, D4, [C4, 3]]),
  traditional('alouette', 'Alouette, gentille alouette', 104, 'Do majeur', [G4, A4, B4, B4, A4, G4, A4, B4, G4, E4, G4, G4, A4, B4, B4, A4, G4, A4, B4, G4, E4, [G4, 2]], { timeSignature: [2, 4] }),
  traditional('london-bridge', 'London Bridge Is Falling Down', 96, 'Do majeur', [G4, A4, G4, F4, E4, F4, G4, D4, E4, F4, E4, F4, G4, G4, A4, G4, F4, E4, F4, G4, D4, G4, E4, [C4, 2]]),
  traditional('sur-le-pont-davignon', 'Sur le pont d’Avignon', 104, 'Do majeur', [G4, G4, A4, B4, C5, C5, B4, A4, G4, G4, A4, B4, C5, [G4, 2], C5, D5, E5, C5, D5, E5, C5, D5, E5, F5, E5, D5, [C5, 2]], { timeSignature: [2, 4] }),
  traditional('le-bon-roi-dagobert', 'Le bon roi Dagobert', 108, 'Do majeur', [G4, G4, G4, A4, G4, F4, E4, E4, F4, G4, A4, [G4, 2], C5, C5, B4, A4, G4, F4, E4, D4, C4, D4, [C4, 2]], { timeSignature: [2, 4] }),
  traditional('se-canta', 'Se Canta', 76, 'Do majeur', [G4, A4, B4, C5, [D5, 2], C5, B4, A4, G4, A4, B4, [C5, 2], B4, A4, G4, [G4, 2]], { artist: 'Chant traditionnel occitan', difficulty: 2, provenance: 'Air traditionnel occitan ancien, version mélodique pédagogique.' }),
  traditional('la-jument-de-michao-trad', 'La Jument de Michao — air traditionnel', 116, 'Do majeur', [E4, G4, G4, A4, G4, E4, D4, E4, G4, G4, A4, B4, A4, G4, E4, D4, [E4, 2]], { artist: 'Chanson traditionnelle de Haute-Bretagne', difficulty: 2, provenance: 'Air traditionnel uniquement ; aucun arrangement moderne ni enregistrement commercial n’est inclus.' }),
  {
    id: 'vesoul-reference', title: 'Vesoul', artist: 'Jacques Brel', sourceType: 'youtube', sourceUrl: 'https://www.youtube.com/results?search_query=Jacques+Brel+Vesoul',
    bpm: 0, timeSignature: [4, 4], key: 'À analyser', duration: 0, difficulty: 4, status: 'reference-only', events: [], confidence: 0,
    builtIn: true, license: 'Œuvre protégée — contenu non fourni', provenance: 'Référence uniquement. Importe une source que tu as le droit d’utiliser pour créer ton aide personnelle.',
  },
];
