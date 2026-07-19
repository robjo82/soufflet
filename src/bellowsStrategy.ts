import type {
  AccordionButton, AccordionConfig, BellowsAirAction, BellowsPlan, BellowsPlanStep,
  BellowsStyle, Direction, Song, SongEvent,
} from './types';

export const BELLOWS_STYLE_OPTIONS: Array<{ id: BellowsStyle; label: string; short: string; description: string }> = [
  {
    id: 'balanced',
    label: 'Équilibré',
    short: 'Réserve + phrasé',
    description: 'Garde une marge d’air confortable et place les changements aux respirations naturelles.',
  },
  {
    id: 'push-pull',
    label: 'Poussé-tiré',
    short: 'Rebond et articulation',
    description: 'Accepte davantage de changements pour donner du relief rythmique au morceau.',
  },
  {
    id: 'cross-row',
    label: 'Jeu croisé',
    short: 'Phrases plus liées',
    description: 'Privilégie les notes alternatives sur plusieurs rangées pour conserver la direction.',
  },
];

interface StyleProfile {
  directionChange: number;
  phraseDirectionChange: number;
  rowChange: number;
  airAction: number;
  phraseMeasures: number;
}

const STYLE_PROFILES: Record<BellowsStyle, StyleProfile> = {
  balanced: { directionChange: 1.15, phraseDirectionChange: .18, rowChange: .34, airAction: 3.8, phraseMeasures: 2 },
  'push-pull': { directionChange: .12, phraseDirectionChange: .04, rowChange: 1.15, airAction: 4.5, phraseMeasures: 2 },
  'cross-row': { directionChange: 2.8, phraseDirectionChange: .42, rowChange: .12, airAction: 3.4, phraseMeasures: 4 },
};

const START_AMOUNT = .38;
const COMFORTABLE_MIN = .16;
const COMFORTABLE_MAX = .84;
const ABSOLUTE_MIN = .1;
const ABSOLUTE_MAX = .9;

interface Candidate {
  button: AccordionButton;
  direction: Direction;
}

interface PathState {
  score: number;
  amount: number;
  candidate: Candidate;
  previous?: PathState;
  event: SongEvent;
  beforeAmount: number;
  airBefore?: BellowsAirAction;
}

function roundAmount(amount: number) {
  return Math.round(amount * 1_000) / 1_000;
}

function amountBucket(amount: number) {
  return Math.round(amount * 20);
}

function atPhraseBoundary(song: Song, index: number, phraseMeasures: number) {
  if (index === 0) return true;
  const event = song.events[index];
  const previous = song.events[index - 1];
  const gap = event.beat - (previous.beat + previous.duration);
  if (gap >= .12) return true;
  const phraseBeats = Math.max(1, song.timeSignature[0] * phraseMeasures);
  return Math.abs(event.beat / phraseBeats - Math.round(event.beat / phraseBeats)) < .001;
}

function eventAirUse(song: Song, event: SongEvent) {
  const leftHandActive = (song.accompaniment ?? []).some((item) => (
    item.beat < event.beat + event.duration && item.beat + item.duration > event.beat
  ));
  const voices = leftHandActive ? 1.32 : 1;
  return Math.min(.115, Math.max(.012, event.duration * .034 * voices));
}

function remainingPhraseAirUse(song: Song, index: number, phraseMeasures: number) {
  let amount = 0;
  for (let nextIndex = index + 1; nextIndex < song.events.length; nextIndex += 1) {
    if (atPhraseBoundary(song, nextIndex, phraseMeasures)) break;
    amount += eventAirUse(song, song.events[nextIndex]);
  }
  return amount;
}

function harmonicPenalty(song: Song, accordion: AccordionConfig, event: SongEvent, direction: Direction) {
  const accompaniment = (song.accompaniment ?? []).filter((item) => (
    item.beat < event.beat + event.duration && item.beat + item.duration > event.beat
  ));
  return accompaniment.reduce((penalty, item) => {
    const desiredPitchClass = ((item.rootMidi % 12) + 12) % 12;
    const exact = accordion.basses.some((button) => {
      if (button.role !== item.role) return false;
      const midi = direction === 'push' ? button.pushMidi : button.pullMidi;
      return ((midi % 12) + 12) % 12 === desiredPitchClass;
    });
    return penalty + (exact ? 0 : 1.8);
  }, 0);
}

