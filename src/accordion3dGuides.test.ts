import { describe, expect, it } from 'vitest';
import { getAccordionDirectionGuide } from './accordion3dGuides';

describe('getAccordionDirectionGuide', () => {
  it('écarte les flèches lorsque le soufflet doit être tiré', () => {
    expect(getAccordionDirectionGuide('pull')).toEqual({
      label: 'Tirer : ouvrir le soufflet',
      leftArrow: '←',
      rightArrow: '→',
    });
  });

  it('rapproche les flèches lorsque le soufflet doit être poussé', () => {
    expect(getAccordionDirectionGuide('push')).toEqual({
      label: 'Pousser : refermer le soufflet',
      leftArrow: '→',
      rightArrow: '←',
    });
  });
});
