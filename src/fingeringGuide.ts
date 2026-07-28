import type { AccordionButton, AccordionConfig, SongEvent } from './types';

export const MELODY_FINGERS = [2, 3, 4, 5] as const;
export type MelodyFinger = typeof MELODY_FINGERS[number];

const FINGER_DETAILS: Record<MelodyFinger, { symbol: string; name: string }> = {
  2: { symbol: 'I', name: 'Index' },
  3: { symbol: 'M', name: 'Majeur' },
  4: { symbol: 'A', name: 'Annulaire' },
  5: { symbol: 'O', name: 'Auriculaire' },
};

export function normalizeMelodyFinger(finger: number | undefined): MelodyFinger {
  return MELODY_FINGERS.includes(finger as MelodyFinger) ? finger as MelodyFinger : 2;
}

export function fingerSymbol(finger: number | undefined) {
  return FINGER_DETAILS[normalizeMelodyFinger(finger)].symbol;
}

export function fingerName(finger: number | undefined) {
  return FINGER_DETAILS[normalizeMelodyFinger(finger)].name;
}

function fingerWithArticle(finger: MelodyFinger) {
  return finger === 2 ? 'l’index' : `le ${fingerName(finger).toLowerCase()}`;
}

function buttonForEvent(event: SongEvent, accordion: AccordionConfig) {
  return accordion.buttons.find((button) => button.id === event.buttonId);
}

function handAnchor(button: AccordionButton, finger: MelodyFinger) {
  return button.index - (finger - 2);
}

function restingCost(finger: MelodyFinger) {
  if (finger === 5) return .18;
  if (finger === 2) return .03;
  return 0;
}

function transitionCost(
  previousButton: AccordionButton,
  previousFinger: MelodyFinger,
  button: AccordionButton,
  finger: MelodyFinger,
) {
  if (previousButton.id === button.id) return previousFinger === finger ? 0 : 12;

  const buttonDelta = button.index - previousButton.index;
  const fingerDelta = finger - previousFinger;
  const anchorDelta = handAnchor(button, finger) - handAnchor(previousButton, previousFinger);
  let cost = Math.abs(anchorDelta) * 2.8;

  if (previousButton.row === button.row) {
    if (buttonDelta !== 0 && fingerDelta === 0) cost += 3.5;
    if (buttonDelta * fingerDelta < 0) cost += 7;
    if (Math.abs(fingerDelta) > Math.abs(buttonDelta) + 1) cost += 1.5;
  } else {
    if (buttonDelta === 0 && fingerDelta !== 0) cost += 1.2;
    if (Math.abs(buttonDelta) <= 1 && Math.abs(fingerDelta) > 1) cost += 1;
  }

  return cost;
}

function planSegment(events: SongEvent[], buttons: AccordionButton[]) {
  const buttonById = new Map(buttons.map((button) => [button.id, button]));
  const costs: Array<Map<MelodyFinger, number>> = [];
  const previousFingers: Array<Map<MelodyFinger, MelodyFinger | undefined>> = [];

  events.forEach((event, index) => {
    const button = buttonById.get(event.buttonId)!;
    const eventCosts = new Map<MelodyFinger, number>();
    const eventPrevious = new Map<MelodyFinger, MelodyFinger | undefined>();

    MELODY_FINGERS.forEach((finger) => {
      if (index === 0) {
        eventCosts.set(finger, restingCost(finger));
        eventPrevious.set(finger, undefined);
        return;
      }

      const previousButton = buttonById.get(events[index - 1].buttonId)!;
      let bestCost = Number.POSITIVE_INFINITY;
      let bestPrevious: MelodyFinger | undefined;
      MELODY_FINGERS.forEach((previousFinger) => {
        const candidateCost = (costs[index - 1].get(previousFinger) ?? Number.POSITIVE_INFINITY)
          + transitionCost(previousButton, previousFinger, button, finger)
          + restingCost(finger);
        if (candidateCost < bestCost) {
          bestCost = candidateCost;
          bestPrevious = previousFinger;
        }
      });
      eventCosts.set(finger, bestCost);
      eventPrevious.set(finger, bestPrevious);
    });

    costs.push(eventCosts);
    previousFingers.push(eventPrevious);
  });

  let finger = MELODY_FINGERS.reduce((best, candidate) => (
    (costs.at(-1)?.get(candidate) ?? Number.POSITIVE_INFINITY)
      < (costs.at(-1)?.get(best) ?? Number.POSITIVE_INFINITY) ? candidate : best
  ));
  const result = new Array<MelodyFinger>(events.length);
  for (let index = events.length - 1; index >= 0; index -= 1) {
    result[index] = finger;
    finger = previousFingers[index].get(finger) ?? finger;
  }
  return result;
}

