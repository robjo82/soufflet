import { useEffect, useMemo } from 'react';
import { metronomePulses, metronomeWindow } from '../metronome';

interface MetronomeOptions {
  enabled: boolean;
  endBeat: number;
  beatsPerMeasure: number;
  measureBeats?: readonly number[];
  timeAtBeat: (beat: number) => number;
  click: (accent: boolean, at: number) => void;
  stopClicks: () => void;
}

export function useMetronome({ enabled, endBeat, beatsPerMeasure, measureBeats, timeAtBeat, click, stopClicks }: MetronomeOptions) {
  const pulses = useMemo(() => metronomePulses(endBeat, beatsPerMeasure, measureBeats), [beatsPerMeasure, endBeat, measureBeats]);
  useEffect(() => {
    if (!enabled) return;
    let lastScheduledAt = -Infinity;
    const schedule = () => {
      for (const pulse of metronomeWindow(pulses, timeAtBeat, performance.now(), lastScheduledAt)) {
        click(pulse.accent, pulse.at);
        lastScheduledAt = pulse.at;
      }
    };
    schedule();
    const timer = window.setInterval(schedule, 25);
    return () => { window.clearInterval(timer); stopClicks(); };
  }, [click, enabled, pulses, stopClicks, timeAtBeat]);
}
