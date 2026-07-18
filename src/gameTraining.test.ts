import { describe, expect, it } from 'vitest';
import { FALLBACK_ACCORDIONS } from './data';
import { BUTTON_GAME_LEVELS, createGameTargets, gameNoteLabel, selectGameButtons, timingGrade } from './gameTraining';

describe('button learning game', () => {
  it('selects adjacent central buttons from the configured accordion', () => {
    const accordion = FALLBACK_ACCORDIONS.find((item) => item.id === 'hohner-club-i-cf-10-9-2')!;
    const buttons = selectGameButtons(accordion, 3);
    expect(buttons.map((button) => button.row)).toEqual([2, 2, 2]);
    expect(buttons.map((button) => button.index)).toEqual([4, 5, 6]);
  });

  it('builds a deterministic push-only beginner sequence', () => {
    const buttons = selectGameButtons(FALLBACK_ACCORDIONS[1], 3);
    const targets = createGameTargets(buttons, BUTTON_GAME_LEVELS[0]);
    expect(targets).toHaveLength(12);
    expect(new Set(targets.map((target) => target.direction))).toEqual(new Set(['push']));
    expect(targets.every((target) => target.midi === buttons[target.lane].pushMidi)).toBe(true);
  });

  it('uses explicit direction in tablature labels', () => {
    const target = { note: 'C#5', buttonId: 'gc-in-4', direction: 'pull' as const };
    expect(gameNoteLabel(target, 'tablature')).toBe('4T');
    expect(gameNoteLabel(target, 'french')).toBe('Do♯5');
  });

  it('distinguishes early, on-time and late attacks', () => {
    expect(timingGrade(-151)).toBe('early');
    expect(timingGrade(0)).toBe('perfect');
    expect(timingGrade(151)).toBe('late');
  });
});
