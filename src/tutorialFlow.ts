import type { PracticeMode } from './types';

export type TutorialTask = 'already-done' | 'melody' | 'rhythm' | 'bellows' | 'bass' | 'combined' | 'memory';

export interface TutorialModeTrial {
  id: PracticeMode;
  title: string;
  explanation: string;
  instruction: string;
  task: TutorialTask;
}

export const TUTORIAL_MODE_TRIALS: TutorialModeTrial[] = [
  { id: 'demo', title: 'Démonstration', explanation: 'L’application joue pendant que tu observes les boutons et le soufflet.', instruction: 'Tu viens de l’essayer avec la petite mélodie.', task: 'already-done' },
  { id: 'guided', title: 'Lecture guidée', explanation: 'La partition avance et les gestes attendus restent visibles.', instruction: 'Tu viens de réussir les trois notes guidées.', task: 'already-done' },
  { id: 'wait', title: 'Attendre la bonne note', explanation: 'La lecture ne repart que lorsque la bonne note est entendue.', instruction: 'Joue la note éclairée : rien ne presse.', task: 'melody' },
  { id: 'performance', title: 'Performance', explanation: 'Les aides visuelles disparaissent pour vérifier ce qui est réellement acquis.', instruction: 'Rejoue de mémoire les trois notes apprises.', task: 'memory' },
];
