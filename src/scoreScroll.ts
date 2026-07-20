export interface ScoreScrollGeometry {
  activeLeft: number;
  activeWidth: number;
  contentWidth: number;
  currentScrollLeft: number;
  viewportWidth: number;
}

export interface ScoreItemViewportGeometry {
  activeViewportLeft: number;
  currentScrollLeft: number;
  stripViewportLeft: number;
}

const FORWARD_TRIGGER_RATIO = 0.58;
const FORWARD_ANCHOR_RATIO = 0.36;
const BACKWARD_TRIGGER_RATIO = 0.16;
const BACKWARD_ANCHOR_RATIO = 0.28;

const clamp = (value: number, minimum: number, maximum: number) => (
  Math.min(maximum, Math.max(minimum, value))
);

/**
 * Converts a note position from viewport coordinates to score-content
 * coordinates. `offsetLeft` cannot be used here because the note and the
 * scrolling strip do not share an offset parent: it would include the page
 * margin of the centered player in windowed mode.
 */
export function getScoreItemContentLeft({
  activeViewportLeft,
  currentScrollLeft,
  stripViewportLeft,
}: ScoreItemViewportGeometry): number {
  return activeViewportLeft - stripViewportLeft + currentScrollLeft;
}

/**
 * Keeps the current note inside a stable reading window.
 *
 * The opening viewport stays fixed until the playhead has crossed most of it.
 * During playback, the distinct trigger and anchor positions create a dead zone,
 * so the score moves by readable sections instead of chasing every note. Clamping
 * to the last possible viewport also leaves a complete score window on screen at
 * the end of the tune.
 */
export function getScoreScrollTarget({
  activeLeft,
  activeWidth,
  contentWidth,
  currentScrollLeft,
  viewportWidth,
}: ScoreScrollGeometry): number {
  const maxScrollLeft = Math.max(0, contentWidth - viewportWidth);
  if (viewportWidth <= 0 || maxScrollLeft === 0) return 0;

  const activeCenter = activeLeft + activeWidth / 2;
  const current = clamp(currentScrollLeft, 0, maxScrollLeft);

  // Do not move the opening phrase: it must remain visible while it is played.
  if (activeCenter <= viewportWidth * FORWARD_TRIGGER_RATIO) return 0;

  const visibleX = activeCenter - current;
  if (visibleX > viewportWidth * FORWARD_TRIGGER_RATIO) {
    return clamp(activeCenter - viewportWidth * FORWARD_ANCHOR_RATIO, 0, maxScrollLeft);
  }

  // Manual selection, restart and looping must be able to bring earlier notes
  // back into view without recentring the score on every change.
  if (visibleX < viewportWidth * BACKWARD_TRIGGER_RATIO) {
    return clamp(activeCenter - viewportWidth * BACKWARD_ANCHOR_RATIO, 0, maxScrollLeft);
  }

  return current;
}
