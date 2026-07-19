import type { AccordionConfig, Direction } from './types';

export interface TunerTarget {
  buttonId: string;
  direction: Direction;
}

export function createTunerTargets(accordion: Pick<AccordionConfig, 'buttons'>): TunerTarget[] {
  return [...accordion.buttons]
    .sort((left, right) => left.row - right.row || left.index - right.index)
    .flatMap((button) => ([
      { buttonId: button.id, direction: 'push' as const },
      { buttonId: button.id, direction: 'pull' as const },
    ]));
}

export function findTunerTargetIndex(targets: TunerTarget[], buttonId: string, direction: Direction) {
  const index = targets.findIndex((target) => target.buttonId === buttonId && target.direction === direction);
  return index < 0 ? 0 : index;
}

export function nextTunerTarget(targets: TunerTarget[], buttonId: string, direction: Direction, offset = 1) {
  if (!targets.length) return null;
  const current = findTunerTargetIndex(targets, buttonId, direction);
  const index = Math.max(0, Math.min(targets.length - 1, current + offset));
  return targets[index];
}
