import { describe, expect, it } from 'vitest';
import { buildGuitarArrangement, buildPianoArrangement } from './arrangements.js';
import { SONG_SEEDS } from './songSeed.js';

describe('piano arrangements', () => {
  it('keeps melody and accompaniment on independent hands', () => {
    const song = SONG_SEEDS.find((item) => item.id === 'au-clair-de-la-lune')!;
    const arrangement = buildPianoArrangement(song)!;
    expect(arrangement.events.filter((event) => event.hand === 'right')).toHaveLength(song.events.length);
    expect(arrangement.events.filter((event) => event.hand === 'left')).toHaveLength(song.accompaniment.length);
    expect(arrangement.events.some((event) => event.hand === 'left' && event.midis.length >= 3)).toBe(true);
    expect(arrangement.events.every((event) => event.midis.every((midi) => midi >= 0 && midi <= 127))).toBe(true);
  });

  it('does not invent an arrangement for a protected reference', () => {
    const reference = SONG_SEEDS.find((item) => item.status === 'reference-only')!;
    expect(buildPianoArrangement(reference)).toBeUndefined();
    expect(buildGuitarArrangement(reference)).toBeUndefined();
  });

  it('maps every melody note to a playable guitar string and fret', () => {
    const song = SONG_SEEDS.find((item) => item.id === 'au-clair-de-la-lune')!;
    const arrangement = buildGuitarArrangement(song)!;
    const melody = arrangement.events.filter((event) => event.part === 'melody');
    expect(melody).toHaveLength(song.events.length);
    expect(melody.every((event) => event.positions?.every((position) => position.string >= 1 && position.string <= 6 && position.fret >= 0 && position.fret <= 15))).toBe(true);
    expect(arrangement.events.some((event) => event.part === 'accompaniment' && event.midis.length >= 3)).toBe(true);
  });
});
