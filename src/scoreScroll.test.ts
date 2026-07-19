import { describe, expect, it } from 'vitest';
import { getScoreScrollTarget } from './scoreScroll';

const geometry = (overrides: Partial<Parameters<typeof getScoreScrollTarget>[0]> = {}) => ({
  activeLeft: 0,
  activeWidth: 80,
  contentWidth: 2400,
  currentScrollLeft: 0,
  viewportWidth: 800,
  ...overrides,
});

describe('score auto-scroll', () => {
  it('keeps the opening notes in the initial viewport', () => {
    expect(getScoreScrollTarget(geometry({ activeLeft: 360 }))).toBe(0);
  });

  it('moves by a reading section only after the forward threshold is crossed', () => {
    expect(getScoreScrollTarget(geometry({ activeLeft: 450 }))).toBe(202);
  });

  it('does not chase every note while it stays in the reading window', () => {
    expect(getScoreScrollTarget(geometry({ activeLeft: 560, currentScrollLeft: 202 }))).toBe(202);
  });

  it('stops on the last complete viewport before the final notes', () => {
    expect(getScoreScrollTarget(geometry({ activeLeft: 2250, currentScrollLeft: 1200 }))).toBe(1600);
    expect(getScoreScrollTarget(geometry({ activeLeft: 2320, currentScrollLeft: 1600 }))).toBe(1600);
  });

  it('returns to an earlier section after a restart or manual selection', () => {
    expect(getScoreScrollTarget(geometry({ activeLeft: 640, currentScrollLeft: 900 }))).toBe(456);
    expect(getScoreScrollTarget(geometry({ activeLeft: 40, currentScrollLeft: 900 }))).toBe(0);
  });

  it('does not scroll when the complete score already fits', () => {
    expect(getScoreScrollTarget(geometry({ contentWidth: 760 }))).toBe(0);
  });
});
