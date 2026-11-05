/**
 * Conexión SQLite (better-sqlite3) con WAL y migraciones mínimas.
 * Tablas: local_games, local_moves (unique game_id+turn),
 * training_runs, training_results, referee_observations (best effort).
 * El worker del torneo NO depende de esta BD para decidir ni enviar jugadas.
 * Owner: Juan (B03).
 */

import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { migrate } from './migrations.js';

/**
 * @param {string} dbPath Ruta del archivo .db (de env DB_PATH; crea la carpeta si falta) o ':memory:' en pruebas.
 * @returns {import('better-sqlite3').Database}
 */
export function openDatabase(dbPath = ':memory:') {
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  if (dbPath !== ':memory:') db.pragma('journal_mode = WAL');
  migrate(db);
  return db;
}
