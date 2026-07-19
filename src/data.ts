import type { AccompanimentEvent, AccordionButton, AccordionConfig, SkillProgress, Song, SongEvent } from './types';

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const noteFromMidi = (midi: number) => `${NOTES[midi % 12]}${Math.floor(midi / 12) - 1}`;

function simpleAccompaniment(events: SongEvent[]): AccompanimentEvent[] {
  const lastEvent = events.at(-1);
  const totalBeats = lastEvent ? Math.ceil(lastEvent.beat + lastEvent.duration) : 0;
  return Array.from({ length: totalBeats }, (_, beat) => {
    let melody = events[0];
    for (const event of events) {
      if (event.beat > beat) break;
      melody = event;
    }
    const pitchClass = ((melody?.midi ?? 60) % 12 + 12) % 12;
    const rootMidi = pitchClass === 5 || pitchClass === 9 ? 41 : pitchClass === 2 || pitchClass === 11 ? 43 : 48;
    return {
      id: `left-${beat + 1}`,
      beat,
      duration: .72,
      rootMidi,
      midi: rootMidi,
      note: noteFromMidi(rootMidi),
      chord: NOTES[rootMidi % 12],
      role: beat % 2 === 0 ? 'bass' : 'chord',
      buttonId: '',
      direction: melody?.direction ?? 'push',
      confidence: 1,
    };
  });
}

const makeButton = (
  id: string,
  row: number,
  index: number,
  pushMidi: number,
  pullMidi: number,
  extras: Partial<AccordionButton> = {},
): AccordionButton => ({
  id,
  row,
  index,
  pushMidi,
  pullMidi,
  push: noteFromMidi(pushMidi),
  pull: noteFromMidi(pullMidi),
  role: 'melody',
  ...extras,
});

const gcOuter = [
  [55, 57], [59, 60], [62, 64], [67, 66], [71, 69],
  [74, 72], [79, 76], [83, 78], [86, 81], [91, 84],
];
const gcInner = [
  [48, 54], [52, 55], [55, 59], [60, 62], [64, 65],
  [67, 69], [72, 71], [76, 74], [79, 77], [84, 81], [88, 83],
];

const clubOuter = [
  [78, 80], [55, 59], [60, 62], [64, 65], [67, 69],
  [72, 71], [76, 74], [79, 77], [84, 81], [88, 83],
];
const clubInner = [
  [57, 60], [60, 64], [65, 67], [69, 70], [72, 72],
  [77, 76], [81, 79], [84, 82], [89, 86],
];

const mapRow = (prefix: string, row: number, notes: number[][]) =>
  notes.map(([push, pull], i) => makeButton(`${prefix}-${i + 1}`, row, i + 1, push, pull, { finger: Math.min(5, Math.max(2, (i % 4) + 2)) }));

const standardBasses = (tuning: 'GC' | 'DG' | 'CF'): AccordionButton[] => {
  const roots = tuning === 'GC' ? [43, 48, 50, 55] : tuning === 'DG' ? [50, 55, 57, 62] : [36, 41, 43, 48];
  return roots.flatMap((root, pair) => [
    makeButton(`bass-${pair + 1}`, 0, pair * 2 + 1, root, root + 7, { role: 'bass' }),
    makeButton(`chord-${pair + 1}`, 0, pair * 2 + 2, root, root + 7, { role: 'chord' }),
  ]);
};

export const FALLBACK_ACCORDIONS: AccordionConfig[] = [
  {
    id: 'hohner-club-i-cf-10-9-2',
    maker: 'Hohner',
    model: 'Club I — 10 + 9 + 2',
    tuning: 'Do/Fa (C/F), Gleichton',
    color: '#6e2f28',
    rightRows: [10, 9, 2],
    bassCount: 8,
    description: 'Variante Club I mesurée : rangée de Do, rangée de Fa avec Gleichton Do5 et deux altérations.',
    buttons: [
      ...mapRow('c1-out', 1, clubOuter),
      ...mapRow('c1-in', 2, clubInner).map((button) => button.index === 5 ? { ...button, isGleichton: true } : button),
      makeButton('c1-help-1', 3, 1, 66, 68, { role: 'accidental', finger: 2 }),
      makeButton('c1-help-2', 3, 2, 75, 73, { role: 'accidental', finger: 3 }),
    ],
    basses: standardBasses('CF'),
    verified: false,
    sourceNote: 'Variante mesurée le 19/07/2026 : P1 = F♯5/G♯5, rang Do dès G3/B3, rang Fa dès F4/G4 et Gleichton Do5 au bouton 5. Les autres Club I peuvent différer.',
  },
  {
    id: 'standard-gc-21-8',
    maker: 'Standard',
    model: '2 rangs — 21 + 8',
    tuning: 'Sol/Do (G/C)',
    color: '#315c4b',
    rightRows: [10, 11],
    bassCount: 8,
    description: 'Le clavier le plus courant en France, idéal pour débuter.',
    buttons: [...mapRow('gc-out', 1, gcOuter), ...mapRow('gc-in', 2, gcInner)],
    basses: standardBasses('GC'),
    verified: true,
  },
  {
    id: 'standard-dg-21-8',
    maker: 'Standard',
    model: '2 rangs — 21 + 8',
    tuning: 'Ré/Sol (D/G)',
    color: '#35556b',
    rightRows: [10, 11],
    bassCount: 8,
    description: 'Accordage fréquent dans les répertoires anglais et irlandais.',
    buttons: [...mapRow('dg-out', 1, gcOuter.map(([a, b]) => [a + 7, b + 7])), ...mapRow('dg-in', 2, gcInner.map(([a, b]) => [a + 7, b + 7]))],
    basses: standardBasses('DG'),
    verified: true,
  },
];

