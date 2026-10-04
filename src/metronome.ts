export interface MetronomePulse {
  beat: number;
  accent: boolean;
}

// Beats use the same unit as the score, including pickups and shortened measures.
export function metronomePulses(endBeat: number, beatsPerMeasure: number, measureBeats?: readonly number[]): MetronomePulse[] {
  if (!Number.isFinite(endBeat) || endBeat <= 0 || !Number.isFinite(beatsPerMeasure) || beatsPerMeasure <= 0) return [];
  const boundaries = measureBeats?.length
    ? [...new Set(measureBeats.filter((beat) => Number.isFinite(beat) && beat >= 0 && beat < endBeat))].sort((a, b) => a - b)
    : Array.from({ length: Math.ceil(endBeat / beatsPerMeasure) }, (_, index) => index * beatsPerMeasure);
  const pulses: MetronomePulse[] = [];
  const firstMeasure = boundaries[0] ?? endBeat;
  for (let beat = firstMeasure - Math.floor(firstMeasure); beat < firstMeasure; beat += 1) {
    pulses.push({ beat, accent: false });
  }
  boundaries.forEach((startBeat, index) => {
    const end = boundaries[index + 1] ?? endBeat;
    for (let beat = startBeat; beat < end; beat += 1) pulses.push({ beat, accent: beat === startBeat });
  });
  return pulses;
}

export function metronomeWindow(pulses: readonly MetronomePulse[], timeAtBeat: (beat: number) => number, now: number, lastScheduledAt: number) {
  const scheduled: (MetronomePulse & { at: number })[] = [];
  // Skip stale beats after a stalled tab; schedule ahead on the audio clock.
  for (const pulse of pulses) {
    const at = timeAtBeat(pulse.beat);
    if (at > now + 100) break;
    if (at > lastScheduledAt && at >= now - 30) scheduled.push({ ...pulse, at });
  }
  return scheduled;
}
