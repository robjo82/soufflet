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
    const songs = makeDatabase().listCommonSongs() as Array<{ id: string; license: string }>;
    expect(songs.length).toBeGreaterThanOrEqual(10);
    expect(songs.find((song) => song.id === 'au-clair-de-la-lune')?.license).toBe('Domaine public');
    expect(songs.find((song) => song.id === 'vesoul-reference')?.license).toContain('protégée');
  });
});

describe('Brise-pieds reference transcription', () => {
  it('contains the twelve supplied measures and exact Club I anchors', () => {
    const song = SONG_SEEDS.find((item) => item.id === 'le-brise-pieds-aveyronnais');
    expect(song?.events.at(0)).toMatchObject({ beat: 0, midi: 67, buttonId: 'c1-out-5', direction: 'push' });
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
