import { describe, expect, it } from 'vitest';
import { displayNote, FALLBACK_ACCORDIONS } from './data';
import { frequencyToPitch } from './hooks/usePitchDetector';
import { getMelodyButtonSize } from './components/accordionLayout';
import { PRACTICE_MODES } from './practiceModes';
import { TUTORIAL_MODE_TRIALS } from './tutorialFlow';

describe('accordion configurations', () => {
  it('ships the Hohner Club I 10 + 9 + 2 layout', () => {
    const club = FALLBACK_ACCORDIONS.find((item) => item.id === 'hohner-club-i-cf-10-9-2');
    expect(club).toBeDefined();
    expect(club?.rightRows).toEqual([10, 9, 2]);
    expect(club?.buttons).toHaveLength(21);
    expect(club?.buttons.some((button) => button.isGleichton)).toBe(true);
  });

  it('keeps every button mapping playable', () => {
    for (const accordion of FALLBACK_ACCORDIONS) {
      expect(accordion.buttons).toHaveLength(accordion.rightRows.reduce((sum, count) => sum + count, 0));
      for (const button of accordion.buttons) {
        expect(button.pushMidi).toBeGreaterThanOrEqual(0);
        expect(button.pullMidi).toBeLessThanOrEqual(127);
      }
    }
  });

  it('fits long melody rows inside the visual keyboard', () => {
    const buttonSize = getMelodyButtonSize(11);
    expect(buttonSize).toBe(27);
    expect(buttonSize * 11 + 2 * 10).toBeLessThanOrEqual(318);
  });
});

describe('pitch and notation', () => {
  it('converts concert A to A4', () => {
    expect(frequencyToPitch(440)).toMatchObject({ note: 'A4', midi: 69, cents: 0 });
  });

  it('reports cents around the nearest semitone', () => {
    expect(frequencyToPitch(445).cents).toBeGreaterThan(15);
    expect(frequencyToPitch(435).cents).toBeLessThan(-15);
  });

  it('renders the supported beginner notations', () => {
    expect(displayNote('C4', 'french', 'gc-in-4', 'push')).toBe('Do4');
    expect(displayNote('C4', 'english', 'gc-in-4', 'push')).toBe('C4');
    expect(displayNote('C4', 'button', 'gc-in-4', 'pull')).toBe('4');
    expect(displayNote('C4', 'tablature', 'gc-in-4', 'pull')).toBe('4T');
  });
});

describe('first lesson tutorial', () => {
  it('includes a validated trial for every practice mode', () => {
    expect(TUTORIAL_MODE_TRIALS.map((trial) => trial.id)).toEqual(PRACTICE_MODES.map((mode) => mode.id));
  });
});