function eventCandidates(event: SongEvent, accordion: AccordionConfig): Candidate[] {
  const selected = accordion.buttons.find((button) => button.id === event.buttonId);
  const selectedMatches = selected && (event.direction === 'push' ? selected.pushMidi : selected.pullMidi) === event.midi;
  if (selectedMatches && event.mappingSource !== 'optimized') return [{ button: selected, direction: event.direction }];

  const choices = accordion.buttons.flatMap((button) => [
    ...(button.pushMidi === event.midi ? [{ button, direction: 'push' as const }] : []),
    ...(button.pullMidi === event.midi ? [{ button, direction: 'pull' as const }] : []),
  ]);
  const unique = new Map(choices.map((choice) => [`${choice.button.id}:${choice.direction}`, choice]));
  return [...unique.values()];
}

function movementScore(previous: PathState | undefined, candidate: Candidate, profile: StyleProfile, phraseBoundary: boolean) {
  if (!previous) return candidate.button.row * .03;
  const directionChanged = previous.candidate.direction !== candidate.direction;
  const rowChanged = previous.candidate.button.row !== candidate.button.row;
  const indexDistance = Math.abs(previous.candidate.button.index - candidate.button.index);
  return (directionChanged ? (phraseBoundary ? profile.phraseDirectionChange : profile.directionChange) : 0)
    + (rowChanged ? profile.rowChange : 0)
    + Math.max(0, indexDistance - 2) * .08;
}

function reserveScore(amount: number) {
  if (amount < ABSOLUTE_MIN || amount > ABSOLUTE_MAX) return 10_000;
  const edgeDistance = amount < COMFORTABLE_MIN
    ? COMFORTABLE_MIN - amount
    : amount > COMFORTABLE_MAX
      ? amount - COMFORTABLE_MAX
      : 0;
  return edgeDistance * edgeDistance * 420 + Math.abs(amount - .5) * .05;
}

function airTarget(direction: Direction) {
  return direction === 'pull' ? .34 : .66;
}

function airReason(amount: number): BellowsAirAction['reason'] {
  if (amount <= COMFORTABLE_MIN) return 'reserve-low';
  if (amount >= COMFORTABLE_MAX) return 'reserve-high';
  return 'phrase-breath';
}

function addState(states: Map<string, PathState>, state: PathState) {
  const key = `${state.candidate.button.id}:${state.candidate.direction}:${amountBucket(state.amount)}`;
  const existing = states.get(key);
  if (!existing || state.score < existing.score) states.set(key, state);
}

