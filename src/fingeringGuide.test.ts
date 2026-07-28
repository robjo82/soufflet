import { describe, expect, it } from 'vitest';
import type { AccordionConfig, SongEvent } from './types';
import { getFingeringMoment, planMelodyFingering } from './fingeringGuide';

const accordion: AccordionConfig = {
  id: 'test',
  maker: 'Test',
  model: 'Deux rangs',
  tuning: 'Sol/Do',
  color: '#000000',
  rightRows: [4, 4],
  bassCount: 0,
  description: '',
  verified: true,
  basses: [],
  buttons: [
    ...[4, 5, 6, 7].map((index) => ({
      id: `outer-${index}`, row: 1, index, push: 'C4', pull: 'D4', pushMidi: 60 + index, pullMidi: 61 + index,
    })),
    ...[4, 5, 6, 7].map((index) => ({
      id: `inner-${index}`, row: 2, index, push: 'E4', pull: 'F4', pushMidi: 64 + index, pullMidi: 65 + index,
    })),
  ],
};

function event(id: string, buttonId: string, beat: number): SongEvent {
  return {
    id,
    beat,
    duration: 1,
    midi: 60,
    note: 'C4',
    buttonId,
    direction: 'push',
    finger: 2,
  };
}

describe('planMelodyFingering', () => {
  it('keeps a four-button scale under the four melody fingers', () => {
    const planned = planMelodyFingering([
      event('one', 'inner-4', 0),
      event('two', 'inner-5', 1),
      event('three', 'inner-6', 2),
      event('four', 'inner-7', 3),
    ], accordion);

    expect(planned.map((item) => item.finger)).toEqual([2, 3, 4, 5]);
  });

  it('keeps the same finger on repeated notes and across the same row position', () => {
    const planned = planMelodyFingering([
      event('one', 'inner-5', 0),
      event('two', 'inner-5', 1),
      event('three', 'outer-5', 2),
    ], accordion);

    expect(planned[1].finger).toBe(planned[0].finger);
    expect(planned[2].finger).toBe(planned[1].finger);
  });

  it('describes the current finger and anticipates the next one', () => {
    const planned = planMelodyFingering([
      event('one', 'inner-4', 0),
      event('two', 'inner-5', 1),
      event('three', 'inner-6', 2),
    ], accordion);
    const moment = getFingeringMoment(planned, 0, accordion);

    expect(moment?.current).toMatchObject({ symbol: 'I', name: 'Index', button: 4, row: 2 });
    expect(moment?.next.map((item) => item.symbol)).toEqual(['M', 'A']);
    expect(moment?.advice).toContain('Prépare déjà le majeur');
  });
});
