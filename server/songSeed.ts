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

interface SeedAccompanimentEvent {
  id: string;
  beat: number;
  duration: number;
  rootMidi: number;
  midi: number;
  note: string;
  chord: string;
  role: 'bass' | 'chord';
  buttonId: string;
  direction: 'push' | 'pull';
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
  accompaniment: SeedAccompanimentEvent[];
  confidence: number;
  builtIn: true;
  license: string;
  provenance: string;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const noteFromMidi = (midi: number) => `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
type SeedStep = number | [number | null, number];

function accompanimentFrom(events: SeedEvent[], key = 'Do majeur'): SeedAccompanimentEvent[] {
  const finalEvent = events.at(-1);
  const totalBeats = finalEvent ? Math.ceil(finalEvent.beat + finalEvent.duration) : 0;
  return Array.from({ length: totalBeats }, (_, beat) => {
    let melody = events[0];
    for (const event of events) {
      if (event.beat > beat) break;
      melody = event;
    }
    const pitchClass = ((melody?.midi ?? 60) % 12 + 12) % 12;
    const rootMidi = key === 'Ré mineur'
      ? (pitchClass === 5 || pitchClass === 9 ? 41 : 48)
      : (pitchClass === 5 || pitchClass === 9 ? 41 : pitchClass === 2 || pitchClass === 11 ? 43 : 48);
    const role = beat % 2 === 0 ? 'bass' as const : 'chord' as const;
    return {
      id: `left-${beat + 1}`,
      beat,
      duration: .72,
      rootMidi,
      midi: rootMidi,
      note: noteFromMidi(rootMidi),
      chord: NOTE_NAMES[rootMidi % 12],
      role,
      buttonId: '',
      direction: melody?.direction ?? 'push',
      confidence: 1,
    };
  });
}

function eventsFromMidi(steps: SeedStep[], beatsPerNote = 1): SeedEvent[] {
  const events: SeedEvent[] = [];
  let beat = 0;
  for (const step of steps) {
    const [midi, duration] = Array.isArray(step) ? step : [step, beatsPerNote];
    if (midi !== null) {
      events.push({
        id: `n${events.length + 1}`,
        beat,
        duration,
        midi,
        note: noteFromMidi(midi),
        buttonId: '',
        direction: 'push',
        finger: 2,
        confidence: 1,
      });
    }
    beat += duration;
  }
  return events;
}

function traditional(
  id: string,
  title: string,
  bpm: number,
  key: string,
  notes: SeedStep[],
  options: Partial<Pick<SeedSong, 'artist' | 'timeSignature' | 'difficulty' | 'license' | 'provenance'>> = {},
): SeedSong {
  const events = eventsFromMidi(notes);
  const totalBeats = events.at(-1) ? events.at(-1)!.beat + events.at(-1)!.duration : 0;
  const timeSignature = options.timeSignature ?? [4, 4];
  return {
    id,
    title,
    artist: options.artist ?? 'Air traditionnel',
    sourceType: 'lesson',
    bpm,
    timeSignature,
    key,
    duration: Math.ceil(totalBeats * 60 / bpm),
    difficulty: options.difficulty ?? 1,
    status: 'ready',
    events,
    accompaniment: accompanimentFrom(events, key),
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

function auClairDeLaLune(): SeedSong {
  const phrase: SeedStep[] = [
    [C5, .5], [C5, .5], [C5, .5], [D5, .5], E5, D5,
    [C5, .5], [E5, .5], [D5, .5], [D5, .5], [C5, 2],
  ];
  const bridge: SeedStep[] = [
    [D5, .5], [D5, .5], [D5, .5], [D5, .5], A4, A4,
    [D5, .5], [C5, .5], [B4, .5], [A4, .5], [G4, 2],
  ];
  return traditional(
    'au-clair-de-la-lune',
    'Au clair de la lune',
    88,
    'Do majeur',
    [...phrase, ...phrase, ...bridge, ...phrase],
    {
      timeSignature: [2, 4],
      provenance: 'Premier couplet complet, rythme contrôlé depuis la transcription ABC d’Eric Forgeot (Q = 80), transposé une octave pour le clavier diatonique.',
    },
  );
}

function frereJacques(): SeedSong {
  return traditional(
    'frere-jacques',
    'Frère Jacques',
    120,
    'Do majeur',
    [
      C4, D4, E4, C4, C4, D4, E4, C4,
      E4, F4, [G4, 2], E4, F4, [G4, 2],
      [G4, .5], [A4, .5], [G4, .5], [F4, .5], E4, C4,
      [G4, .5], [A4, .5], [G4, .5], [F4, .5], E4, C4,
      C4, G4, [C5, 2], C4, G4, [C5, 2],
    ],
    {
      timeSignature: [2, 4],
      provenance: 'Mélodie traditionnelle complète ; croches de « Sonnez les matines » et tempo de comptine contrôlés sur partition.',
    },
  );
}

function seCanta(): SeedSong {
  return traditional(
    'se-canta',
    'Se Canta',
    112,
    'Do majeur',
    [
      [null, 1], [null, 1], G4,
      C5, C5, [E5, .5], [D5, .5],
      C5, C5, [C5, .5], [D5, .5],
      [E5, 2], E5,
      [D5, 1.5], [null, .5], [D5, .5], [E5, .5],
      [F5, 2], F5,
      E5, E5, [C5, .5], [E5, .5],
      [D5, 2], G4,
      [C5, 1.5], [null, .5], G4,
      [C5, 3],
    ],
    {
      artist: 'Chant traditionnel occitan',
      timeSignature: [3, 4],
      difficulty: 2,
      provenance: 'Mélodie en dix mesures contrôlée sur le conducteur MusicXML en notes réelles de Hautbois & Cie, transposée en Do majeur.',
    },
  );
}

function laJumentDeMichao(): SeedSong {
  // La source est en Mi mineur. La transposition en Ré mineur garde les cinq notes
  // du thème disponibles sur les claviers Do/Fa et Sol/Do fournis par l’application.
  const mi = D4;
  const faDiese = E4;
  const sol = F4;
  const la = G4;
  const re = C4;
  const phrase1: SeedStep[] = [
    [la, .5], [sol, .5], [faDiese, .5],
    [mi, .75], [faDiese, .25], [mi, .5], [re, .5],
    [mi, 1], [la, .5], [sol, .25], [faDiese, .25],
    [mi, .25], [mi, .25], [mi, .25], [faDiese, .25], [mi, .5], [re, .5],
    [mi, 1],
  ];
  const phrase2: SeedStep[] = [
    [mi, .5], [mi, .25], [mi, .25],
    [mi, .5], [mi, .25], [faDiese, .25], [sol, .25], [sol, .25], [faDiese, .25], [mi, .25],
    [re, .75], [re, .25], [sol, .5], [faDiese, .25], [sol, .25],
    [la, .5], [la, .5], [sol, .25], [faDiese, .25], [mi, .25], [re, .25],
    [mi, 1],
  ];
  const phrase3: SeedStep[] = [
    [la, .5], [sol, .5], [faDiese, .5],
    [mi, .75], [faDiese, .25], [mi, .5], [re, .5],
    [mi, .5], [mi, .25], [mi, .25], [re, .25], [mi, .25], [faDiese, .5],
    [sol, .5], [sol, .5], [mi, .25], [mi, .25], [mi, .25], [re, .25],
    [mi, 1],
  ];
  const phrase4: SeedStep[] = [
    [mi, .5], [mi, .25], [mi, .25], [mi, .25], [mi, .25],
    [mi, .5], [mi, .25], [mi, .25], [faDiese, .25], [sol, .25], [mi, .5],
    [re, .75], [re, .25], [sol, .25], [sol, .25], [faDiese, .25], [sol, .25],
    [la, .5], [la, .5], [mi, .25], [mi, .25], [mi, .25], [re, .25],
    [mi, 1],
  ];
  const phrase5: SeedStep[] = [
    [mi, .5], [la, .5], [sol, .5],
    [mi, .25], [mi, .25], [mi, .25], [mi, .25], [la, .5], [sol, .5],
    [faDiese, .5], [faDiese, .25], [mi, .25], [mi, .25], [mi, .25], [faDiese, .5],
    [sol, .5], [sol, .5], [mi, .25], [mi, .25], [mi, .25], [re, .25],
    [mi, 1],
  ];
  const form = [
    ...phrase1, ...phrase1,
    ...phrase2, ...phrase2,
    ...phrase3,
    ...phrase4, ...phrase4,
    ...phrase5, ...phrase5,
  ];
  return traditional(
    'la-jument-de-michao-trad',
    'La Jument de Michao — air traditionnel',
    90,
    'Ré mineur',
    [...form, ...form, ...form],
    {
      artist: 'Chanson traditionnelle de Haute-Bretagne',
      timeSignature: [2, 2],
      difficulty: 2,
      provenance: 'Cinq phrases et levées contrôlées sur la partition pédagogique Madame Musique ; forme traditionnelle répétée sur trois cycles, sans arrangement commercial.',
    },
  );
}

function brisePieds(): SeedSong {
  type TabNote = [number, number, number, string, 'push' | 'pull'];
  const measures: TabNote[][] = [
    [[G4, 0, 1, 'c1-out-5', 'push'], [A4, 1, 1, 'c1-out-5', 'pull'], [G4, 2, 1, 'c1-out-5', 'push'], [A4, 3, 1, 'c1-out-5', 'pull']],
    [[G4, 0, 1, 'c1-out-5', 'push'], [E5, 1, .5, 'c1-out-7', 'push'], [F5, 1.5, .5, 'c1-out-8', 'pull'], [E5, 2, 1, 'c1-out-7', 'push'], [D5, 3, 1, 'c1-out-7', 'pull']],
    [[G4, 0, 1, 'c1-out-5', 'push'], [A4, 1, 1, 'c1-out-5', 'pull'], [G4, 2, 1, 'c1-out-5', 'push'], [A4, 3, 1, 'c1-out-5', 'pull']],
    [[G4, 0, 1, 'c1-out-5', 'push'], [E5, 1, .5, 'c1-out-7', 'push'], [D5, 1.5, .5, 'c1-out-7', 'pull'], [C5, 2, 2, 'c1-out-6', 'push']],
    [[E5, 0, .5, 'c1-out-7', 'push'], [D5, .5, .5, 'c1-out-7', 'pull'], [E5, 1, .5, 'c1-out-7', 'push'], [F5, 1.5, .5, 'c1-out-8', 'pull'], [E5, 2, 1, 'c1-out-7', 'push'], [D5, 3, 1, 'c1-out-7', 'pull']],
    [[D5, 0, .5, 'c1-out-7', 'pull'], [C5, .5, .5, 'c1-out-6', 'push'], [B4, 1, .5, 'c1-out-6', 'pull'], [C5, 1.5, .5, 'c1-out-6', 'push'], [D5, 2, 2, 'c1-out-7', 'pull']],
    [[G5, 0, .5, 'c1-out-8', 'push'], [A5, .5, .5, 'c1-out-9', 'pull'], [G5, 1, .5, 'c1-out-8', 'push'], [F5, 1.5, .5, 'c1-out-8', 'pull'], [E5, 2, .5, 'c1-out-7', 'push'], [D5, 2.5, .5, 'c1-out-7', 'pull'], [E5, 3, .5, 'c1-out-7', 'push'], [F5, 3.5, .5, 'c1-out-8', 'pull']],
    [[E5, 0, 1, 'c1-out-7', 'push'], [D5, 1, 1, 'c1-out-7', 'pull'], [E5, 2, 1, 'c1-out-7', 'push'], [C5, 3, 1, 'c1-out-6', 'push']],
    [[E5, 0, .5, 'c1-out-7', 'push'], [D5, .5, .5, 'c1-out-7', 'pull'], [E5, 1, .5, 'c1-out-7', 'push'], [F5, 1.5, .5, 'c1-out-8', 'pull'], [E5, 2, 1, 'c1-out-7', 'push'], [D5, 3, 1, 'c1-out-7', 'pull']],
    [[D5, 0, .5, 'c1-out-7', 'pull'], [C5, .5, .5, 'c1-out-6', 'push'], [B4, 1, .5, 'c1-out-6', 'pull'], [C5, 1.5, .5, 'c1-out-6', 'push'], [D5, 2, 2, 'c1-out-7', 'pull']],
    [[G5, 0, .5, 'c1-out-8', 'push'], [A5, .5, .5, 'c1-out-9', 'pull'], [G5, 1, .5, 'c1-out-8', 'push'], [F5, 1.5, .5, 'c1-out-8', 'pull'], [E5, 2, .5, 'c1-out-7', 'push'], [D5, 2.5, .5, 'c1-out-7', 'pull'], [E5, 3, .5, 'c1-out-7', 'push'], [F5, 3.5, .5, 'c1-out-8', 'pull']],
    [[E5, 0, 1, 'c1-out-7', 'push'], [D5, 1, 1, 'c1-out-7', 'pull'], [C5, 2, 2, 'c1-out-6', 'push']],
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
    accompaniment: accompanimentFrom(events),
    provenance: 'Transcription Victor Laroussinie, contrôlée et saisie mesure par mesure à partir de la partition fournie.',
  };
}

export const SONG_SEEDS: SeedSong[] = [
  brisePieds(),
  auClairDeLaLune(),
  frereJacques(),
  traditional('ah-vous-dirai-je-maman', 'Ah ! vous dirai-je, maman', 88, 'Do majeur', [C4, C4, G4, G4, A4, A4, [G4, 2], F4, F4, E4, E4, D4, D4, [C4, 2], G4, G4, F4, F4, E4, E4, [D4, 2], G4, G4, F4, F4, E4, E4, [D4, 2], C4, C4, G4, G4, A4, A4, [G4, 2], F4, F4, E4, E4, D4, D4, [C4, 2]]),
  traditional('ode-a-la-joie', 'Ode à la joie', 96, 'Do majeur', [E4, E4, F4, G4, G4, F4, E4, D4, C4, C4, D4, E4, [E4, 1.5], [D4, .5], [D4, 2], E4, E4, F4, G4, G4, F4, E4, D4, C4, C4, D4, E4, [D4, 1.5], [C4, .5], [C4, 2]], { artist: 'Ludwig van Beethoven', provenance: 'Thème du quatrième mouvement de la Symphonie n° 9, édition pédagogique.' }),
  traditional('mary-had-a-little-lamb', 'Mary Had a Little Lamb', 88, 'Do majeur', [E4, D4, C4, D4, E4, E4, [E4, 2], D4, D4, [D4, 2], E4, G4, [G4, 2], E4, D4, C4, D4, E4, E4, E4, E4, D4, D4, E4, D4, [C4, 3]]),
  traditional('alouette', 'Alouette, gentille alouette', 104, 'Do majeur', [G4, A4, B4, B4, A4, G4, A4, B4, G4, E4, G4, G4, A4, B4, B4, A4, G4, A4, B4, G4, E4, [G4, 2]], { timeSignature: [2, 4] }),
  traditional('london-bridge', 'London Bridge Is Falling Down', 96, 'Do majeur', [G4, A4, G4, F4, E4, F4, G4, D4, E4, F4, E4, F4, G4, G4, A4, G4, F4, E4, F4, G4, D4, G4, E4, [C4, 2]]),
  traditional('sur-le-pont-davignon', 'Sur le pont d’Avignon', 104, 'Do majeur', [G4, G4, A4, B4, C5, C5, B4, A4, G4, G4, A4, B4, C5, [G4, 2], C5, D5, E5, C5, D5, E5, C5, D5, E5, F5, E5, D5, [C5, 2]], { timeSignature: [2, 4] }),
  traditional('le-bon-roi-dagobert', 'Le bon roi Dagobert', 108, 'Do majeur', [G4, G4, G4, A4, G4, F4, E4, E4, F4, G4, A4, [G4, 2], C5, C5, B4, A4, G4, F4, E4, D4, C4, D4, [C4, 2]], { timeSignature: [2, 4] }),
  seCanta(),
  laJumentDeMichao(),
  {
    id: 'vesoul-reference', title: 'Vesoul', artist: 'Jacques Brel', sourceType: 'youtube', sourceUrl: 'https://www.youtube.com/results?search_query=Jacques+Brel+Vesoul',
    bpm: 0, timeSignature: [4, 4], key: 'À analyser', duration: 0, difficulty: 4, status: 'reference-only', events: [], confidence: 0,
    accompaniment: [],
    builtIn: true, license: 'Œuvre protégée — contenu non fourni', provenance: 'Référence uniquement. Importe une source que tu as le droit d’utiliser pour créer ton aide personnelle.',
  },
];