const DEMO_EVENTS: SongEvent[] = [
  { id: 'e1', beat: 0, duration: 1, midi: 60, note: 'C4', buttonId: 'gc-in-4', direction: 'push', finger: 2, confidence: 1 },
  { id: 'e2', beat: 1, duration: 1, midi: 62, note: 'D4', buttonId: 'gc-in-4', direction: 'pull', finger: 2, confidence: 1 },
  { id: 'e3', beat: 2, duration: 1, midi: 64, note: 'E4', buttonId: 'gc-in-5', direction: 'push', finger: 3, confidence: 1 },
  { id: 'e4', beat: 3, duration: 1, midi: 65, note: 'F4', buttonId: 'gc-in-5', direction: 'pull', finger: 3, confidence: 1 },
  { id: 'e5', beat: 4, duration: 2, midi: 67, note: 'G4', buttonId: 'gc-in-6', direction: 'push', finger: 4, confidence: 1 },
  { id: 'e6', beat: 6, duration: 1, midi: 69, note: 'A4', buttonId: 'gc-in-6', direction: 'pull', finger: 4, confidence: 1 },
  { id: 'e7', beat: 7, duration: 1, midi: 71, note: 'B4', buttonId: 'gc-in-7', direction: 'pull', finger: 5, confidence: 1 },
  { id: 'e8', beat: 8, duration: 2, midi: 72, note: 'C5', buttonId: 'gc-in-7', direction: 'push', finger: 5, confidence: 1 },
  { id: 'e9', beat: 10, duration: 1, midi: 71, note: 'B4', buttonId: 'gc-in-7', direction: 'pull', finger: 5, confidence: 1 },
  { id: 'e10', beat: 11, duration: 1, midi: 69, note: 'A4', buttonId: 'gc-in-6', direction: 'pull', finger: 4, confidence: 1 },
  { id: 'e11', beat: 12, duration: 1, midi: 67, note: 'G4', buttonId: 'gc-in-6', direction: 'push', finger: 4, confidence: 1 },
  { id: 'e12', beat: 13, duration: 1, midi: 65, note: 'F4', buttonId: 'gc-in-5', direction: 'pull', finger: 3, confidence: 1 },
  { id: 'e13', beat: 14, duration: 1, midi: 64, note: 'E4', buttonId: 'gc-in-5', direction: 'push', finger: 3, confidence: 1 },
  { id: 'e14', beat: 15, duration: 1, midi: 62, note: 'D4', buttonId: 'gc-in-4', direction: 'pull', finger: 2, confidence: 1 },
  { id: 'e15', beat: 16, duration: 4, midi: 60, note: 'C4', buttonId: 'gc-in-4', direction: 'push', finger: 2, confidence: 1 },
];

export const DEMO_SONG: Song = {
  id: 'first-breath',
  title: 'Premier souffle',
  artist: 'Exercice guidé',
  sourceType: 'lesson',
  bpm: 72,
  timeSignature: [4, 4],
  key: 'Do majeur',
  duration: 27,
  difficulty: 1,
  status: 'ready',
  confidence: 1,
  events: DEMO_EVENTS,
  accompaniment: simpleAccompaniment(DEMO_EVENTS),
};

