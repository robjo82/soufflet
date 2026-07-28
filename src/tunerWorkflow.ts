import { noteFromMidi } from './data';
import type { AccordionConfig, Direction } from './types';

export type TunerHand = 'right' | 'left';

export interface TunerTarget {
  buttonId: string;
  direction: Direction;
  hand: TunerHand;
}

function targetsForHand(
  buttons: AccordionConfig['buttons'],
  hand: TunerHand,
): TunerTarget[] {
  return [...buttons]
    .sort((left, right) => left.row - right.row || left.index - right.index)
    .flatMap((button) => ([
      { buttonId: button.id, direction: 'push' as const, hand },
      { buttonId: button.id, direction: 'pull' as const, hand },
    ]));
}

export function createTunerTargets(accordion: Pick<AccordionConfig, 'buttons' | 'basses'>): TunerTarget[] {
  return [
    ...targetsForHand(accordion.buttons, 'right'),
    ...targetsForHand(accordion.basses, 'left'),
  ];
}

export function updateTunerButtonMapping(
  accordion: AccordionConfig,
  buttonId: string,
  hand: TunerHand,
  direction: Direction,
  midi: number,
): AccordionConfig {
  const collection = hand === 'right' ? 'buttons' : 'basses';
  return {
    ...accordion,
    [collection]: accordion[collection].map((button) => {
      if (button.id !== buttonId) return button;
      return direction === 'push'
        ? { ...button, pushMidi: midi, push: noteFromMidi(midi) }
        : { ...button, pullMidi: midi, pull: noteFromMidi(midi) };
    }),
  };
}

export function findTunerTargetIndex(
  targets: TunerTarget[],
  buttonId: string,
  direction: Direction,
  hand?: TunerHand,
) {
  const index = targets.findIndex((target) => (
    target.buttonId === buttonId
    && target.direction === direction
    && (!hand || target.hand === hand)
  ));
  return index < 0 ? 0 : index;
}

export function nextTunerTarget(
  targets: TunerTarget[],
  buttonId: string,
  direction: Direction,
  offset = 1,
  hand?: TunerHand,
) {
  if (!targets.length) return null;
  const current = findTunerTargetIndex(targets, buttonId, direction, hand);
  const index = Math.max(0, Math.min(targets.length - 1, current + offset));
  return targets[index];
}
