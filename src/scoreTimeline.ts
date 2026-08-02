import type { Song, SongEvent } from './types';

export interface TwoHandScoreTimeline {
  totalBeats: number;
  measureStarts: number[];
}

/**
 * Both hands share the same musical clock, but keep their own attacks and
 * durations. The score uses the furthest event so neither lane is truncated.
 */
export function createTwoHandScoreTimeline(song: Pick<Song, 'events' | 'accompaniment' | 'timeSignature'>): TwoHandScoreTimeline {
  const eventEnds = [
    ...song.events.map((event) => event.beat + event.duration),
    ...(song.accompaniment ?? []).map((event) => event.beat + event.duration),
  ];
  const beatsPerMeasure = Math.max(1, song.timeSignature[0]);
  const totalBeats = Math.max(beatsPerMeasure, ...eventEnds);
  const measureCount = Math.max(1, Math.ceil(totalBeats / beatsPerMeasure));

  return {
    totalBeats,
    measureStarts: Array.from({ length: measureCount }, (_, index) => index * beatsPerMeasure),
  };
}

/** Finds the melody gesture covering a left-hand attack, or the latest one before it. */
export function melodyIndexAtBeat(events: SongEvent[], beat: number): number {
  if (!events.length) return 0;
  let index = 0;
  for (let candidate = 0; candidate < events.length; candidate += 1) {
    if (events[candidate].beat > beat) break;
    index = candidate;
  }
  return index;
}
