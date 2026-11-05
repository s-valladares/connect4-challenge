/**
 * Conexión SQLite (better-sqlite3) con WAL y migraciones mínimas.
 * Tablas: local_games, local_moves (unique game_id+turn),
 * training_runs, training_results, referee_observations (best effort).
 * El worker del torneo NO depende de esta BD para decidir ni enviar jugadas.
 * Owner: Juan (B03).
 */

/**
 * @param {string} dbPath Ruta del archivo .db (de env DB_PATH; crear carpeta si falta).
 * @returns {import('better-sqlite3').Database}
 */
export function openDatabase(dbPath) {
  throw new Error('TODO(B03): abrir BD, PRAGMA journal_mode=WAL, correr migraciones');
}
