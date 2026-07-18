import { noteFromMidi } from './data';
import type { AccordionButton, AccordionConfig, Direction, Notation } from './types';

export type ButtonGameLevelId = 1 | 2 | 3;

export interface ButtonGameLevel {
  id: ButtonGameLevelId;
  title: string;
  description: string;
  buttonCount: number;
  bpm: number;
  noteCount: number;
  directions: Direction[];
  timingWindowMs: number;
}

export interface ButtonGameTarget {
  id: string;
  buttonId: string;
  lane: number;
  direction: Direction;
  midi: number;
  note: string;
  hitAtMs: number;
}

export const BUTTON_GAME_LEVELS: ButtonGameLevel[] = [
  {
    id: 1,
    title: 'Trouve trois boutons',
    description: 'Trois repères, uniquement en poussant, avec une grande fenêtre de réussite.',
    buttonCount: 3,
    bpm: 58,
    noteCount: 12,
    directions: ['push'],
    timingWindowMs: 520,
  },
  {
    id: 2,
    title: 'Change de souffle',
    description: 'Les mêmes boutons produisent maintenant une note différente en tirant.',
    buttonCount: 3,
    bpm: 64,
    noteCount: 16,
    directions: ['push', 'pull'],
    timingWindowMs: 440,
  },
  {
    id: 3,
    title: 'Garde le rythme',
    description: 'Cinq boutons, pousser et tirer, avec un tempo plus vivant.',
    buttonCount: 5,
    bpm: 76,
    noteCount: 20,
    directions: ['push', 'pull'],
    timingWindowMs: 360,
  },
];

function rowCandidates(config: AccordionConfig) {
  const rows = new Map<number, AccordionButton[]>();
  for (const button of config.buttons.filter((item) => item.role !== 'accidental')) {
    rows.set(button.row, [...(rows.get(button.row) ?? []), button]);
  }
  return [...rows.values()]
    .map((buttons) => buttons.sort((a, b) => a.index - b.index))
    .sort((a, b) => b.length - a.length);
}

export function selectGameButtons(config: AccordionConfig, count: number) {
  const rows = rowCandidates(config).filter((row) => row.length >= count);
  const preferredRow = rows.find((row) => row[0]?.row === 2) ?? rows[0] ?? [];
  if (preferredRow.length <= count) return preferredRow.slice(0, count);

  let best = preferredRow.slice(0, count);
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let start = 0; start <= preferredRow.length - count; start += 1) {
    const window = preferredRow.slice(start, start + count);
    const centre = window.reduce((sum, button) => sum + button.pushMidi, 0) / window.length;
    const distance = Math.abs(centre - 64);
    if (distance < bestDistance) {
      best = window;
      bestDistance = distance;
    }
  }
  return best;
}

export function createGameTargets(buttons: AccordionButton[], level: ButtonGameLevel) {
  if (!buttons.length) return [];
  const lanePattern = buttons.length === 3
    ? [0, 1, 2, 1, 0, 1, 2, 2, 1, 0, 2, 1, 0, 2, 1, 1]
    : [0, 2, 1, 3, 2, 4, 3, 1, 0, 2, 4, 1, 3, 2, 0, 4, 2, 1, 3, 4];
  const beatMs = 60_000 / level.bpm;
  return Array.from({ length: level.noteCount }, (_, index): ButtonGameTarget => {
    const lane = lanePattern[index % lanePattern.length] % buttons.length;
    const button = buttons[lane];
    const direction = level.directions[index % level.directions.length];
    const midi = direction === 'push' ? button.pushMidi : button.pullMidi;
    return {
      id: `game-${level.id}-${index}`,
      buttonId: button.id,
      lane,
      direction,
      midi,
      note: noteFromMidi(midi),
      hitAtMs: 1_800 + index * beatMs,
    };
  });
}

export function gameNoteLabel(target: Pick<ButtonGameTarget, 'note' | 'buttonId' | 'direction'>, notation: Notation) {
  const number = target.buttonId.match(/(\d+)$/)?.[1] ?? '•';
  if (notation === 'button') return number;
  if (notation === 'tablature') return `${number}${target.direction === 'push' ? 'P' : 'T'}`;
  if (notation === 'english') return target.note.replace('#', '♯');
  const french: Record<string, string> = { C: 'Do', D: 'Ré', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si' };
  const match = target.note.match(/^([A-G])(#?)(-?\d+)$/);
  return match ? `${french[match[1]]}${match[2] ? '♯' : ''}${match[3]}` : target.note;
}

export function timingGrade(deltaMs: number, perfectWindowMs = 150): 'early' | 'perfect' | 'late' {
  if (deltaMs < -perfectWindowMs) return 'early';
  if (deltaMs > perfectWindowMs) return 'late';
  return 'perfect';
}
