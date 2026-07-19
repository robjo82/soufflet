import type { Direction, Song } from './types';

export interface Accordion3DPlaybackCue {
  atMs: number;
  buttonId: string;
  chord?: string;
  direction: Direction;
  durationMs: number;
  hand: 'left' | 'right';
  midi: number;
  role: 'bass' | 'chord' | 'melody';
}

export interface Accordion3DPlayback {
  cues: Accordion3DPlaybackCue[];
  durationMs: number;
}

export function createAccordion3DPlayback(song: Song): Accordion3DPlayback {
  const beatMs = 60_000 / Math.max(1, song.bpm);
  const melody: Accordion3DPlaybackCue[] = song.events
    .filter((event) => Boolean(event.buttonId))
    .map((event) => ({
      atMs: event.beat * beatMs,
      buttonId: event.buttonId,
      direction: event.direction,
      durationMs: Math.max(120, event.duration * beatMs),
      hand: 'right',
      midi: event.midi,
      role: 'melody',
    }));
  const accompaniment: Accordion3DPlaybackCue[] = (song.accompaniment ?? [])
    .filter((event) => Boolean(event.buttonId))
    .map((event) => ({
      atMs: event.beat * beatMs,
      buttonId: event.buttonId,
      chord: event.chord,
      direction: event.direction,
      durationMs: Math.max(120, event.duration * beatMs),
      hand: 'left',
      midi: event.midi,
      role: event.role,
    }));
  const cues = [...melody, ...accompaniment].sort((left, right) => left.atMs - right.atMs || (left.hand === 'left' ? -1 : 1));
  const durationMs = cues.reduce((latest, cue) => Math.max(latest, cue.atMs + cue.durationMs), 0);
  return { cues, durationMs };
}
