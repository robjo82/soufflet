import { describe, expect, it } from 'vitest';
import { metronomePulses, metronomeWindow } from './metronome';


describe('score metronome', () => {
  it('keeps a steady pulse through held notes and rests, with one accent per measure', () => {
    const pulses = metronomePulses(9, 4);
    expect(pulses.map((pulse) => pulse.beat)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(pulses.filter((pulse) => pulse.accent).map((pulse) => pulse.beat)).toEqual([0, 4, 8]);
    expect(metronomePulses(6, 3).filter((pulse) => pulse.accent).map((pulse) => pulse.beat)).toEqual([0, 3]);
  });

  it('accents real measure starts after a pickup, including fractional and shortened measures', () => {
    expect(metronomePulses(6.5, 4, [.5, 4.5])).toEqual([
      { beat: .5, accent: true }, { beat: 1.5, accent: false }, { beat: 2.5, accent: false }, { beat: 3.5, accent: false },
      { beat: 4.5, accent: true }, { beat: 5.5, accent: false },
    ]);
    expect(metronomePulses(5, 4, [1, 3]).filter((pulse) => pulse.accent).map((pulse) => pulse.beat)).toEqual([1, 3]);
    expect(metronomePulses(5, 4, [1, 3])[0]).toEqual({ beat: 0, accent: false });
  });

  it('follows the speed chosen for the score', () => {
    const pulses = metronomePulses(8, 4);
    const timeAtBeat = (beat: number) => 3000 + beat * 60000 / (60 * .5);
    expect(metronomeWindow(pulses, timeAtBeat, 10950, -Infinity)).toEqual([{ beat: 4, accent: true, at: 11000 }]);
    expect(metronomeWindow(pulses, timeAtBeat, 12950, 11000)).toEqual([{ beat: 5, accent: false, at: 13000 }]);
  });

  it('waits for the piece to start, schedules ahead, and never repeats a pulse in overlapping windows', () => {
    const pulses = metronomePulses(8, 4);
    const timeAtBeat = (beat: number) => 3000 + beat * 500;
    expect(metronomeWindow(pulses, timeAtBeat, 1000, -Infinity)).toEqual([]);
    expect(metronomeWindow(pulses, timeAtBeat, 2900, -Infinity)).toEqual([{ beat: 0, accent: true, at: 3000 }]);
    expect(metronomeWindow(pulses, timeAtBeat, 2950, 3000)).toEqual([]);
    expect(metronomeWindow(pulses, timeAtBeat, 5000, 3000)).toEqual([{ beat: 4, accent: true, at: 5000 }]);
    expect(metronomeWindow(pulses, timeAtBeat, 7000, 6500)).toEqual([]);
  });

  it('resumes on the next beat without restarting the measure', () => {
    const pulses = metronomePulses(8, 4);
    const resumedStart = 3000 + (9250 - 4250);
    const resumedTimeAtBeat = (beat: number) => resumedStart + beat * 500;
    expect(metronomeWindow(pulses, resumedTimeAtBeat, 9250, -Infinity)).toEqual([]);
    expect(metronomeWindow(pulses, resumedTimeAtBeat, 9400, -Infinity)).toEqual([{ beat: 3, accent: false, at: 9500 }]);
  });

  it('schedules a loop again when its timeline origin advances', () => {
    const pulses = metronomePulses(6, 4);
    expect(metronomeWindow(pulses, (beat) => beat < 2 ? -Infinity : 5000 + (beat - 2) * 500, 5000, 1500)).toEqual([{ beat: 2, accent: false, at: 5000 }]);
  });

  it('does not click for an empty or invalid score', () => {
    expect(metronomePulses(0, 4)).toEqual([]);
    expect(metronomePulses(Infinity, 4)).toEqual([]);
    expect(metronomePulses(4, 0)).toEqual([]);
  });
});
