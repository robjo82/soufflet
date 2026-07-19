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
  bellowsBefore?: number;
  bellowsAfter?: number;
}

export interface Accordion3DAirCue {
  atMs: number;
  durationMs: number;
  fromAmount: number;
  toAmount: number;
  reason: 'reserve-low' | 'reserve-high' | 'phrase-breath';
}

export interface Accordion3DPlayback {
  cues: Accordion3DPlaybackCue[];
  airCues: Accordion3DAirCue[];
  durationMs: number;
}

export function createAccordion3DPlayback(song: Song): Accordion3DPlayback {
  const beatMs = 60_000 / Math.max(1, song.bpm);
  const bellowsSteps = new Map((song.bellowsPlan?.steps ?? []).map((step) => [step.eventId, step]));
  const melody: Accordion3DPlaybackCue[] = song.events
    .filter((event) => Boolean(event.buttonId))
    .map((event) => {
      const bellowsStep = bellowsSteps.get(event.id);
      return {
        atMs: event.beat * beatMs,
        buttonId: event.buttonId,
        direction: event.direction,
        durationMs: Math.max(120, event.duration * beatMs),
        hand: 'right',
        midi: event.midi,
        role: 'melody',
        bellowsBefore: bellowsStep?.beforeAmount,
        bellowsAfter: bellowsStep?.afterAmount,
      };
    });
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
  const airCues = (song.bellowsPlan?.steps ?? []).flatMap((step) => step.airBefore ? [{
    atMs: Math.max(0, step.beat * beatMs - 180),
    durationMs: 160,
    fromAmount: step.airBefore.fromAmount,
    toAmount: step.airBefore.toAmount,
    reason: step.airBefore.reason,
  }] : []);
  const durationMs = [...cues, ...airCues].reduce((latest, cue) => Math.max(latest, cue.atMs + cue.durationMs), 0);
  return { cues, airCues, durationMs };
}
