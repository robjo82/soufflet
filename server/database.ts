import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { ACCORDION_SEEDS } from './seed.js';
import { SONG_SEEDS } from './songSeed.js';
import { summarizePractice, type StoredPracticeSession } from './progress.js';

interface PublicUserRow {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
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
    this.db.exec('BEGIN');
    try {
      for (const config of ACCORDION_SEEDS) insertAccordion.run(config.id, config.maker, config.model, config.tuning, JSON.stringify(config));
      for (const song of SONG_SEEDS) insertSong.run(song.id, song.title, song.artist, JSON.stringify(song));
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

  savePracticeSession(userId: string, session: StoredPracticeSession) {
    this.db.prepare(`
      INSERT INTO practice_sessions (
        id, user_id, song_id, song_title, mode, started_at, ended_at, active_seconds,
        correct_count, early_count, late_count, wrong_count, completion_percent, tempo_percent, flagged
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        song_id = excluded.song_id,
        song_title = excluded.song_title,
        mode = CASE WHEN excluded.ended_at >= practice_sessions.ended_at THEN excluded.mode ELSE practice_sessions.mode END,
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
        updated_at = CURRENT_TIMESTAMP
      WHERE practice_sessions.user_id = excluded.user_id
    `).run(
      session.id, userId, session.songId, session.songTitle, session.mode, session.startedAt, session.endedAt,
      session.activeSeconds, session.correctCount, session.earlyCount, session.lateCount, session.wrongCount,
      session.completionPercent, session.tempoPercent, Number(session.flagged),
    );
    return session;
  }

  listPracticeSessions(userId: string): StoredPracticeSession[] {
    const rows = this.db.prepare(`
      SELECT id, song_id, song_title, mode, started_at, ended_at, active_seconds,
             correct_count, early_count, late_count, wrong_count, completion_percent, tempo_percent, flagged
      FROM practice_sessions
      WHERE user_id = ? AND active_seconds > 0
      ORDER BY ended_at DESC
    `).all(userId) as Array<{
      id: string; song_id: string; song_title: string; mode: string; started_at: string; ended_at: string;
      active_seconds: number; correct_count: number; early_count: number; late_count: number; wrong_count: number;
      completion_percent: number; tempo_percent: number; flagged: number;
    }>;
    return rows.map((row) => ({
      id: row.id,
      songId: row.song_id,
      songTitle: row.song_title,
      mode: row.mode,
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
    }));
  }

  getPracticeStats(userId: string, timezoneOffset = 0, now = new Date()) {
    return summarizePractice(this.listPracticeSessions(userId), timezoneOffset, now);
  }
}
