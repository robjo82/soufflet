import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { SouffletDatabase } from './database.js';
import { hashPassword, sessionHash, verifyPassword } from './auth.js';
import { SONG_SEEDS } from './songSeed.js';
import { findVerifiedSongByTitle, parseTablature, transcriptionFromVerifiedSong } from './transcription.js';
import { inferSessionHand } from './progress.js';

const directories: string[] = [];
const makeDatabase = () => {
  const directory = mkdtempSync(join(tmpdir(), 'soufflet-test-'));
  directories.push(directory);
  return new SouffletDatabase(directory);
};

afterEach(() => directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true })));

describe('production data migrations', () => {
  it('keeps old mobile session payloads compatible with the new hand focus', () => {
    expect(inferSessionHand('guided')).toBe('right');
    expect(inferSessionHand('left')).toBe('left');
    expect(inferSessionHand('demo')).toBe('both');
    expect(inferSessionHand('wait', 'both')).toBe('both');
  });

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

  it('updates account details and invalidates sessions after a password change', async () => {
    const db = makeDatabase();
    const passwordHash = await hashPassword('ancien-mot-de-passe');
    db.createUser({ id: 'usr_account', email: 'avant@example.fr', displayName: 'Avant', passwordHash });
    db.createSession('session-account', 'usr_account', new Date(Date.now() + 60_000).toISOString());

    expect(db.updateUserProfile('usr_account', { email: 'apres@example.fr', displayName: 'Après' })).toMatchObject({
      email: 'apres@example.fr', displayName: 'Après',
    });
    const nextHash = await hashPassword('nouveau-mot-de-passe');
    expect(db.updateUserPassword('usr_account', nextHash)).toBe(true);
    expect(await verifyPassword('nouveau-mot-de-passe', db.getUserCredentials('apres@example.fr')!.password_hash)).toBe(true);
    db.deleteSessionsForUser('usr_account');
    expect(db.getSessionUser('session-account')).toBeUndefined();
  });

  it('deletes an account and all server-side learning data', () => {
    const db = makeDatabase();
    db.createUser({ id: 'usr_delete', email: 'delete@example.fr', displayName: 'À supprimer', passwordHash: 'test' });
    db.createSession('session-delete', 'usr_delete', new Date(Date.now() + 60_000).toISOString());
    db.saveUserPreferences('usr_delete', {
      accordionId: 'hohner-club-i-cf-10-9-2', notation: 'french', countIn: true, onboardingDone: true, tutorialDone: true,
    });
    db.saveAccordion({ id: 'custom-delete', maker: 'Test', model: 'Privé', tuning: 'Do/Fa' }, 'usr_delete');
    db.saveTunerReading('usr_delete', {
      id: 'reading-delete', sessionId: 'tuner-delete', accordionId: 'custom-delete', accordionModel: 'Privé',
      buttonId: 'button-1', row: 1, buttonIndex: 1, direction: 'push', expectedMidi: 60, detectedMidi: 60,
      frequency: 261.8, cents: 1, confidence: .94, volume: .08, outcome: 'matched', measuredAt: '2026-07-16T18:00:00.000Z',
    });
    db.savePracticeSession('usr_delete', {
      id: '065f8f4b-d1ae-4bb1-9c13-a2db57f42f96', songId: 'first-breath', songTitle: 'Premier souffle', mode: 'guided',
      hand: 'right',
      startedAt: '2026-07-16T18:00:00.000Z', endedAt: '2026-07-16T18:01:00.000Z', activeSeconds: 60,
      correctCount: 2, earlyCount: 0, lateCount: 0, wrongCount: 0, completionPercent: 100, tempoPercent: 80, flagged: false,
    });

    expect(db.deleteUser('usr_delete')).toBe(true);
    expect(db.getUserById('usr_delete')).toBeUndefined();
    expect(db.getSessionUser('session-delete')).toBeUndefined();
    expect(db.getUserPreferences('usr_delete')).toBeNull();
    expect(db.listPracticeSessions('usr_delete')).toEqual([]);
    expect(db.listTunerReadings('usr_delete')).toEqual([]);
    expect((db.listAccordions('usr_delete') as Array<{ id: string }>).some((item) => item.id === 'custom-delete')).toBe(false);
  });

  it('archives tuner readings by campaign and retrieves the latest one', () => {
    const db = makeDatabase();
    db.createUser({ id: 'usr_tuner', email: 'tuner@example.fr', displayName: 'Accordeur', passwordHash: 'test' });
    const base = {
      accordionId: 'hohner-club-i-cf-10-9-2', accordionModel: 'Club I', buttonId: 'c1-in-3', row: 2,
      buttonIndex: 3, direction: 'push' as const, expectedMidi: 55, detectedMidi: 65, frequency: 349.8,
      cents: 3, confidence: .94, volume: .08, outcome: 'corrected' as const,
    };
    db.saveTunerReading('usr_tuner', { ...base, id: 'reading-old', sessionId: 'campaign-old', measuredAt: '2026-07-18T18:00:00.000Z' });
    db.saveTunerReading('usr_tuner', { ...base, id: 'reading-new', sessionId: 'campaign-new', measuredAt: '2026-07-19T18:00:00.000Z' });

    expect(db.listTunerReadings('usr_tuner')).toMatchObject([{ id: 'reading-new', cents: 3, outcome: 'corrected' }]);
    expect(db.listTunerReadings('usr_tuner', 'campaign-old')).toMatchObject([{ id: 'reading-old' }]);
  });

  it('synchronizes the complete learning journey across devices', () => {
    const db = makeDatabase();
    db.createUser({ id: 'usr_preferences', email: 'prefs@example.fr', displayName: 'Préférences', passwordHash: 'test' });
    expect(db.getUserPreferences('usr_preferences')).toBeNull();
    expect(db.saveUserPreferences('usr_preferences', {
      accordionId: 'hohner-club-i-cf-10-9-2', notation: 'tablature', countIn: false, onboardingDone: true, tutorialDone: true,
    })).toMatchObject({
      accordionId: 'hohner-club-i-cf-10-9-2', notation: 'tablature', countIn: false, onboardingDone: true, tutorialDone: true,
    });
    expect(db.getUserPreferences('usr_preferences')).toMatchObject({
      notation: 'tablature', countIn: false, onboardingDone: true, tutorialDone: true,
    });

    expect(db.saveUserPreferences('usr_preferences', {
      accordionId: 'standard-gc-21-8', notation: 'french', countIn: true, onboardingDone: false, tutorialDone: false,
    })).toMatchObject({
      accordionId: 'standard-gc-21-8', notation: 'french', countIn: true, onboardingDone: true, tutorialDone: true,
    });
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

  it('starts every account at zero and aggregates only its real practice', () => {
    const db = makeDatabase();
    db.createUser({ id: 'usr_stats', email: 'stats@example.fr', displayName: 'Stats', passwordHash: 'test' });
    db.createUser({ id: 'usr_empty', email: 'empty@example.fr', displayName: 'Nouveau', passwordHash: 'test' });

    const base = {
      songId: 'first-breath', songTitle: 'Premier souffle', mode: 'guided', hand: 'right' as const, completionPercent: 100,
      tempoPercent: 80, flagged: false, earlyCount: 0, lateCount: 0, wrongCount: 0,
    };
    db.savePracticeSession('usr_stats', { ...base, id: 'session-1', startedAt: '2026-07-13T20:00:00.000Z', endedAt: '2026-07-13T20:10:00.000Z', activeSeconds: 600, correctCount: 8, earlyCount: 1, lateCount: 1, wrongCount: 2 });
    db.savePracticeSession('usr_stats', { ...base, id: 'session-2', mode: 'demo', startedAt: '2026-07-14T20:00:00.000Z', endedAt: '2026-07-14T20:05:00.000Z', activeSeconds: 300, correctCount: 0 });
    db.savePracticeSession('usr_stats', { ...base, id: 'session-3', startedAt: '2026-07-15T18:00:00.000Z', endedAt: '2026-07-15T18:02:00.000Z', activeSeconds: 120, correctCount: 4 });

    const empty = db.getPracticeStats('usr_empty', -120, new Date('2026-07-15T21:00:00.000Z'));
    expect(empty).toMatchObject({
      hasData: false,
      overview: { totalSeconds: 0, weekSeconds: 0, totalSessions: 0, currentStreak: 0, pitchAccuracy: null },
      recentSessions: [],
    });

    const stats = db.getPracticeStats('usr_stats', -120, new Date('2026-07-15T21:00:00.000Z'));
    expect(stats).toMatchObject({
      hasData: true,
      overview: { totalSeconds: 1020, weekSeconds: 1020, totalSessions: 3, currentStreak: 3, longestStreak: 3, activeDays: 3, songsPracticed: 1, assessedNotes: 16, pitchAccuracy: 88, timingAccuracy: 86 },
      skills: { notes: { value: 88, sampleSize: 16 }, rhythm: { value: 86, sampleSize: 14 }, tempo: { value: 80, sampleSize: 3 } },
    });
    expect(stats.week.map((day) => day.activeSeconds)).toEqual([600, 300, 120, 0, 0, 0, 0]);
  });

  it('upserts session snapshots without double counting or stale overwrites', () => {
    const db = makeDatabase();
    db.createUser({ id: 'usr_upsert', email: 'upsert@example.fr', displayName: 'Upsert', passwordHash: 'test' });
    const session = {
      id: 'session-upsert', songId: 'first-breath', songTitle: 'Premier souffle', mode: 'wait',
      hand: 'right' as const,
      startedAt: '2026-07-16T18:00:00.000Z', endedAt: '2026-07-16T18:02:00.000Z', activeSeconds: 120,
      correctCount: 4, earlyCount: 1, lateCount: 0, wrongCount: 1, completionPercent: 60, tempoPercent: 80, flagged: true,
    };
    db.savePracticeSession('usr_upsert', session);
    db.savePracticeSession('usr_upsert', { ...session, mode: 'demo', hand: 'both', endedAt: '2026-07-16T18:01:00.000Z', activeSeconds: 60, correctCount: 2, flagged: false });
    expect(db.listPracticeSessions('usr_upsert')).toMatchObject([{ activeSeconds: 120, correctCount: 4, mode: 'wait', hand: 'right', flagged: true }]);

    db.savePracticeSession('usr_upsert', { ...session, mode: 'guided', hand: 'both', endedAt: '2026-07-16T18:03:00.000Z', activeSeconds: 130, correctCount: 5, flagged: false });
    expect(db.listPracticeSessions('usr_upsert')).toMatchObject([{ activeSeconds: 130, correctCount: 5, mode: 'guided', hand: 'both', flagged: false }]);
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

describe('YouTube transcription safeguards', () => {
  it('matches the supplied Brise-pieds video to the verified library edition', () => {
    const match = findVerifiedSongByTitle('Le brise-pieds (Danse régionale)', SONG_SEEDS);
    expect(match?.id).toBe('le-brise-pieds-aveyronnais');
    const result = transcriptionFromVerifiedSong(match!, {
      title: 'Le brise-pieds (Danse régionale)',
      authorName: 'Éric Bouvelle',
    });
    expect(result).toMatchObject({
      title: 'Le Brise-pieds',
      bpm: 104,
      key: 'Do majeur',
      confidence: 1,
      method: 'verified-library',
    });
    expect(result.events).toHaveLength(62);
    expect(result.events.slice(0, 4).map((event) => event.midi)).toEqual([67, 69, 67, 69]);
    expect(result.warnings.join(' ')).toContain('synchronisation');
  });

  it('does not fuzzy-match an unrelated video title', () => {
    expect(findVerifiedSongByTitle('Mon Bal Idéal', SONG_SEEDS)).toBeUndefined();
  });
});
