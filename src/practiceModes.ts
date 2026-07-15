import type { PracticeMode } from './types';

export interface PracticeModeDefinition {
  id: PracticeMode;
  label: string;
  short: string;
}

export const PRACTICE_MODES: PracticeModeDefinition[] = [
  { id: 'demo', label: 'Démonstration', short: 'Regarde et écoute' },
  { id: 'guided', label: 'Lecture guidée', short: 'Joue avec l’aide' },
  { id: 'wait', label: 'Attendre la bonne note', short: 'À ton rythme' },
  { id: 'notes', label: 'Notes uniquement', short: 'Sans accompagnement' },
  { id: 'rhythm', label: 'Rythme uniquement', short: 'Sur une seule note' },
  { id: 'bellows', label: 'Soufflet uniquement', short: 'Travaille les directions' },
  { id: 'right', label: 'Main droite', short: 'Mélodie seule' },
  { id: 'left', label: 'Main gauche', short: 'Basses seules' },
  { id: 'combined', label: 'Mains combinées', short: 'Coordination' },
  { id: 'performance', label: 'Performance', short: 'Sans assistance' },
];
