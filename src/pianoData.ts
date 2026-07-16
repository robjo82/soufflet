import type { PianoKeyboardSize } from './types';

export interface PianoExercise {
  id: string;
  title: string;
  level: 'Très simple' | 'Simple' | 'Modéré';
  bpm: number;
  notes: Array<{ midi: number; beat: number; duration: number }>;
}

const phrase = (midis: number[], durations?: number[]) => {
  let beat = 0;
  return midis.map((midi, index) => {
    const duration = durations?.[index] ?? 1;
    const note = { midi, beat, duration };
    beat += duration;
    return note;
  });
};

export const PIANO_EXERCISES: PianoExercise[] = [
  { id: 'piano-three-steps', title: 'Trois petits pas', level: 'Très simple', bpm: 60, notes: phrase([60, 62, 64, 62, 60, 62, 64, 60]) },
  { id: 'piano-five-lights', title: 'Cinq lumières', level: 'Simple', bpm: 72, notes: phrase([60, 62, 64, 65, 67, 65, 64, 62, 60, 62, 64, 65, 67, 60]) },
  { id: 'piano-morning-walk', title: 'Promenade du matin', level: 'Modéré', bpm: 80, notes: phrase([60, 62, 64, 65, 67, 69, 67, 65, 64, 62, 60, 64, 67, 69, 67, 64, 62, 65, 69, 67, 65, 64, 62, 60], [1, 1, .5, .5, 1, 2, 1, 1, .5, .5, 2, 1, 1, 2, .5, .5, 1, 1, 1, 2, .5, .5, 1, 2]) },
];

export const PIANO_CHORDS = [
  { name: 'Do majeur', midis: [60, 64, 67] },
  { name: 'Sol majeur', midis: [59, 62, 67] },
  { name: 'Fa majeur', midis: [60, 65, 69] },
  { name: 'La mineur', midis: [60, 64, 69] },
  { name: 'Mi mineur', midis: [59, 64, 67] },
];

const START_BY_SIZE: Record<PianoKeyboardSize, number> = { 25: 48, 32: 45, 49: 36, 61: 36, 76: 28, 88: 21 };
export const pianoRange = (size: PianoKeyboardSize) => Array.from({ length: size }, (_, index) => START_BY_SIZE[size] + index);
export const isBlackKey = (midi: number) => [1, 3, 6, 8, 10].includes(midi % 12);
export const frenchNote = (midi: number) => `${['Do', 'Do♯', 'Ré', 'Ré♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si'][midi % 12]}${Math.floor(midi / 12) - 1}`;

export function pianoScore(correct: number, missed: number, timingErrors: number[]) {
  const total = correct + missed;
  const averageDelay = timingErrors.length ? Math.round(timingErrors.reduce((sum, value) => sum + value, 0) / timingErrors.length) : 0;
  const rhythmAccuracy = timingErrors.length ? Math.round(timingErrors.filter((value) => Math.abs(value) <= 300).length / timingErrors.length * 100) : 0;
  const global = total ? Math.round((correct / total * .7 + rhythmAccuracy / 100 * .3) * 100) : 0;
  const advice = missed > correct / 2 ? 'Ralentis et repère les positions des touches.' : averageDelay > 180 ? 'Anticipe légèrement l’arrivée des notes.' : rhythmAccuracy < 75 ? 'Refais le morceau plus lentement.' : 'Très bien : tu peux essayer le niveau suivant.';
  return { correct, missed, averageDelay, rhythmAccuracy, global, advice };
}
