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
  { id: 'notes', title: 'Notes uniquement', explanation: 'Tu travailles la hauteur des notes sans accompagnement.', instruction: 'Joue une fois la note éclairée.', task: 'melody' },
  { id: 'rhythm', title: 'Rythme uniquement', explanation: 'La hauteur disparaît pour concentrer toute ton attention sur le tempo.', instruction: 'Tape quatre pulsations régulières.', task: 'rhythm' },
  { id: 'bellows', title: 'Soufflet uniquement', explanation: 'Les notes passent au second plan : tu répètes seulement pousser et tirer.', instruction: 'Fais pousser, puis tirer avec les commandes.', task: 'bellows' },
  { id: 'right', title: 'Main droite', explanation: 'Seule la mélodie est évaluée, sans les basses.', instruction: 'Joue le bouton mélodique éclairé.', task: 'melody' },
  { id: 'left', title: 'Main gauche', explanation: 'Tu isoles les basses et les accords avant de coordonner les deux mains.', instruction: 'Touche la basse éclairée sur la représentation.', task: 'bass' },
  { id: 'combined', title: 'Mains combinées', explanation: 'L’application vérifie l’ordre et l’écart entre la basse et la mélodie.', instruction: 'Joue la basse, puis la note mélodique.', task: 'combined' },
  { id: 'performance', title: 'Performance', explanation: 'Les aides visuelles disparaissent pour vérifier ce qui est réellement acquis.', instruction: 'Rejoue de mémoire les trois notes apprises.', task: 'memory' },
];
