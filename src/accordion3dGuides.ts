import type { Direction } from './types';

export interface AccordionDirectionGuide {
  label: string;
  leftArrow: '←' | '→';
  rightArrow: '←' | '→';
}

export function getAccordionDirectionGuide(direction: Direction): AccordionDirectionGuide {
  if (direction === 'push') {
    return {
      label: 'Pousser : refermer le soufflet',
      leftArrow: '→',
      rightArrow: '←',
    };
  }

  return {
    label: 'Tirer : ouvrir le soufflet',
    leftArrow: '←',
    rightArrow: '→',
  };
}
