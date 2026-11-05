/**
 * Migraciones SQLite. Se aplican al abrir la BD; idempotentes (schema_migrations).
 * Para cambiar el esquema: AGREGAR una migración nueva, nunca editar una aplicada.
 * Owner: Juan (B03).
 */

export const MIGRATIONS = [
  {
    id: 1,
    name: '001_initial',
    sql: `
CREATE TABLE IF NOT EXISTS local_games (
  id TEXT PRIMARY KEY,
  human_player INTEGER NOT NULL CHECK(human_player IN (1,2)),
  status TEXT NOT NULL CHECK(status IN ('playing','won','draw')),
  current_player INTEGER CHECK(current_player IN (1,2)),
  winner INTEGER CHECK(winner IN (1,2)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS local_moves (
  game_id TEXT NOT NULL REFERENCES local_games(id),
  turn INTEGER NOT NULL CHECK(turn BETWEEN 1 AND 56),
  player INTEGER NOT NULL CHECK(player IN (1,2)),
  column INTEGER NOT NULL CHECK(column BETWEEN 0 AND 7),
  created_at TEXT NOT NULL,
  PRIMARY KEY (game_id, turn)
);
CREATE TABLE IF NOT EXISTS training_runs (
  id TEXT PRIMARY KEY,
  config_json TEXT NOT NULL,
  seed INTEGER,
  games INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  summary_json TEXT
);
CREATE TABLE IF NOT EXISTS training_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL REFERENCES training_runs(id),
  game_index INTEGER NOT NULL,
  first_strategy TEXT NOT NULL,
  second_strategy TEXT NOT NULL,
  winner INTEGER CHECK(winner IN (1,2)),
  plies INTEGER NOT NULL,
  illegal INTEGER NOT NULL DEFAULT 0,
  max_ms INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS referee_observations (
  game_id TEXT NOT NULL,
  turn INTEGER NOT NULL,
  decision_json TEXT NOT NULL,
  move_status TEXT,
  observed_at TEXT NOT NULL,
  PRIMARY KEY (game_id, turn)
);
CREATE INDEX IF NOT EXISTS idx_local_games_updated ON local_games(updated_at);
CREATE INDEX IF NOT EXISTS idx_training_results_run ON training_results(run_id);
`,
  },
];

/** @param {import('better-sqlite3').Database} db */
export function migrate(db) {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (id INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)');
  const applied = new Set(db.prepare('SELECT id FROM schema_migrations').all().map((r) => r.id));
  for (const m of MIGRATIONS) {
    if (applied.has(m.id)) continue;
    db.transaction(() => {
      db.exec(m.sql);
      db.prepare('INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?)').run(m.id, m.name, new Date().toISOString());
    })();
  }
}
