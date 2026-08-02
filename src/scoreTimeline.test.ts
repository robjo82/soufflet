import { describe, expect, it } from 'vitest';
import { createTwoHandScoreTimeline, melodyIndexAtBeat } from './scoreTimeline';
import type { Song } from './types';

const song = {
  timeSignature: [4, 4],
  events: [
    { id: 'right-long', beat: 0, duration: 4 },
    { id: 'right-next', beat: 4, duration: 1 },
  ],
  accompaniment: [
    { id: 'bass', beat: 0, duration: 1 },
    { id: 'chord-one', beat: 1, duration: 1 },
    { id: 'chord-two', beat: 2, duration: 2 },
    { id: 'bass-next', beat: 4, duration: 2 },
  ],
} as Song;

describe('two-hand score timeline', () => {
  it('keeps several independent left-hand attacks under one held melody note', () => {
    const timeline = createTwoHandScoreTimeline(song);

    expect(song.events[0]).toMatchObject({ beat: 0, duration: 4 });
    expect(song.accompaniment?.slice(0, 3).map(({ beat, duration }) => ({ beat, duration }))).toEqual([
      { beat: 0, duration: 1 },
      { beat: 1, duration: 1 },
      { beat: 2, duration: 2 },
    ]);
    expect(timeline).toEqual({ totalBeats: 6, measureStarts: [0, 4] });
  });

  it('maps a left-hand attack inside a held note to that melody gesture', () => {
    expect(melodyIndexAtBeat(song.events, 0)).toBe(0);
    expect(melodyIndexAtBeat(song.events, 1)).toBe(0);
    expect(melodyIndexAtBeat(song.events, 3)).toBe(0);
    expect(melodyIndexAtBeat(song.events, 4)).toBe(1);
  });
});