export function planBellowsStrategy(song: Song, accordion: AccordionConfig, style: BellowsStyle = 'balanced') {
  const profile = STYLE_PROFILES[style];
  let previousStates: PathState[] = [];
  let unmapped = false;

  song.events.forEach((event, index) => {
    const candidates = eventCandidates(event, accordion);
    if (!candidates.length) {
      unmapped = true;
      return;
    }
    const phraseBoundary = atPhraseBoundary(song, index, profile.phraseMeasures);
    const airUse = eventAirUse(song, event);
    const phraseAirUse = phraseBoundary ? remainingPhraseAirUse(song, index, profile.phraseMeasures) : 0;
    const nextStates = new Map<string, PathState>();
    const sources: Array<PathState | undefined> = previousStates.length ? previousStates : [undefined];

    for (const previous of sources) {
      for (const candidate of candidates) {
        const initialAmount = previous?.amount ?? START_AMOUNT;
        const delta = candidate.direction === 'pull' ? airUse : -airUse;
        const baseMovement = movementScore(previous, candidate, profile, phraseBoundary)
          + harmonicPenalty(song, accordion, event, candidate.direction);
        const directAfter = roundAmount(initialAmount + delta);
        addState(nextStates, {
          score: (previous?.score ?? 0) + baseMovement + reserveScore(directAfter),
          amount: directAfter,
          candidate,
          previous,
          event,
          beforeAmount: initialAmount,
        });

        const target = airTarget(candidate.direction);
        const projectedAfterPhrase = directAfter + (candidate.direction === 'pull' ? phraseAirUse : -phraseAirUse);
        const directIsTight = directAfter < COMFORTABLE_MIN + .06 || directAfter > COMFORTABLE_MAX - .06
          || projectedAfterPhrase < COMFORTABLE_MIN || projectedAfterPhrase > COMFORTABLE_MAX;
        const projectedAfterAir = target + delta + (candidate.direction === 'pull' ? phraseAirUse : -phraseAirUse);
        const airImprovesReserve = Math.abs(projectedAfterAir - .5) + .08 < Math.abs(projectedAfterPhrase - .5);
        if (phraseBoundary && directIsTight && airImprovesReserve && index > 0) {
          const afterAir = roundAmount(target + delta);
          const action: BellowsAirAction = {
            fromAmount: roundAmount(initialAmount),
            toAmount: target,
            reason: airReason(initialAmount),
          };
          addState(nextStates, {
            score: (previous?.score ?? 0) + baseMovement + profile.airAction
              + Math.abs(initialAmount - target) * 2 + reserveScore(afterAir),
            amount: afterAir,
            candidate,
            previous,
            event,
            beforeAmount: target,
            airBefore: action,
          });
        }
      }
    }
    previousStates = [...nextStates.values()];
  });

  if (!previousStates.length) {
    return {
      events: song.events.map((event) => ({ ...event, buttonId: '', confidence: Math.min(event.confidence ?? 1, .45) })),
      plan: {
        style,
        startAmount: START_AMOUNT,
        comfortableMin: COMFORTABLE_MIN,
        comfortableMax: COMFORTABLE_MAX,
        minAmount: START_AMOUNT,
        maxAmount: START_AMOUNT,
        directionChanges: 0,
        rowChanges: 0,
        airActions: 0,
        needsReview: true,
        steps: [],
      } satisfies BellowsPlan,
    };
  }

  let cursor: PathState | undefined = previousStates.reduce((winner, state) => (
    state.score + Math.abs(state.amount - START_AMOUNT) < winner.score + Math.abs(winner.amount - START_AMOUNT) ? state : winner
  ));
  const path: PathState[] = [];
  while (cursor) {
    path.push(cursor);
    cursor = cursor.previous;
  }
  path.reverse();

  const mappedById = new Map(path.map((state) => [state.event.id, state]));
  const events = song.events.map((event) => {
    const state = mappedById.get(event.id);
    if (!state) return { ...event, buttonId: '', confidence: Math.min(event.confidence ?? 1, .45) };
    const authorial = event.mappingSource !== 'optimized'
      && event.buttonId === state.candidate.button.id
      && event.direction === state.candidate.direction;
    return {
      ...event,
      buttonId: state.candidate.button.id,
      direction: state.candidate.direction,
      finger: state.candidate.button.finger ?? event.finger,
      mappingSource: authorial ? 'authorial' as const : 'optimized' as const,
    };
  });
  const steps: BellowsPlanStep[] = path.map((state) => ({
    eventId: state.event.id,
    beat: state.event.beat,
    direction: state.candidate.direction,
    beforeAmount: roundAmount(state.beforeAmount),
    afterAmount: roundAmount(state.amount),
    ...(state.airBefore ? { airBefore: state.airBefore } : {}),
  }));
  const directionChanges = path.slice(1).filter((state, index) => state.candidate.direction !== path[index].candidate.direction).length;
  const rowChanges = path.slice(1).filter((state, index) => state.candidate.button.row !== path[index].candidate.button.row).length;
  const amounts = [START_AMOUNT, ...steps.flatMap((step) => [step.beforeAmount, step.afterAmount])];
  const minAmount = Math.min(...amounts);
  const maxAmount = Math.max(...amounts);
  const plan: BellowsPlan = {
    style,
    startAmount: START_AMOUNT,
    comfortableMin: COMFORTABLE_MIN,
    comfortableMax: COMFORTABLE_MAX,
    minAmount: roundAmount(minAmount),
    maxAmount: roundAmount(maxAmount),
    directionChanges,
    rowChanges,
    airActions: steps.filter((step) => Boolean(step.airBefore)).length,
    needsReview: unmapped || minAmount < ABSOLUTE_MIN || maxAmount > ABSOLUTE_MAX,
    steps,
  };
  return { events, plan };
}

export function bellowsStepAt(song: Song, event: Pick<SongEvent, 'id' | 'beat'> | undefined) {
  if (!event || !song.bellowsPlan?.steps.length) return undefined;
  return song.bellowsPlan.steps.find((step) => step.eventId === event.id)
    ?? [...song.bellowsPlan.steps].reverse().find((step) => step.beat <= event.beat);
}

export function bellowsAmountLabel(amount: number) {
  if (amount < COMFORTABLE_MIN) return 'presque fermé';
  if (amount > COMFORTABLE_MAX) return 'presque ouvert';
  if (amount < .34) return 'réserve côté pousser';
  if (amount > .66) return 'réserve côté tirer';
  return 'marge confortable';
}
