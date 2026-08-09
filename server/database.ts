import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { ACCORDION_SEEDS } from './seed.js';
import { SONG_SEEDS } from './songSeed.js';
import { withBuiltInArrangements } from './arrangements.js';
import { BUILT_IN_INSTRUMENTS, type StoredInstrumentConfig } from './instruments.js';
import { summarizePractice, type StoredPracticeSession } from './progress.js';

interface PublicUserRow {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
}

interface StoredUserPreferences {
  accordionId: string;
  instrumentType?: 'accordion' | 'piano' | 'guitar';
  pianoId?: string;
  guitarId?: string;
  notation: 'french' | 'english' | 'tablature' | 'button';
  countIn: boolean;
  onboardingDone: boolean;
  tutorialDone: boolean;
}

export interface StoredTunerReading {
  id: string;
  sessionId: string;
  accordionId: string;
  accordionModel: string;
  buttonId: string;
  row: number;
  buttonIndex: number;
  hand: 'right' | 'left';
  direction: 'push' | 'pull';
  expectedMidi: number;
  detectedMidi: number;
  frequency: number;
  cents: number;
  confidence: number;
  volume: number;
  outcome: 'matched' | 'corrected';
  measuredAt: string;
}

export interface StoredLeftHandAcousticProfile {
  accordionId: string;
  accordionModel: string;
  referencePitchHz: number;
  completedAt: string;
  samples: Array<{
    buttonId: string;
    buttonIndex: number;
    row: number;
    direction: 'push' | 'pull';
    role: 'bass' | 'chord';
    expectedLabel: string;
    detectedLabel: string;
    expectedRootPitchClass: number;
    detectedRootPitchClass: number;
    chordQuality?: 'major' | 'minor';
    confidence: number;
    tuningCents?: number;
    chroma: number[];
    outcome: 'matched' | 'uncertain' | 'mismatch';
    measuredAt: string;
  }>;
}

export class SouffletDatabase {
  private readonly db: DatabaseSync;

