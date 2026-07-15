import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { ACCORDION_SEEDS } from './seed.js';

export class SouffletDatabase {
  private readonly db: DatabaseSync;

  constructor(dataDir: string) {
    mkdirSync(dataDir, { recursive: true });
    this.db = new DatabaseSync(join(dataDir, 'soufflet.db'));
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
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
    this.seed();
  }

  private seed() {
    const insert = this.db.prepare(`
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
    this.db.exec('BEGIN');
    try {
      for (const config of ACCORDION_SEEDS) insert.run(config.id, config.maker, config.model, config.tuning, JSON.stringify(config));
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  listAccordions() {
    const rows = this.db.prepare('SELECT payload FROM accordion_configs ORDER BY is_builtin DESC, maker, model').all() as Array<{ payload: string }>;
    return rows.map((row) => JSON.parse(row.payload) as unknown);
  }

  getAccordion(id: string) {
    const row = this.db.prepare('SELECT payload FROM accordion_configs WHERE id = ?').get(id) as { payload: string } | undefined;
    return row ? JSON.parse(row.payload) as (typeof ACCORDION_SEEDS)[number] : undefined;
  }

  saveAccordion(config: { id: string; maker: string; model: string; tuning: string; [key: string]: unknown }) {
    this.db.prepare(`
      INSERT INTO accordion_configs (id, maker, model, tuning, payload, is_builtin)
      VALUES (?, ?, ?, ?, ?, 0)
      ON CONFLICT(id) DO UPDATE SET
        maker = excluded.maker, model = excluded.model, tuning = excluded.tuning,
        payload = excluded.payload, updated_at = CURRENT_TIMESTAMP
      WHERE accordion_configs.is_builtin = 0
    `).run(config.id, config.maker, config.model, config.tuning, JSON.stringify(config));
    return config;
  }
}
