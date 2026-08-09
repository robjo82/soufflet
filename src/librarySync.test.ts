import { describe, expect, it } from 'vitest';
import { reconcileLibrarySongs } from './librarySync';
import type { Song } from './types';

const song = (id: string, title: string, builtIn = false): Song => ({
  id,
  title,
  artist: 'Test',
  sourceType: 'audio',
  bpm: 100,
  timeSignature: [4, 4],
  key: 'C',
  duration: 10,
  difficulty: 1,
  status: 'ready',
  events: [],
  builtIn,
});

describe('library account refresh', () => {
  it('uses the server copy when another device changed an existing song', () => {
    const result = reconcileLibrarySongs(
      [song('shared', 'Version ordinateur')],
      [song('shared', 'Ancienne version mobile')],
    );

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Version ordinateur');
  });

  it('keeps a local song that has not reached the server yet', () => {
    const result = reconcileLibrarySongs(
      [song('common', 'Morceau commun', true)],
      [song('pending', 'Import hors ligne')],
    );

    expect(result.map((item) => item.id)).toEqual(['common', 'pending']);
  });
});
