import { describe, expect, it } from 'vitest';
import { adaptSongToAccordion, DEMO_SONG, displayNote, FALLBACK_ACCORDIONS } from './data';
import { EMPTY_PITCH_STABILITY, frequencyToPitch, rememberReliablePitch, stabilizePitchReading } from './hooks/usePitchDetector';
import { getAccordionVisualVariant, getMelodyButtonSize } from './components/accordionLayout';
import { HAND_FOCUS_OPTIONS, PRACTICE_MODES, PRIMARY_PRACTICE_MODES } from './practiceModes';
import { createWaitTutorialSong, TUTORIAL_MODE_TRIALS } from './tutorialFlow';
import { getCountInSequence, getPlaybackStartIndex, getWaitAdvance } from './practiceProgress';
import { createPracticeTimeline } from './practiceTimeline';
import { createTunerTargets, findTunerTargetIndex, nextTunerTarget } from './tunerWorkflow';
import { classifyBellows, createBellowsReference, evaluateRhythm, midiMatches, type AudioFeatureFrame, type BellowsProfile } from './audioTraining';
import { createAccordion3DPlayback } from './accordion3dPlayback';

describe('accordion configurations', () => {
  it('ships the Hohner Club I 10 + 9 + 2 layout', () => {
    const club = FALLBACK_ACCORDIONS.find((item) => item.id === 'hohner-club-i-cf-10-9-2');
    expect(club).toBeDefined();
    expect(club?.rightRows).toEqual([10, 9, 2]);
    expect(club?.buttons).toHaveLength(21);
    expect(club?.buttons.find((button) => button.isGleichton)).toMatchObject({ id: 'c1-in-5', push: 'C5', pull: 'C5' });
    expect(club?.buttons.filter((button) => button.row === 1).map((button) => [button.push, button.pull])).toEqual([
      ['F#5', 'G#5'], ['G3', 'B3'], ['C4', 'D4'], ['E4', 'F4'], ['G4', 'A4'],
      ['C5', 'B4'], ['E5', 'D5'], ['G5', 'F5'], ['C6', 'A5'], ['E6', 'B5'],
    ]);
    expect(club?.buttons.filter((button) => button.row === 2).slice(2).map((button) => [button.push, button.pull])).toEqual([
      ['F4', 'G4'], ['A4', 'A#4'], ['C5', 'C5'], ['F5', 'E5'], ['A5', 'G5'], ['C6', 'A#5'], ['F6', 'D6'],
    ]);
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

  it('ignores a brief harmonic and requires a stable note change', () => {
    const c = frequencyToPitch(261.63, .91, .08);
    const g = frequencyToPitch(392, .93, .08);
    let state = stabilizePitchReading(EMPTY_PITCH_STABILITY, c);
    expect(state.reading).toBeNull();
    state = stabilizePitchReading(state.state, c);
    expect(state.reading?.midi).toBe(60);

    const transient = stabilizePitchReading(state.state, g);
    expect(transient.reading).toBeNull();
    const recovered = stabilizePitchReading(transient.state, c);
    expect(recovered.reading?.midi).toBe(60);

    const switchOne = stabilizePitchReading(recovered.state, g);
    const switchTwo = stabilizePitchReading(switchOne.state, g);
    const switchThree = stabilizePitchReading(switchTwo.state, g);
    expect(switchOne.reading).toBeNull();
    expect(switchTwo.reading).toBeNull();
    expect(switchThree.reading?.midi).toBe(67);
  });

  it('renders the supported beginner notations', () => {
    expect(displayNote('C4', 'french', 'gc-in-4', 'push')).toBe('Do4');
    expect(displayNote('C4', 'english', 'gc-in-4', 'push')).toBe('C4');
    expect(displayNote('C4', 'button', 'gc-in-4', 'pull')).toBe('4');
    expect(displayNote('C4', 'tablature', 'gc-in-4', 'pull')).toBe('4T');
  });
});

describe('guided tuner workflow', () => {
  const accordion = FALLBACK_ACCORDIONS[0];
  const targets = createTunerTargets(accordion);

  it('checks push then pull for every melody button', () => {
    expect(targets).toHaveLength(accordion.buttons.length * 2);
    expect(targets.slice(0, 4)).toEqual([
      { buttonId: accordion.buttons[0].id, direction: 'push' },
      { buttonId: accordion.buttons[0].id, direction: 'pull' },
      { buttonId: accordion.buttons[1].id, direction: 'push' },
      { buttonId: accordion.buttons[1].id, direction: 'pull' },
    ]);
  });

  it('moves from pulling one button to pushing the next one', () => {
    const first = accordion.buttons[0];
    const next = nextTunerTarget(targets, first.id, 'pull');
    expect(next).toEqual({ buttonId: accordion.buttons[1].id, direction: 'push' });
    expect(findTunerTargetIndex(targets, next!.buttonId, next!.direction)).toBe(2);
  });
});

describe('first lesson tutorial', () => {
  it('introduces only the four primary practice modes', () => {
    expect(PRIMARY_PRACTICE_MODES.map((mode) => mode.id)).toEqual(['demo', 'guided', 'wait', 'performance']);
    expect(TUTORIAL_MODE_TRIALS.map((trial) => trial.id)).toEqual(PRIMARY_PRACTICE_MODES.map((mode) => mode.id));
    expect(TUTORIAL_MODE_TRIALS.map((trial) => trial.task)).toEqual(['already-done', 'already-done', 'wait-melody', 'memory']);
  });

  it('keeps hands as a focus and rhythm or bellows as supplemental workshops', () => {
    expect(PRACTICE_MODES.map((mode) => mode.id)).toEqual(['demo', 'guided', 'wait', 'performance', 'rhythm', 'bellows']);
    expect(HAND_FOCUS_OPTIONS.map((option) => option.id)).toEqual(['right', 'left', 'both']);
    expect(PRACTICE_MODES.some((mode) => ['right', 'left', 'combined'].includes(mode.id))).toBe(false);
  });

  it('uses a recognizable seven-note phrase in wait mode', () => {
    const phrase = createWaitTutorialSong(DEMO_SONG);
    expect(phrase.events.map((event) => event.midi)).toEqual([60, 60, 60, 62, 64, 62, 60]);
    expect(phrase.events.map((event) => event.beat)).toEqual([0, 1, 2, 3, 4, 6, 8]);
    expect(phrase.accompaniment).toBeUndefined();
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

  it('restarts a completed session from the beginning in one action', () => {
    expect(getPlaybackStartIndex(11, true, false, 0)).toBe(0);
    expect(getPlaybackStartIndex(11, true, true, 3)).toBe(3);
    expect(getPlaybackStartIndex(6, false, false, 0)).toBe(6);
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

  it('builds a dedicated bass-and-chord timeline when the left hand is selected', () => {
    const song = adaptSongToAccordion(DEMO_SONG, FALLBACK_ACCORDIONS[1]);
    const timeline = createPracticeTimeline(song, 'left');
    expect(timeline).toHaveLength(song.accompaniment?.length ?? 0);
    expect(timeline.every((event) => event.hand === 'left' && event.buttonId === '' && Boolean(event.bassButtonId))).toBe(true);
    expect(createPracticeTimeline(song, 'right')).toBe(song.events);
    expect(createPracticeTimeline(song, 'both')).toBe(song.events);
  });
});

describe('accordion 3D demonstration', () => {
  it('synchronizes the adapted melody, accompaniment and bellows direction', () => {
    const accordion = FALLBACK_ACCORDIONS.find((item) => item.id === 'hohner-club-i-cf-10-9-2')!;
    const song = adaptSongToAccordion(DEMO_SONG, accordion);
    const playback = createAccordion3DPlayback(song);

    expect(playback.cues.length).toBe(song.events.length + (song.accompaniment?.length ?? 0));
    expect(playback.cues.every((cue) => accordion.buttons.concat(accordion.basses).some((button) => button.id === cue.buttonId))).toBe(true);
    expect(new Set(playback.cues.map((cue) => cue.hand))).toEqual(new Set(['left', 'right']));
    expect(playback.cues.map((cue) => cue.atMs)).toEqual([...playback.cues].map((cue) => cue.atMs).sort((left, right) => left - right));
    expect(playback.durationMs).toBeGreaterThan(15_000);
  });
});
