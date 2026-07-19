export interface WaitAdvance {
  nextIndex: number;
  finished: boolean;
  looped: boolean;
}

export function getCountInSequence(beatsPerMeasure: number) {
  const beats = Math.min(12, Math.max(1, Math.round(beatsPerMeasure) || 4));
  return Array.from({ length: beats }, (_, index) => beats - index);
}

export function getPlaybackStartIndex(
  activeIndex: number,
  completed: boolean,
  loop: boolean,
  loopStart: number,
) {
  return completed ? (loop ? Math.max(0, loopStart) : 0) : Math.max(0, activeIndex);
}

export function getWaitAdvance(
  currentIndex: number,
  eventCount: number,
  loop: boolean,
  loopStart: number,
  loopEnd: number,
): WaitAdvance {
  if (eventCount <= 0) return { nextIndex: 0, finished: true, looped: false };
  const lastIndex = eventCount - 1;
  const boundary = loop ? Math.min(Math.max(loopEnd, 0), lastIndex) : lastIndex;
  if (currentIndex < boundary) return { nextIndex: currentIndex + 1, finished: false, looped: false };
  if (loop) return { nextIndex: Math.min(Math.max(loopStart, 0), boundary), finished: false, looped: true };
  return { nextIndex: currentIndex, finished: true, looped: false };
}
