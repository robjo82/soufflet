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
  { id: 'rhythm', title: 'Rythme uniquement', explanation: 'Le micro repère chaque attaque pour vérifier des pulsations régulières.', instruction: 'Sur ton accordéon, joue quatre notes courtes et régulières.', task: 'rhythm' },
  { id: 'bellows', title: 'Soufflet uniquement', explanation: 'Après une courte calibration, le micro distingue ouvrir et fermer sur un même bouton.', instruction: 'Tiens le bouton indiqué : pousse, relâche, puis tire.', task: 'bellows' },
  { id: 'right', title: 'Main droite', explanation: 'Le micro évalue uniquement la note mélodique, sans les basses.', instruction: 'Sur ton accordéon, joue le bouton mélodique éclairé.', task: 'melody' },
  { id: 'left', title: 'Main gauche', explanation: 'Le micro écoute la basse avant de passer à la coordination.', instruction: 'Sur ton accordéon, joue la basse éclairée.', task: 'bass' },
  { id: 'combined', title: 'Mains combinées', explanation: 'Le micro vérifie que la basse arrive avant la note de mélodie.', instruction: 'Sur ton accordéon, joue la basse, relâche, puis la note éclairée.', task: 'combined' },
  { id: 'performance', title: 'Performance', explanation: 'Les aides visuelles disparaissent pour vérifier ce qui est réellement acquis.', instruction: 'Rejoue de mémoire les trois notes apprises.', task: 'memory' },
];
