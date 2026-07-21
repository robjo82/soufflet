import { describe, expect, it } from 'vitest';
import { canAcceptWaitPitch, selectPitchAssessmentIndex } from './practicePitchAssessment';
import type { SongEvent } from './types';

const event = (id: string, beat: number, midi: number, duration = .5, hand: SongEvent['hand'] = 'right'): SongEvent => ({
  id, beat, duration, midi, note: id, buttonId: id, direction: 'push', finger: 2, hand,
});

describe('live practice pitch alignment', () => {
  const melody = [event('D5', 0, 74), event('E5', .5, 76), event('G5', 1, 79)];

  it('attributes a slightly delayed reading to the preceding short note', () => {
    expect(selectPitchAssessmentIndex(melody, 1, 74, .58)).toBe(0);
  });

  it('keeps the current target when its pitch is heard', () => {
    expect(selectPitchAssessmentIndex(melody, 1, 76, .62)).toBe(1);
  });

  it('does not revive a stale pitch outside the latency window', () => {
    expect(selectPitchAssessmentIndex(melody, 2, 74, 1.2)).toBe(2);
  });

  it('accepts the equivalent octave used by a left-hand reed', () => {
    const basses = [event('C bass', 0, 48, 1, 'left'), event('G bass', 1, 55, 1, 'left')];
    expect(selectPitchAssessmentIndex(basses, 0, 36, .3)).toBe(0);
  });

  it('accepts a repeated pitch only after a fresh attack', () => {
    expect(canAcceptWaitPitch(76, 76, 1_000, 600)).toBe(false);
    expect(canAcceptWaitPitch(76, 76, 100, 0)).toBe(false);
    expect(canAcceptWaitPitch(76, 76, 1_000, 900)).toBe(true);
    expect(canAcceptWaitPitch(76, 79, 1_000, 600)).toBe(true);
  });
});
