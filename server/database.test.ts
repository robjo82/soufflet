import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { SouffletDatabase } from './database.js';
import { hashPassword, sessionHash, verifyPassword } from './auth.js';
import { SONG_SEEDS } from './songSeed.js';
import { parseTablature } from './transcription.js';

const directories: string[] = [];
const makeDatabase = () => {
  const directory = mkdtempSync(join(tmpdir(), 'soufflet-test-'));
  directories.push(directory);
  return new SouffletDatabase(directory);
};

afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true })));

describe('production data migrations', () => {
  it('creates an account and retrieves it from a hashed session', async () => {
    const db = makeDatabase();
    const passwordHash = await hashPassword('un-mot-de-passe-solide');
    const user = db.createUser({ id: 'usr_test', email: 'Robin@Example.fr', displayName: 'Robin', passwordHash });
    expect(user?.email).toBe('robin@example.fr');
    expect(await verifyPassword('un-mot-de-passe-solide', passwordHash)).toBe(true);
    expect(await verifyPassword('mauvais-mot-de-passe', passwordHash)).toBe(false);
    db.createSession(sessionHash('opaque-session-token'), 'usr_test', new Date(Date.now() + 60_000).toISOString());
    expect(db.getSessionUser(sessionHash('opaque-session-token'))?.displayName).toBe('Robin');
  });

  it('seeds the shared, licensed learning library', () => {
    const songs = makeDatabase().listCommonSongs() as Array<{ id: string; license: string; status: string; accompaniment: Array<{ role: string }> }>;
    expect(songs.length).toBeGreaterThanOrEqual(10);
    expect(songs.find((song) => song.id === 'au-clair-de-la-lune')?.license).toBe('Domaine public');
    expect(songs.find((song) => song.id === 'vesoul-reference')?.license).toContain('protégée');
    for (const song of songs.filter((item) => item.status === 'ready')) {
      expect(song.accompaniment.length).toBeGreaterThan(0);
      expect(new Set(song.accompaniment.map((event) => event.role))).toEqual(new Set(['bass', 'chord']));
    }
  });
});

describe('Brise-pieds reference transcription', () => {
  it('contains the twelve supplied measures without beginner-disrupting grace notes', () => {
    const song = SONG_SEEDS.find((item) => item.id === 'le-brise-pieds-aveyronnais');
    expect(song?.events.at(0)).toMatchObject({ beat: 0, midi: 67, buttonId: 'c1-out-5', direction: 'push' });
    expect(song?.events.at(1)).toMatchObject({ beat: 1, midi: 69, buttonId: 'c1-out-5', direction: 'pull' });
    expect(song?.events.some((event) => event.duration === .25)).toBe(false);
    expect(song?.events.some((event) => event.beat === 5.5 && event.midi === 77 && event.buttonId === 'c1-out-8')).toBe(true);
    expect(new Set(song?.events.map((event) => Math.floor(event.beat / 4)))).toEqual(new Set(Array.from({ length: 12 }, (_, index) => index)));
    expect(song?.events.at(-1)).toMatchObject({ beat: 46, midi: 72, buttonId: 'c1-out-6', direction: 'push', duration: 2 });
  });

  it('parses structured measures, grace notes, subdivisions and held notes', () => {
    const db = makeDatabase();
    const accordion = db.getAccordion('hohner-club-i-cf-10-9-2')!;
    const result = parseTablature(`Titre : Le Brise-pieds\n1 Sol / (Ré) La / Sol / (Ré) La\t5P / (7T)5T / 5P / (7T)5T\n2 Sol / Mi-Fa / Mi / (Fa) Ré\t5P / 7P-8T / 7P / (8T)7T\n4 Sol / Mi-Ré / Do tenu\t5P / 7P-7T / 6P (2 temps)`, accordion);
    expect(result.confidence).toBe(1);
    expect(result.events.filter((event) => event.beat >= 5 && event.beat < 6)).toMatchObject([
      { beat: 5, midi: 76, duration: .5 },
      { beat: 5.5, midi: 77, duration: .5 },
    ]);
    expect(result.events.find((event) => event.beat === 14)).toMatchObject({ midi: 72, duration: 2 });
  });
});

describe('built-in melody editions', () => {
  it('ships the complete first verse of Au clair de la lune at its written rhythm', () => {
    const song = SONG_SEEDS.find((item) => item.id === 'au-clair-de-la-lune')!;
    expect(song).toMatchObject({ bpm: 88, timeSignature: [2, 4], duration: 22 });
    expect(song.events).toHaveLength(44);
    expect(song.events.at(22)).toMatchObject({ midi: 74, duration: .5 });
    expect(song.events.at(-1)).toMatchObject({ midi: 72, duration: 2 });
  });

  it('keeps Frère Jacques lively by using eighth notes for the matins phrase', () => {
    const song = SONG_SEEDS.find((item) => item.id === 'frere-jacques')!;
    expect(song).toMatchObject({ bpm: 120, timeSignature: [2, 4], duration: 16 });
    expect(song.events.slice(14, 18).map((event) => event.duration)).toEqual([.5, .5, .5, .5]);
  });

  it('uses the sourced Se Canta contour and a full-length Jument de Michao form', () => {
    const seCanta = SONG_SEEDS.find((item) => item.id === 'se-canta')!;
    const jument = SONG_SEEDS.find((item) => item.id === 'la-jument-de-michao-trad')!;
    expect(seCanta).toMatchObject({ bpm: 112, timeSignature: [3, 4] });
    expect(seCanta.events.slice(0, 5).map((event) => event.midi)).toEqual([67, 72, 72, 76, 74]);
    expect(jument).toMatchObject({ bpm: 90, timeSignature: [2, 2], duration: 151, key: 'Ré mineur' });
    expect(jument.events.length).toBeGreaterThan(500);
    expect(jument.events.slice(0, 7).map((event) => event.midi)).toEqual([67, 65, 64, 62, 64, 62, 60]);
    expect(new Set(jument.accompaniment.map((event) => event.chord))).toEqual(new Set(['C', 'F']));
  });
});
