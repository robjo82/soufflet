import { describe, expect, it } from 'vitest';
import { eventsForHand, matchesPianoEvent, pianoNoteLabel, pianoRange } from './piano';

describe('piano learning helpers', () => {
  it('builds standard keyboard ranges', () => {
    expect(pianoRange(88)).toHaveLength(88);
    expect(pianoRange(88)[0]).toBe(21);
    expect(pianoRange(61)).toEqual(expect.arrayContaining([60]));
  });

  it('labels and filters independent hands', () => {
    const arrangement = {
      instrumentType: 'piano' as const, difficulty: 1, provenance: 'test',
      events: [
        { id: 'r', beat: 0, duration: 1, midis: [60], hand: 'right' as const },
        { id: 'l', beat: 0, duration: 1, midis: [48, 52, 55], hand: 'left' as const },
      ],
    };
    expect(pianoNoteLabel(60, 'french')).toBe('Do4');
    expect(eventsForHand(arrangement, 'right').map((event) => event.id)).toEqual(['r']);
    expect(matchesPianoEvent(arrangement.events[1], 52)).toBe(true);
  });
});
