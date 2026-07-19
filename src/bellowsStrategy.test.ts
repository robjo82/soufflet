import { describe, expect, it } from 'vitest';
import { SONG_SEEDS } from '../server/songSeed';
import { createAccordion3DPlayback } from './accordion3dPlayback';
import { adaptSongToAccordion, FALLBACK_ACCORDIONS } from './data';
import type { Song } from './types';

const club = FALLBACK_ACCORDIONS.find((accordion) => accordion.id === 'hohner-club-i-cf-10-9-2')!;

describe('bellows strategy planner', () => {
  it('keeps a comfortable playable reserve throughout La Jument de Michao', () => {
    const source = SONG_SEEDS.find((song) => song.id === 'la-jument-de-michao-trad')!;
    const song = adaptSongToAccordion(source, club, 'balanced');

    expect(song.bellowsPlan?.steps).toHaveLength(source.events.length);
    expect(song.bellowsPlan?.minAmount).toBeGreaterThanOrEqual(.1);
    expect(song.bellowsPlan?.maxAmount).toBeLessThanOrEqual(.9);
    expect(song.bellowsPlan?.airActions).toBeGreaterThan(0);
    expect(song.bellowsPlan?.needsReview).toBe(false);
  });

  it('makes the declared style change the musical strategy', () => {
    const source = SONG_SEEDS.find((song) => song.id === 'la-jument-de-michao-trad')!;
    const pushPull = adaptSongToAccordion(source, club, 'push-pull').bellowsPlan!;
    const crossRow = adaptSongToAccordion(source, club, 'cross-row').bellowsPlan!;

    expect(pushPull.directionChanges).toBeGreaterThan(crossRow.directionChanges);
    expect(pushPull.rowChanges).toBeLessThan(crossRow.rowChanges);
  });

  it('never rewrites a verified authorial tablature', () => {
    const source = SONG_SEEDS.find((song) => song.id === 'le-brise-pieds-aveyronnais')!;
    const planned = adaptSongToAccordion(source, club, 'balanced');

    expect(planned.events.map(({ buttonId, direction }) => ({ buttonId, direction }))).toEqual(
      source.events.map(({ buttonId, direction }) => ({ buttonId, direction })),
    );
    expect(planned.events.every((event) => event.mappingSource === 'authorial')).toBe(true);
  });

  it('places silent air-valve actions at phrase boundaries before saturation', () => {
    const button = club.buttons.find((item) => item.id === 'c1-out-5')!;
    const song: Song = {
      id: 'one-way-phrase', title: 'Phrase en tirant', artist: 'Test', sourceType: 'lesson',
      bpm: 90, timeSignature: [4, 4], key: 'Sol', duration: 24, difficulty: 1, status: 'ready', confidence: 1,
      events: Array.from({ length: 32 }, (_, index) => ({
        id: `pull-${index}`, beat: index, duration: 1, midi: button.pullMidi, note: button.pull,
        buttonId: button.id, direction: 'pull' as const, finger: 3, confidence: 1,
      })),
      accompaniment: [],
    };
    const planned = adaptSongToAccordion(song, club, 'balanced');
    const playback = createAccordion3DPlayback(planned);

    expect(planned.bellowsPlan?.airActions).toBeGreaterThan(0);
    expect(planned.bellowsPlan?.maxAmount).toBeLessThanOrEqual(.9);
    expect(playback.airCues).toHaveLength(planned.bellowsPlan?.airActions ?? 0);
    expect(playback.cues.filter((cue) => cue.hand === 'right').every((cue) => cue.bellowsAfter !== undefined)).toBe(true);
  });
});