  constructor(dataDir: string) {
    mkdirSync(dataDir, { recursive: true });
    this.db = new DatabaseSync(join(dataDir, 'soufflet.db'));
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS accordion_configs (
        id TEXT PRIMARY KEY,
        maker TEXT NOT NULL,
        model TEXT NOT NULL,
        tuning TEXT NOT NULL,
        payload TEXT NOT NULL,
        is_builtin INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    this.migrate();
    this.seed();
  }

  private migrate() {
    const migrations = [
      `
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL UNIQUE COLLATE NOCASE,
          display_name TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS sessions (
          token_hash TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires_at TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
        CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);
        CREATE TABLE IF NOT EXISTS songs (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          artist TEXT NOT NULL,
          payload TEXT NOT NULL,
          is_common INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `,
      `
        ALTER TABLE accordion_configs ADD COLUMN owner_user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS accordion_configs_owner_idx ON accordion_configs(owner_user_id);
      `,
      `
        CREATE TABLE IF NOT EXISTS practice_sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          song_id TEXT NOT NULL,
          song_title TEXT NOT NULL,
          mode TEXT NOT NULL,
          started_at TEXT NOT NULL,
          ended_at TEXT NOT NULL,
          active_seconds INTEGER NOT NULL DEFAULT 0 CHECK(active_seconds >= 0),
          correct_count INTEGER NOT NULL DEFAULT 0 CHECK(correct_count >= 0),
          early_count INTEGER NOT NULL DEFAULT 0 CHECK(early_count >= 0),
          late_count INTEGER NOT NULL DEFAULT 0 CHECK(late_count >= 0),
          wrong_count INTEGER NOT NULL DEFAULT 0 CHECK(wrong_count >= 0),
          completion_percent REAL NOT NULL DEFAULT 0 CHECK(completion_percent >= 0 AND completion_percent <= 100),
          tempo_percent INTEGER NOT NULL DEFAULT 100 CHECK(tempo_percent >= 40 AND tempo_percent <= 120),
          flagged INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS practice_sessions_user_ended_idx ON practice_sessions(user_id, ended_at DESC);
        CREATE INDEX IF NOT EXISTS practice_sessions_user_song_idx ON practice_sessions(user_id, song_id);
      `,
      `
        CREATE TABLE IF NOT EXISTS user_preferences (
          user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          accordion_id TEXT NOT NULL,
          notation TEXT NOT NULL CHECK(notation IN ('french', 'english', 'tablature', 'button')),
          count_in INTEGER NOT NULL DEFAULT 1,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `,
      `
        ALTER TABLE user_preferences ADD COLUMN onboarding_done INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE user_preferences ADD COLUMN tutorial_done INTEGER NOT NULL DEFAULT 0;
        UPDATE user_preferences
        SET onboarding_done = 1, tutorial_done = 1
        WHERE EXISTS (
          SELECT 1 FROM practice_sessions
          WHERE practice_sessions.user_id = user_preferences.user_id
            AND practice_sessions.active_seconds > 0
        );
      `,
      `
        ALTER TABLE practice_sessions ADD COLUMN hand TEXT NOT NULL DEFAULT 'right'
          CHECK(hand IN ('right', 'left', 'both'));
        UPDATE practice_sessions SET hand = 'both' WHERE mode IN ('demo', 'combined');
        UPDATE practice_sessions SET hand = 'left' WHERE mode = 'left';
      `,
      `
        CREATE TABLE IF NOT EXISTS tuner_readings (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          accordion_id TEXT NOT NULL,
          accordion_model TEXT NOT NULL,
          button_id TEXT NOT NULL,
          button_row INTEGER NOT NULL,
          button_index INTEGER NOT NULL,
          direction TEXT NOT NULL CHECK(direction IN ('push', 'pull')),
          expected_midi INTEGER NOT NULL CHECK(expected_midi BETWEEN 0 AND 127),
          detected_midi INTEGER NOT NULL CHECK(detected_midi BETWEEN 0 AND 127),
          frequency REAL NOT NULL CHECK(frequency > 0),
          cents REAL NOT NULL CHECK(cents BETWEEN -100 AND 100),
          confidence REAL NOT NULL CHECK(confidence BETWEEN 0 AND 1),
          volume REAL NOT NULL CHECK(volume >= 0),
          outcome TEXT NOT NULL CHECK(outcome IN ('matched', 'corrected')),
          measured_at TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS tuner_readings_user_session_idx
          ON tuner_readings(user_id, session_id, measured_at);
        CREATE INDEX IF NOT EXISTS tuner_readings_user_latest_idx
          ON tuner_readings(user_id, measured_at DESC);
      `,
      `
        ALTER TABLE tuner_readings ADD COLUMN hand TEXT NOT NULL DEFAULT 'right'
          CHECK(hand IN ('right', 'left'));
      `,
      `
        CREATE TABLE IF NOT EXISTS accordion_audio_profiles (
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          accordion_id TEXT NOT NULL,
          kind TEXT NOT NULL CHECK(kind IN ('left-hand')),
          payload TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY(user_id, accordion_id, kind)
        );
        CREATE INDEX IF NOT EXISTS accordion_audio_profiles_user_idx
          ON accordion_audio_profiles(user_id, updated_at DESC);
      `,
      `
        ALTER TABLE practice_sessions ADD COLUMN assessment_breakdown TEXT NOT NULL DEFAULT '{}';
      `,
      `
        CREATE TABLE IF NOT EXISTS user_songs (
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          id TEXT NOT NULL,
          title TEXT NOT NULL,
          artist TEXT NOT NULL,
          payload TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY(user_id, id)
        );
        CREATE INDEX IF NOT EXISTS user_songs_user_updated_idx
          ON user_songs(user_id, updated_at DESC);
      `,
      `
        CREATE TABLE IF NOT EXISTS instrument_configs (
          id TEXT PRIMARY KEY,
          instrument_type TEXT NOT NULL CHECK(instrument_type IN ('piano', 'guitar')),
          name TEXT NOT NULL,
          payload TEXT NOT NULL,
          is_builtin INTEGER NOT NULL DEFAULT 0,
          owner_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS instrument_configs_owner_idx
          ON instrument_configs(owner_user_id, instrument_type);
        ALTER TABLE user_preferences ADD COLUMN instrument_type TEXT NOT NULL DEFAULT 'accordion'
          CHECK(instrument_type IN ('accordion', 'piano', 'guitar'));
        ALTER TABLE user_preferences ADD COLUMN piano_id TEXT NOT NULL DEFAULT 'piano-standard-61';
        ALTER TABLE user_preferences ADD COLUMN guitar_id TEXT NOT NULL DEFAULT 'guitar-standard-6';
        ALTER TABLE practice_sessions ADD COLUMN instrument_type TEXT NOT NULL DEFAULT 'accordion'
          CHECK(instrument_type IN ('accordion', 'piano', 'guitar'));
      `,
    ];
    const applied = this.db.prepare('SELECT version FROM schema_migrations').all() as Array<{ version: number }>;
    const versions = new Set(applied.map((row) => row.version));
    migrations.forEach((sql, index) => {
      const version = index + 1;
      if (versions.has(version)) return;
      this.db.exec('BEGIN IMMEDIATE');
      try {
        this.db.exec(sql);
        this.db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(version);
        this.db.exec('COMMIT');
      } catch (error) {
        this.db.exec('ROLLBACK');
        throw error;
      }
    });
  }

  private seed() {
    const insertAccordion = this.db.prepare(`
      INSERT INTO accordion_configs (id, maker, model, tuning, payload, is_builtin)
      VALUES (?, ?, ?, ?, ?, 1)
      ON CONFLICT(id) DO UPDATE SET
        maker = excluded.maker,
        model = excluded.model,
        tuning = excluded.tuning,
        payload = excluded.payload,
        updated_at = CURRENT_TIMESTAMP
      WHERE accordion_configs.is_builtin = 1
    `);
    const insertSong = this.db.prepare(`
      INSERT INTO songs (id, title, artist, payload, is_common)
      VALUES (?, ?, ?, ?, 1)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        artist = excluded.artist,
        payload = excluded.payload,
        updated_at = CURRENT_TIMESTAMP
      WHERE songs.is_common = 1
    `);
    const insertInstrument = this.db.prepare(`
      INSERT INTO instrument_configs (id, instrument_type, name, payload, is_builtin)
      VALUES (?, ?, ?, ?, 1)
      ON CONFLICT(id) DO UPDATE SET
        instrument_type = excluded.instrument_type,
        name = excluded.name,
        payload = excluded.payload,
        updated_at = CURRENT_TIMESTAMP
      WHERE instrument_configs.is_builtin = 1
    `);
    this.db.exec('BEGIN');
    try {
      for (const config of ACCORDION_SEEDS) insertAccordion.run(config.id, config.maker, config.model, config.tuning, JSON.stringify(config));
      for (const config of BUILT_IN_INSTRUMENTS) insertInstrument.run(config.id, config.instrumentType, config.name, JSON.stringify(config));
      for (const rawSong of SONG_SEEDS) {
        const song = withBuiltInArrangements(rawSong);
        insertSong.run(song.id, song.title, song.artist, JSON.stringify(song));
      }
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  listAccordions(ownerUserId?: string) {
    const rows = (ownerUserId
      ? this.db.prepare('SELECT payload FROM accordion_configs WHERE is_builtin = 1 OR owner_user_id = ? ORDER BY is_builtin DESC, maker, model').all(ownerUserId)
      : this.db.prepare('SELECT payload FROM accordion_configs WHERE is_builtin = 1 ORDER BY maker, model').all()) as Array<{ payload: string }>;
    return rows.map((row) => JSON.parse(row.payload) as unknown);
  }

  listInstruments(ownerUserId?: string, instrumentType?: 'piano' | 'guitar') {
    const conditions = ['(is_builtin = 1' + (ownerUserId ? ' OR owner_user_id = ?)' : ')')];
    const parameters: string[] = ownerUserId ? [ownerUserId] : [];
    if (instrumentType) { conditions.push('instrument_type = ?'); parameters.push(instrumentType); }
    const rows = this.db.prepare(`
      SELECT payload FROM instrument_configs
      WHERE ${conditions.join(' AND ')}
      ORDER BY is_builtin DESC, name COLLATE NOCASE
    `).all(...parameters) as Array<{ payload: string }>;
    return rows.map((row) => JSON.parse(row.payload) as StoredInstrumentConfig);
  }

  saveInstrument(config: StoredInstrumentConfig, ownerUserId: string) {
    const stored = { ...config, builtIn: false };
    this.db.prepare(`
      INSERT INTO instrument_configs (id, instrument_type, name, payload, is_builtin, owner_user_id)
      VALUES (?, ?, ?, ?, 0, ?)
      ON CONFLICT(id) DO UPDATE SET
        instrument_type = excluded.instrument_type, name = excluded.name,
        payload = excluded.payload, updated_at = CURRENT_TIMESTAMP
      WHERE instrument_configs.is_builtin = 0 AND instrument_configs.owner_user_id = excluded.owner_user_id
    `).run(stored.id, stored.instrumentType, stored.name, JSON.stringify(stored), ownerUserId);
    return stored;
  }

  getAccordion(id: string) {
    const row = this.db.prepare('SELECT payload FROM accordion_configs WHERE id = ?').get(id) as { payload: string } | undefined;
    return row ? JSON.parse(row.payload) as (typeof ACCORDION_SEEDS)[number] : undefined;
  }

  saveAccordion(config: { id: string; maker: string; model: string; tuning: string; [key: string]: unknown }, ownerUserId: string) {
    this.db.prepare(`
      INSERT INTO accordion_configs (id, maker, model, tuning, payload, is_builtin, owner_user_id)
      VALUES (?, ?, ?, ?, ?, 0, ?)
      ON CONFLICT(id) DO UPDATE SET
        maker = excluded.maker, model = excluded.model, tuning = excluded.tuning,
        payload = excluded.payload, updated_at = CURRENT_TIMESTAMP
      WHERE accordion_configs.is_builtin = 0
    `).run(config.id, config.maker, config.model, config.tuning, JSON.stringify(config), ownerUserId);
    return config;
  }

  updateAccordion(id: string, config: { id: string; maker: string; model: string; tuning: string; [key: string]: unknown }, ownerUserId: string) {
    const result = this.db.prepare(`
      UPDATE accordion_configs
      SET maker = ?, model = ?, tuning = ?, payload = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND is_builtin = 0 AND owner_user_id = ?
    `).run(config.maker, config.model, config.tuning, JSON.stringify(config), id, ownerUserId);
    return result.changes ? config : undefined;
  }

  listCommonSongs() {
    const rows = this.db.prepare('SELECT payload FROM songs WHERE is_common = 1 ORDER BY title COLLATE NOCASE').all() as Array<{ payload: string }>;
    return rows.map((row) => JSON.parse(row.payload) as unknown);
  }

  listLibrarySongs(ownerUserId: string) {
    const common = this.listCommonSongs();
    const personal = this.db.prepare(`
      SELECT payload FROM user_songs
      WHERE user_id = ?
      ORDER BY updated_at DESC
    `).all(ownerUserId) as Array<{ payload: string }>;
    return [...common, ...personal.map((row) => JSON.parse(row.payload) as unknown)];
  }

  saveUserSong(ownerUserId: string, song: { id: string; title: string; artist: string }) {
    const stored = { ...song, builtIn: false };
    this.db.prepare(`
      INSERT INTO user_songs (user_id, id, title, artist, payload)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id, id) DO UPDATE SET
        title = excluded.title,
        artist = excluded.artist,
        payload = excluded.payload,
        updated_at = CURRENT_TIMESTAMP
    `).run(ownerUserId, stored.id, stored.title, stored.artist, JSON.stringify(stored));
    return stored;
  }

  deleteUserSong(ownerUserId: string, id: string) {
    return this.db.prepare('DELETE FROM user_songs WHERE user_id = ? AND id = ?').run(ownerUserId, id).changes > 0;
  }

  createUser(user: { id: string; email: string; displayName: string; passwordHash: string }) {
    this.db.prepare('INSERT INTO users (id, email, display_name, password_hash) VALUES (?, ?, ?, ?)')
      .run(user.id, user.email.trim().toLowerCase(), user.displayName.trim(), user.passwordHash);
    return this.getUserById(user.id);
  }

  getUserCredentials(email: string) {
    return this.db.prepare('SELECT id, email, display_name, password_hash, created_at FROM users WHERE email = ? COLLATE NOCASE')
      .get(email.trim()) as (PublicUserRow & { password_hash: string }) | undefined;
  }

  getUserById(id: string) {
    const row = this.db.prepare('SELECT id, email, display_name, created_at FROM users WHERE id = ?').get(id) as PublicUserRow | undefined;
    return row ? { id: row.id, email: row.email, displayName: row.display_name, createdAt: row.created_at } : undefined;
  }

  updateUserProfile(id: string, profile: { email: string; displayName: string }) {
    const result = this.db.prepare(`
      UPDATE users
      SET email = ?, display_name = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(profile.email.trim().toLowerCase(), profile.displayName.trim(), id);
    return result.changes ? this.getUserById(id) : undefined;
  }

  updateUserPassword(id: string, passwordHash: string) {
    const result = this.db.prepare(`
      UPDATE users
      SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(passwordHash, id);
    return Boolean(result.changes);
  }

  deleteUser(id: string) {
    const result = this.db.prepare('DELETE FROM users WHERE id = ?').run(id);
    return Boolean(result.changes);
  }

  getUserPreferences(userId: string) {
    const row = this.db.prepare(`
      SELECT accordion_id, instrument_type, piano_id, guitar_id, notation, count_in, onboarding_done, tutorial_done, updated_at
      FROM user_preferences WHERE user_id = ?
    `).get(userId) as {
      accordion_id: string;
      instrument_type: 'accordion' | 'piano' | 'guitar';
      piano_id: string;
      guitar_id: string;
      notation: StoredUserPreferences['notation'];
      count_in: number;
      onboarding_done: number;
      tutorial_done: number;
      updated_at: string;
    } | undefined;
    return row ? {
      accordionId: row.accordion_id,
      instrumentType: row.instrument_type,
      pianoId: row.piano_id,
      guitarId: row.guitar_id,
      notation: row.notation,
      countIn: Boolean(row.count_in),
      onboardingDone: Boolean(row.onboarding_done),
      tutorialDone: Boolean(row.tutorial_done),
      updatedAt: row.updated_at,
    } : null;
  }

  saveUserPreferences(userId: string, preferences: StoredUserPreferences) {
    this.db.prepare(`
      INSERT INTO user_preferences (user_id, accordion_id, instrument_type, piano_id, guitar_id, notation, count_in, onboarding_done, tutorial_done)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        accordion_id = excluded.accordion_id,
        instrument_type = excluded.instrument_type,
        piano_id = excluded.piano_id,
        guitar_id = excluded.guitar_id,
        notation = excluded.notation,
        count_in = excluded.count_in,
        onboarding_done = MAX(user_preferences.onboarding_done, excluded.onboarding_done),
        tutorial_done = MAX(user_preferences.tutorial_done, excluded.tutorial_done),
        updated_at = CURRENT_TIMESTAMP
    `).run(
      userId,
      preferences.accordionId,
      preferences.instrumentType ?? 'accordion',
      preferences.pianoId ?? 'piano-standard-61',
      preferences.guitarId ?? 'guitar-standard-6',
      preferences.notation,
      Number(preferences.countIn),
      Number(preferences.onboardingDone),
      Number(preferences.tutorialDone),
    );
    return this.getUserPreferences(userId)!;
  }

  createSession(tokenHash: string, userId: string, expiresAt: string) {
    this.db.prepare('DELETE FROM sessions WHERE datetime(expires_at) <= CURRENT_TIMESTAMP').run();
    this.db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(tokenHash, userId, expiresAt);
  }

  getSessionUser(tokenHash: string) {
    const row = this.db.prepare(`
      SELECT users.id, users.email, users.display_name, users.created_at
      FROM sessions JOIN users ON users.id = sessions.user_id
      WHERE sessions.token_hash = ? AND datetime(sessions.expires_at) > CURRENT_TIMESTAMP
    `).get(tokenHash) as PublicUserRow | undefined;
    return row ? { id: row.id, email: row.email, displayName: row.display_name, createdAt: row.created_at } : undefined;
  }

  deleteSession(tokenHash: string) {
    this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
  }

  deleteSessionsForUser(userId: string) {
    this.db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
  }

  savePracticeSession(userId: string, session: StoredPracticeSession) {
    this.db.prepare(`
      INSERT INTO practice_sessions (
        id, user_id, song_id, song_title, mode, hand, instrument_type, started_at, ended_at, active_seconds,
        correct_count, early_count, late_count, wrong_count, completion_percent, tempo_percent, flagged,
        assessment_breakdown
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        song_id = excluded.song_id,
        song_title = excluded.song_title,
        mode = CASE WHEN excluded.ended_at >= practice_sessions.ended_at THEN excluded.mode ELSE practice_sessions.mode END,
        hand = CASE WHEN excluded.ended_at >= practice_sessions.ended_at THEN excluded.hand ELSE practice_sessions.hand END,
        instrument_type = CASE WHEN excluded.ended_at >= practice_sessions.ended_at THEN excluded.instrument_type ELSE practice_sessions.instrument_type END,
        started_at = excluded.started_at,
        ended_at = MAX(practice_sessions.ended_at, excluded.ended_at),
        active_seconds = MAX(practice_sessions.active_seconds, excluded.active_seconds),
        correct_count = MAX(practice_sessions.correct_count, excluded.correct_count),
        early_count = MAX(practice_sessions.early_count, excluded.early_count),
        late_count = MAX(practice_sessions.late_count, excluded.late_count),
        wrong_count = MAX(practice_sessions.wrong_count, excluded.wrong_count),
        completion_percent = MAX(practice_sessions.completion_percent, excluded.completion_percent),
        tempo_percent = CASE WHEN excluded.ended_at >= practice_sessions.ended_at THEN excluded.tempo_percent ELSE practice_sessions.tempo_percent END,
        flagged = CASE WHEN excluded.ended_at >= practice_sessions.ended_at THEN excluded.flagged ELSE practice_sessions.flagged END,
        assessment_breakdown = CASE
          WHEN excluded.ended_at >= practice_sessions.ended_at AND excluded.assessment_breakdown <> '{}'
          THEN excluded.assessment_breakdown ELSE practice_sessions.assessment_breakdown END,
        updated_at = CURRENT_TIMESTAMP
      WHERE practice_sessions.user_id = excluded.user_id
    `).run(
      session.id, userId, session.songId, session.songTitle, session.mode, session.hand, session.instrumentType ?? 'accordion', session.startedAt, session.endedAt,
      session.activeSeconds, session.correctCount, session.earlyCount, session.lateCount, session.wrongCount,
      session.completionPercent, session.tempoPercent, Number(session.flagged),
      JSON.stringify(session.assessmentBreakdown ?? {}),
    );
    return session;
  }

  listPracticeSessions(userId: string): StoredPracticeSession[] {
    const rows = this.db.prepare(`
      SELECT id, song_id, song_title, mode, hand, instrument_type, started_at, ended_at, active_seconds,
             correct_count, early_count, late_count, wrong_count, completion_percent, tempo_percent, flagged,
             assessment_breakdown
      FROM practice_sessions
      WHERE user_id = ? AND active_seconds > 0
      ORDER BY ended_at DESC
    `).all(userId) as Array<{
      id: string; song_id: string; song_title: string; mode: string; hand: 'right' | 'left' | 'both'; instrument_type: StoredPracticeSession['instrumentType']; started_at: string; ended_at: string;
      active_seconds: number; correct_count: number; early_count: number; late_count: number; wrong_count: number;
      completion_percent: number; tempo_percent: number; flagged: number; assessment_breakdown: string;
    }>;
    return rows.map((row) => ({
      id: row.id,
      songId: row.song_id,
      songTitle: row.song_title,
      mode: row.mode,
      hand: row.hand,
      instrumentType: row.instrument_type,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      activeSeconds: row.active_seconds,
      correctCount: row.correct_count,
      earlyCount: row.early_count,
      lateCount: row.late_count,
      wrongCount: row.wrong_count,
      completionPercent: row.completion_percent,
      tempoPercent: row.tempo_percent,
      flagged: Boolean(row.flagged),
      assessmentBreakdown: (() => {
        try {
          const parsed = JSON.parse(row.assessment_breakdown) as StoredPracticeSession['assessmentBreakdown'];
          return parsed?.right && parsed.left && parsed.coordination ? parsed : undefined;
        } catch { return undefined; }
      })(),
    }));
  }

  getPracticeStats(userId: string, timezoneOffset = 0, now = new Date()) {
    return summarizePractice(this.listPracticeSessions(userId), timezoneOffset, now);
  }

  saveTunerReading(userId: string, reading: StoredTunerReading) {
    this.db.prepare(`
      INSERT INTO tuner_readings (
        id, session_id, user_id, accordion_id, accordion_model, button_id, button_row, button_index,
        hand, direction, expected_midi, detected_midi, frequency, cents, confidence, volume, outcome, measured_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        accordion_id = excluded.accordion_id,
        accordion_model = excluded.accordion_model,
        button_id = excluded.button_id,
        button_row = excluded.button_row,
        button_index = excluded.button_index,
        hand = excluded.hand,
        direction = excluded.direction,
        expected_midi = excluded.expected_midi,
        detected_midi = excluded.detected_midi,
        frequency = excluded.frequency,
        cents = excluded.cents,
        confidence = excluded.confidence,
        volume = excluded.volume,
        outcome = excluded.outcome,
        measured_at = excluded.measured_at
      WHERE tuner_readings.user_id = excluded.user_id
    `).run(
      reading.id, reading.sessionId, userId, reading.accordionId, reading.accordionModel,
      reading.buttonId, reading.row, reading.buttonIndex, reading.hand, reading.direction, reading.expectedMidi,
      reading.detectedMidi, reading.frequency, reading.cents, reading.confidence, reading.volume,
      reading.outcome, reading.measuredAt,
    );
    return reading;
  }

  listTunerReadings(userId: string, sessionId?: string): StoredTunerReading[] {
    const selectedSession = sessionId ?? (this.db.prepare(`
      SELECT session_id FROM tuner_readings WHERE user_id = ? ORDER BY measured_at DESC LIMIT 1
    `).get(userId) as { session_id: string } | undefined)?.session_id;
    if (!selectedSession) return [];
    const rows = this.db.prepare(`
      SELECT id, session_id, accordion_id, accordion_model, button_id, button_row, button_index,
             hand, direction, expected_midi, detected_midi, frequency, cents, confidence, volume, outcome, measured_at
      FROM tuner_readings
      WHERE user_id = ? AND session_id = ?
      ORDER BY measured_at, button_row, button_index
      LIMIT 240
    `).all(userId, selectedSession) as Array<{
      id: string; session_id: string; accordion_id: string; accordion_model: string; button_id: string;
      button_row: number; button_index: number; hand: 'right' | 'left'; direction: 'push' | 'pull'; expected_midi: number;
      detected_midi: number; frequency: number; cents: number; confidence: number; volume: number;
      outcome: 'matched' | 'corrected'; measured_at: string;
    }>;
    return rows.map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      accordionId: row.accordion_id,
      accordionModel: row.accordion_model,
      buttonId: row.button_id,
      row: row.button_row,
      buttonIndex: row.button_index,
      hand: row.hand,
      direction: row.direction,
      expectedMidi: row.expected_midi,
      detectedMidi: row.detected_midi,
      frequency: row.frequency,
      cents: row.cents,
      confidence: row.confidence,
      volume: row.volume,
      outcome: row.outcome,
      measuredAt: row.measured_at,
    }));
  }

  saveLeftHandAcousticProfile(userId: string, profile: StoredLeftHandAcousticProfile) {
    this.db.prepare(`
      INSERT INTO accordion_audio_profiles (user_id, accordion_id, kind, payload)
      VALUES (?, ?, 'left-hand', ?)
      ON CONFLICT(user_id, accordion_id, kind) DO UPDATE SET
        payload = excluded.payload,
        updated_at = CURRENT_TIMESTAMP
    `).run(userId, profile.accordionId, JSON.stringify(profile));
    return profile;
  }

  listLeftHandAcousticProfiles(userId: string): StoredLeftHandAcousticProfile[] {
    const rows = this.db.prepare(`
      SELECT payload FROM accordion_audio_profiles
      WHERE user_id = ? AND kind = 'left-hand'
      ORDER BY updated_at DESC
    `).all(userId) as Array<{ payload: string }>;
    return rows.map((row) => JSON.parse(row.payload) as StoredLeftHandAcousticProfile);
  }
}
