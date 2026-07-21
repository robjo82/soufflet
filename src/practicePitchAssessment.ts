import { midiMatches } from './audioTraining';
import type { SongEvent } from './types';

const EARLY_TOLERANCE_BEATS = .12;
const LATE_TOLERANCE_BEATS = .42;
const REARTICULATION_WINDOW_MS = 220;

function eventMatches(event: SongEvent, heardMidi: number) {
  return event.hand === 'left' ? midiMatches(event.midi, heardMidi) : event.midi === heardMidi;
}

export function selectPitchAssessmentIndex(events: SongEvent[], activeIndex: number, heardMidi: number, playbackBeat: number) {
  const firstCandidate = Math.max(0, activeIndex - 2);
  const matching = events
    .slice(firstCandidate, activeIndex + 1)
    .map((event, offset) => ({ event, index: firstCandidate + offset }))
    .filter(({ event }) => (
      eventMatches(event, heardMidi)
      && event.beat <= playbackBeat + EARLY_TOLERANCE_BEATS
      && playbackBeat <= event.beat + Math.max(.2, event.duration) + LATE_TOLERANCE_BEATS
    ));
  return matching.at(-1)?.index ?? activeIndex;
}

export function canAcceptWaitPitch(waitingForReleaseMidi: number | null, heardMidi: number, now: number, lastOnsetAt: number) {
  return waitingForReleaseMidi === null
    || waitingForReleaseMidi !== heardMidi
    || (lastOnsetAt > 0 && now - lastOnsetAt < REARTICULATION_WINDOW_MS);
}