export const SKILLS: SkillProgress[] = [
  { id: 'buttons', title: 'Tes premiers boutons', description: 'Repère 3 boutons sans regarder tes mains.', progress: 100, lessons: 3, icon: 'buttons', due: true },
  { id: 'bellows', title: 'Pousser et tirer', description: 'Change de direction sans couper le son.', progress: 66, lessons: 4, icon: 'bellows', due: true },
  { id: 'notes', title: 'Cinq notes', description: 'Joue une courte mélodie, une note à la fois.', progress: 25, lessons: 6, icon: 'notes' },
  { id: 'rhythm', title: 'Garder le rythme', description: 'Reste stable avec un tempo lent.', progress: 0, lessons: 5, icon: 'rhythm' },
  { id: 'fingering', title: 'Des doigts légers', description: 'Prépare le doigt suivant avant de jouer.', progress: 0, lessons: 4, icon: 'finger', locked: true },
  { id: 'bass', title: 'Ta première basse', description: 'Ajoute un appui simple de la main gauche.', progress: 0, lessons: 5, icon: 'bass', locked: true },
];

export const FRENCH_NOTES: Record<string, string> = {
  C: 'Do', 'C#': 'Do♯', D: 'Ré', 'D#': 'Ré♯', E: 'Mi', F: 'Fa',
  'F#': 'Fa♯', G: 'Sol', 'G#': 'Sol♯', A: 'La', 'A#': 'La♯', B: 'Si',
};

export function displayNote(note: string, notation: 'french' | 'english' | 'button' | 'tablature', buttonId: string, direction: 'push' | 'pull') {
  const match = note.match(/^([A-G]#?)(-?\d)$/);
  const noteName = match?.[1] ?? note;
  const octave = match?.[2] ?? '';
  const buttonNumber = Number(buttonId.match(/(\d+)$/)?.[1] ?? 0);
  if (notation === 'french') return `${FRENCH_NOTES[noteName] ?? noteName}${octave}`;
  if (notation === 'button') return `${buttonNumber}`;
  if (notation === 'tablature') return `${buttonNumber}${direction === 'pull' ? 'T' : 'P'}`;
  return note;
}

export function adaptSongToAccordion(song: Song, accordion: AccordionConfig): Song {
  let previousDirection: 'push' | 'pull' | undefined;
  const events = song.events.map((event) => {
    const existing = accordion.buttons.find((button) => button.id === event.buttonId);
    if (existing && (event.direction === 'push' ? existing.pushMidi : existing.pullMidi) === event.midi) {
      previousDirection = event.direction;
      return event;
    }
    const choices = accordion.buttons.flatMap((button) => [
      ...(button.pushMidi === event.midi ? [{ button, direction: 'push' as const }] : []),
      ...(button.pullMidi === event.midi ? [{ button, direction: 'pull' as const }] : []),
    ]).sort((left, right) => {
      const leftContinuity = left.direction === previousDirection ? 0 : 1;
      const rightContinuity = right.direction === previousDirection ? 0 : 1;
      return leftContinuity - rightContinuity || left.button.row - right.button.row || left.button.index - right.button.index;
    });
    const choice = choices[0];
    if (!choice) return { ...event, buttonId: '', confidence: Math.min(event.confidence ?? 1, .45) };
    previousDirection = choice.direction;
    return { ...event, buttonId: choice.button.id, direction: choice.direction, finger: choice.button.finger ?? event.finger };
  });
  const accompaniment = song.accompaniment?.map((item) => {
    let melody = events[0];
    for (const event of events) {
      if (event.beat > item.beat) break;
      melody = event;
    }
    const direction = melody?.direction ?? item.direction;
    const desiredPitchClass = ((item.rootMidi % 12) + 12) % 12;
    const candidates = accordion.basses
      .filter((button) => button.role === item.role)
      .map((button) => {
        const midi = direction === 'push' ? button.pushMidi : button.pullMidi;
        const pitchClass = ((midi % 12) + 12) % 12;
        const interval = Math.min((pitchClass - desiredPitchClass + 12) % 12, (desiredPitchClass - pitchClass + 12) % 12);
        const harmonicScore = interval === 0 ? 0 : interval === 5 ? 1 : interval === 2 ? 2 : 10 + interval;
        return { button, midi, harmonicScore };
      })
      .sort((left, right) => left.harmonicScore - right.harmonicScore || left.button.index - right.button.index);
    const choice = candidates[0];
    if (!choice) return { ...item, buttonId: '', direction, confidence: Math.min(item.confidence ?? 1, .4) };
    return {
      ...item,
      buttonId: choice.button.id,
      direction,
      midi: choice.midi,
      note: noteFromMidi(choice.midi),
      chord: NOTES[((choice.midi % 12) + 12) % 12],
    };
  });
  return { ...song, events, accompaniment };
}