export function planMelodyFingering(events: SongEvent[], accordion: AccordionConfig): SongEvent[] {
  const planned = events.map((event) => ({ ...event }));
  const buttonIds = new Set(accordion.buttons.map((button) => button.id));
  let segmentStart = 0;

  while (segmentStart < events.length) {
    while (segmentStart < events.length && !buttonIds.has(events[segmentStart].buttonId)) segmentStart += 1;
    if (segmentStart >= events.length) break;
    let segmentEnd = segmentStart + 1;
    while (segmentEnd < events.length && buttonIds.has(events[segmentEnd].buttonId)) segmentEnd += 1;
    const segment = events.slice(segmentStart, segmentEnd);
    const fingers = planSegment(segment, accordion.buttons);
    fingers.forEach((finger, index) => { planned[segmentStart + index].finger = finger; });
    segmentStart = segmentEnd;
  }

  return planned;
}

export interface FingeringMoment {
  current: {
    finger: MelodyFinger;
    symbol: string;
    name: string;
    button: number;
    row: number;
  };
  next: Array<{
    finger: MelodyFinger;
    symbol: string;
    name: string;
    button: number;
    note: string;
  }>;
  advice: string;
}

function rowLabel(row: number) {
  if (row === 1) return 'rangée extérieure';
  if (row === 2) return 'rangée intérieure';
  return 'rangée auxiliaire';
}

export function getFingeringMoment(
  events: SongEvent[],
  activeIndex: number,
  accordion: AccordionConfig,
): FingeringMoment | undefined {
  const event = events[activeIndex];
  const button = event && buttonForEvent(event, accordion);
  if (!event || !button) return undefined;
  const finger = normalizeMelodyFinger(event.finger);
  const next = events
    .slice(activeIndex + 1)
    .map((candidate) => ({ event: candidate, button: buttonForEvent(candidate, accordion) }))
    .filter((candidate): candidate is { event: SongEvent; button: AccordionButton } => Boolean(candidate.button))
    .slice(0, 2)
    .map(({ event: candidate, button: candidateButton }) => {
      const candidateFinger = normalizeMelodyFinger(candidate.finger);
      return {
        finger: candidateFinger,
        symbol: fingerSymbol(candidateFinger),
        name: fingerName(candidateFinger),
        button: candidateButton.index,
        note: candidate.note,
      };
    });

  const previousEvent = events[activeIndex - 1];
  const previousButton = previousEvent && buttonForEvent(previousEvent, accordion);
  const currentAnchor = handAnchor(button, finger);
  const previousAnchor = previousButton
    ? handAnchor(previousButton, normalizeMelodyFinger(previousEvent.finger))
    : currentAnchor;
  const nextEvent = events[activeIndex + 1];
  const nextButton = nextEvent && buttonForEvent(nextEvent, accordion);
  const nextFinger = nextEvent ? normalizeMelodyFinger(nextEvent.finger) : undefined;
  const nextAnchor = nextButton && nextFinger ? handAnchor(nextButton, nextFinger) : currentAnchor;

  let advice = `Garde la main détendue au-dessus de la ${rowLabel(button.row)}.`;
  if (currentAnchor > previousAnchor) advice = `Descends légèrement la main, puis joue avec ${fingerWithArticle(finger)}.`;
  else if (currentAnchor < previousAnchor) advice = `Remonte légèrement la main, puis joue avec ${fingerWithArticle(finger)}.`;
  else if (nextButton?.id === button.id && nextFinger === finger) advice = `Garde ${fingerWithArticle(finger)} posé : le prochain geste utilise le même bouton.`;
  else if (nextAnchor > currentAnchor) advice = 'Après cette note, descends légèrement la main pour préparer la suite.';
  else if (nextAnchor < currentAnchor) advice = 'Après cette note, remonte légèrement la main pour préparer la suite.';
  else if (next[0]) advice = `Prépare déjà ${fingerWithArticle(next[0].finger)} sur le bouton ${next[0].button}.`;

  return {
    current: {
      finger,
      symbol: fingerSymbol(finger),
      name: fingerName(finger),
      button: button.index,
      row: button.row,
    },
    next,
    advice,
  };
}
