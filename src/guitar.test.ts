import { describe, expect, it } from 'vitest';
import { guitarFrequency, guitarLyricCueAtBeat, guitarNoteLabel, guitarTimelineLayout, nearestGuitarString, positionsForGuitar } from './guitar';
import type { GuitarConfig } from './types';

const guitar: GuitarConfig = {
  id: 'test', instrumentType: 'guitar', name: 'Test', fretCount: 20, capo: 0, handedness: 'right', input: 'microphone',
  strings: [{ number: 6, note: 'E2', midi: 40 }, { number: 5, note: 'A2', midi: 45 }, { number: 4, note: 'D3', midi: 50 }, { number: 3, note: 'G3', midi: 55 }, { number: 2, note: 'B3', midi: 59 }, { number: 1, note: 'E4', midi: 64 }],
};

describe('guitar helpers', () => {
  it('maps notes to playable tablature positions', () => {
    expect(positionsForGuitar([64, 67], guitar)).toEqual(expect.arrayContaining([expect.objectContaining({ fret: expect.any(Number), string: expect.any(Number) })]));
    expect(positionsForGuitar([64], guitar)[0]).toMatchObject({ string: 1, fret: 0, finger: 0 });
  });

  it('supports tuner labels, frequencies and automatic string selection', () => {
    expect(guitarNoteLabel(64)).toBe('Mi4');
    expect(guitarFrequency(69)).toBeCloseTo(440);
    expect(nearestGuitarString(41, guitar).number).toBe(6);
  });

  it('shows four measures ahead while keeping the previous beat visible', () => {
    const timeline = guitarTimelineLayout([
      { id: 'past', beat: 7, duration: 1, midis: [60], hand: 'right', part: 'melody' },
      { id: 'near', beat: 10, duration: 1, midis: [62], hand: 'right', part: 'melody' },
      { id: 'far', beat: 25, duration: 1, midis: [64], hand: 'right', part: 'melody' },
      { id: 'outside', beat: 27, duration: 1, midis: [65], hand: 'right', part: 'melody' },
    ], 10);

    expect(timeline.map(({ event }) => event.id)).toEqual(['near', 'far']);
    expect(timeline[0].left).toBeCloseTo(100 / 17);
    expect(timeline[1].left).toBeCloseTo(16 / 17 * 100);
  });

  it('synchronizes the current lyric word with the guitar timeline', () => {
    const cue = guitarLyricCueAtBeat([
      { beat: 0, text: 'Au clair de la lune', section: 'Couplet' },
      { beat: 4, text: 'Mon ami Pierrot', section: 'Couplet' },
    ], 2, 8);

    expect(cue.current?.text).toBe('Au clair de la lune');
    expect(cue.next?.text).toBe('Mon ami Pierrot');
    expect(cue.words[cue.activeWord]).toBe('de');
  });
});
