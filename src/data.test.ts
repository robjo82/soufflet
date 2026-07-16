import { describe, expect, it } from 'vitest';
import { adaptSongToAccordion, DEMO_SONG, displayNote, FALLBACK_ACCORDIONS } from './data';
import { frequencyToPitch, rememberReliablePitch } from './hooks/usePitchDetector';
import { getAccordionVisualVariant, getMelodyButtonSize } from './components/accordionLayout';
import { PRACTICE_MODES } from './practiceModes';
import { TUTORIAL_MODE_TRIALS } from './tutorialFlow';
import { getCountInSequence, getWaitAdvance } from './practiceProgress';
import { classifyBellows, createBellowsReference, evaluateRhythm, midiMatches, type AudioFeatureFrame, type BellowsProfile } from './audioTraining';

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

  it('selects the model-specific Club I visual profile', () => {
    const club = FALLBACK_ACCORDIONS.find((item) => item.id === 'hohner-club-i-cf-10-9-2')!;
    expect(getAccordionVisualVariant(club)).toBe('club-i');
    expect(getAccordionVisualVariant(FALLBACK_ACCORDIONS[1])).toBe('classic');
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

  it('keeps the last reliable tuner note until another reliable note arrives', () => {
    const previous = frequencyToPitch(440, 0.9, 0.1);
    const ambiguous = frequencyToPitch(261.63, 0.65, 0.01);
    const next = frequencyToPitch(293.66, 0.91, 0.1);
    expect(rememberReliablePitch(previous, null)).toBe(previous);
    expect(rememberReliablePitch(previous, ambiguous)).toBe(previous);
    expect(rememberReliablePitch(previous, next)).toBe(next);
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

  it('requires the real instrument for rhythm, bellows and both hands', () => {
    expect(TUTORIAL_MODE_TRIALS.find((trial) => trial.id === 'rhythm')?.instruction).toContain('accordéon');
    expect(TUTORIAL_MODE_TRIALS.find((trial) => trial.id === 'left')?.instruction).toContain('accordéon');
    expect(TUTORIAL_MODE_TRIALS.find((trial) => trial.id === 'combined')?.instruction).toContain('accordéon');
  });
});

describe('microphone-first training', () => {
  const frame = (midi: number, frequency: number, at = 0): AudioFeatureFrame => ({
    at,
    volume: .08,
    spectralCentroid: frequency * 2.4,
    brightness: .12,
    pitch: { midi, frequency, note: `N${midi}`, cents: 0, confidence: .9, volume: .08 },
  });

  it('builds compact bellows references without retaining audio samples', () => {
    const reference = createBellowsReference('push', Array.from({ length: 8 }, (_, index) => frame(60, 261.63 + index * .03, index * 70)));
    expect(reference).toMatchObject({ direction: 'push', midi: 60, samples: 8 });
    expect(reference).not.toHaveProperty('audio');
  });

  it('classifies a calibrated push and rejects a weak signal', () => {
    const profile: BellowsProfile = {
      accordionId: 'test', buttonId: 'button-1', createdAt: '2026-07-16T00:00:00.000Z',
      push: createBellowsReference('push', Array.from({ length: 8 }, () => frame(60, 261.63)))!,
      pull: createBellowsReference('pull', Array.from({ length: 8 }, () => frame(62, 293.66)))!,
    };
    expect(classifyBellows(frame(60, 261.7), profile)).toMatchObject({ direction: 'push', reason: 'matched' });
    expect(classifyBellows({ ...frame(60, 261.7), volume: .001, pitch: null }, profile)).toMatchObject({ direction: null, reason: 'weak-signal' });
  });

  it('accepts regular attacks and catches an irregular rhythm', () => {
    expect(evaluateRhythm([0, 600, 1200, 1800]).regular).toBe(true);
    expect(evaluateRhythm([0, 250, 1100, 1400]).regular).toBe(false);
  });

  it('tolerates the common octave error for a bass note only', () => {
    expect(midiMatches(48, 60)).toBe(true);
    expect(midiMatches(48, 61)).toBe(false);
  });
});

describe('practice progression', () => {
  it('counts down one complete measure before playback', () => {
    expect(getCountInSequence(4)).toEqual([4, 3, 2, 1]);
    expect(getCountInSequence(3)).toEqual([3, 2, 1]);
  });

  it('advances one note at a time and finishes on the boundary', () => {
    expect(getWaitAdvance(0, 3, false, 0, 2)).toEqual({ nextIndex: 1, finished: false, looped: false });
    expect(getWaitAdvance(1, 3, false, 0, 2)).toEqual({ nextIndex: 2, finished: false, looped: false });
    expect(getWaitAdvance(2, 3, false, 0, 2)).toEqual({ nextIndex: 2, finished: true, looped: false });
  });

  it('returns to the loop start after the selected final note', () => {
    expect(getWaitAdvance(4, 8, true, 2, 4)).toEqual({ nextIndex: 2, finished: false, looped: true });
  });
});

describe('left-hand accompaniment', () => {
  it('adapts basses and chords to the selected accordion and bellows direction', () => {
    const accordion = FALLBACK_ACCORDIONS.find((item) => item.id === 'standard-gc-21-8')!;
    const song = adaptSongToAccordion(DEMO_SONG, accordion);
    expect(song.accompaniment?.length).toBeGreaterThan(3);
    expect(new Set(song.accompaniment?.map((event) => event.role))).toEqual(new Set(['bass', 'chord']));
    for (const accompaniment of song.accompaniment ?? []) {
      const button = accordion.basses.find((item) => item.id === accompaniment.buttonId);
      expect(button).toBeDefined();
      expect(accompaniment.midi).toBe(accompaniment.direction === 'push' ? button?.pushMidi : button?.pullMidi);
      expect(accompaniment.note.replace(/-?\d+$/, '')).toBe(accompaniment.chord);
    }
  });
});
