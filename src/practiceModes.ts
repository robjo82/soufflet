import type { Hand, PracticeMode, PrimaryPracticeMode, SupplementalPracticeMode } from './types';

export interface PracticeModeDefinition {
  id: PrimaryPracticeMode | SupplementalPracticeMode;
  label: string;
  short: string;
  group: 'primary' | 'supplemental';
}

export const PRIMARY_PRACTICE_MODES: PracticeModeDefinition[] = [
  { id: 'demo', label: 'Démonstration', short: 'L’application joue, tu observes', group: 'primary' },
  { id: 'guided', label: 'Lecture guidée', short: 'Joue au tempo avec les repères', group: 'primary' },
  { id: 'wait', label: 'Attendre la bonne note', short: 'La partition avance après chaque réussite', group: 'primary' },
  { id: 'performance', label: 'Performance', short: 'Joue sans assistance visuelle', group: 'primary' },
];

export const SUPPLEMENTAL_PRACTICE_MODES: PracticeModeDefinition[] = [
  { id: 'rhythm', label: 'Rythme uniquement', short: 'Travail ciblé des attaques', group: 'supplemental' },
  { id: 'bellows', label: 'Soufflet uniquement', short: 'Travail ciblé des directions', group: 'supplemental' },
];

export const PRACTICE_MODES = [...PRIMARY_PRACTICE_MODES, ...SUPPLEMENTAL_PRACTICE_MODES];

const LEGACY_LABELS: Partial<Record<PracticeMode, { label: string; short: string }>> = {
  notes: { label: 'Notes uniquement', short: 'Ancienne séance mélodique' },
  right: { label: 'Lecture guidée', short: 'Main droite' },
  left: { label: 'Lecture guidée', short: 'Main gauche' },
  combined: { label: 'Lecture guidée', short: 'Deux mains' },
  game: { label: 'Jeu des touches', short: 'Mémoire et rythme' },
};

export function practiceModeLabel(mode: PracticeMode) {
  return PRACTICE_MODES.find((definition) => definition.id === mode)?.label ?? LEGACY_LABELS[mode]?.label ?? mode;
}

export const HAND_FOCUS_OPTIONS: Array<{ id: Hand; label: string; short: string }> = [
  { id: 'right', label: 'Mélodie', short: 'Main droite' },
  { id: 'left', label: 'Basses', short: 'Main gauche' },
  { id: 'both', label: 'Deux mains', short: 'Coordination' },
];
