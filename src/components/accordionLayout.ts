import type { AccordionConfig } from '../types';

const MELODY_ROW_HEIGHT = 318;
const MELODY_BUTTON_GAP = 2;

export function getMelodyButtonSize(buttonCount: number) {
  const safeCount = Math.max(1, buttonCount);
  const availableForButtons = MELODY_ROW_HEIGHT - (safeCount - 1) * MELODY_BUTTON_GAP;
  return Math.max(8, Math.min(30, Math.floor(availableForButtons / safeCount)));
}

export function getAccordionVisualVariant(config: Pick<AccordionConfig, 'maker' | 'model'>) {
  return config.maker.toLowerCase().includes('hohner') && config.model.toLowerCase().includes('club i')
    ? 'club-i'
    : 'classic';
}
