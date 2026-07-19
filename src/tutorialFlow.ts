import type { PracticeMode, Song } from './types';

export type TutorialTask = 'already-done' | 'wait-melody' | 'memory';

export interface TutorialModeTrial {
  id: PracticeMode;
  title: string;
  explanation: string;
  instruction: string;
  task: TutorialTask;
}

export const TUTORIAL_MODE_TRIALS: TutorialModeTrial[] = [
  { id: 'demo', title: 'Démonstration', explanation: 'Soufflet joue. Tu regardes les boutons, le soufflet et la partition sans être évalué.', instruction: 'Tu l’as déjà essayé en écoutant la première mélodie.', task: 'already-done' },
  { id: 'guided', title: 'Lecture guidée', explanation: 'Tu joues au tempo pendant que toutes les aides restent visibles.', instruction: 'Tu viens de réussir les trois notes guidées par le microphone.', task: 'already-done' },
  { id: 'wait', title: 'Attendre la bonne note', explanation: 'Le rythme est libre : la partition attend chaque bonne note avant d’avancer.', instruction: 'Joue les sept notes de la petite phrase, sans te presser.', task: 'wait-melody' },
  { id: 'performance', title: 'Performance', explanation: 'Les aides disparaissent pour vérifier ce que tu sais retrouver seul.', instruction: 'Rejoue de mémoire les trois premières notes.', task: 'memory' },
];

const WAIT_PHRASE_SOURCE = [0, 0, 0, 1, 2, 1, 0];
const WAIT_PHRASE_BEATS = [0, 1, 2, 3, 4, 6, 8];
const WAIT_PHRASE_DURATIONS = [1, 1, 1, 1, 2, 2, 2];

export function createWaitTutorialSong(source: Song): Song {
  const events = WAIT_PHRASE_SOURCE.map((sourceIndex) => source.events[sourceIndex]).filter(Boolean).map((event, index) => ({
    ...event,
    id: `${source.id}-wait-${index + 1}`,
    beat: WAIT_PHRASE_BEATS[index],
    duration: WAIT_PHRASE_DURATIONS[index],
  }));
  return {
    ...source,
    id: `${source.id}-wait-tutorial`,
    title: 'Petite phrase · Attendre la bonne note',
    duration: 10,
    events,
    accompaniment: undefined,
  };
}
