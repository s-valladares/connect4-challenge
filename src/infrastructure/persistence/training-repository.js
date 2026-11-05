/**
 * Repositorio de entrenamiento: runs y resultados de self-play/benchmarks.
 * Owner: Alex (T01/T02). No es camino crítico del torneo (el worker no lo usa).
 */

import { randomUUID } from 'node:crypto';

/**
 * @param {import('better-sqlite3').Database} db
 */
export function createTrainingRepository(db) {
  const insertRun = db.prepare('INSERT INTO training_runs (id, config_json, seed, games, started_at) VALUES (?, ?, ?, ?, ?)');
  const insertResult = db.prepare(`INSERT INTO training_results (run_id, game_index, first_strategy, second_strategy, winner, plies, illegal, max_ms)
    VALUES (@runId, @gameIndex, @firstStrategy, @secondStrategy, @winner, @plies, @illegal, @maxMs)`);
  const finish = db.prepare('UPDATE training_runs SET finished_at = ?, summary_json = ? WHERE id = ?');
  const getRun = db.prepare('SELECT * FROM training_runs WHERE id = ?');
  const countResults = db.prepare('SELECT COUNT(*) AS n FROM training_results WHERE run_id = ?');

  return {
    /** @returns {string} id de la corrida */
    startRun({ config, seed, games }) {
      const id = randomUUID();
      insertRun.run(id, JSON.stringify(config), seed, games, new Date().toISOString());
      return id;
    },
    saveResult(runId, { gameIndex, firstStrategy, secondStrategy, winner = null, plies, illegal = 0, maxMs = 0 }) {
      insertResult.run({ runId, gameIndex, firstStrategy, secondStrategy, winner, plies, illegal, maxMs: Math.round(maxMs) });
    },
    finishRun(runId, summary) {
      finish.run(new Date().toISOString(), JSON.stringify(summary), runId);
    },
    getRun(runId) {
      const row = getRun.get(runId);
      if (!row) return null;
      return {
        id: row.id, seed: row.seed, games: row.games, config: JSON.parse(row.config_json),
        summary: row.summary_json ? JSON.parse(row.summary_json) : null, results: countResults.get(runId).n,
        startedAt: row.started_at, finishedAt: row.finished_at,
      };
    },
  };
}
