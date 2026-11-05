/**
 * Repositorio de partidas humanas: crear, obtener con moves, registrar jugada
 * con transacción e idempotencia por (game_id, turn).
 * Se guardan las JUGADAS; el tablero se reconstruye con replayMoves (una sola
 * fuente de verdad, auditable).
 * Owner: Juan (B03/B04).
 */

import { randomUUID } from 'node:crypto';

const now = () => new Date().toISOString();

/**
 * @param {import('better-sqlite3').Database} db
 */
export function createGameRepository(db) {
  const q = {
    insertGame: db.prepare(`INSERT INTO local_games (id, human_player, status, current_player, winner, created_at, updated_at)
      VALUES (@id, @humanPlayer, 'playing', 1, NULL, @ts, @ts)`),
    getGame: db.prepare('SELECT * FROM local_games WHERE id = ?'),
    getMoves: db.prepare('SELECT column FROM local_moves WHERE game_id = ? ORDER BY turn'),
    insertMove: db.prepare(`INSERT INTO local_moves (game_id, turn, player, column, created_at)
      VALUES (@gameId, @turn, @player, @column, @ts)`),
    updateGame: db.prepare('UPDATE local_games SET status = @status, current_player = @currentPlayer, winner = @winner, updated_at = @ts WHERE id = @id'),
    awaitingBot: db.prepare("SELECT id FROM local_games WHERE status = 'playing' AND current_player IS NOT NULL AND current_player <> human_player"),
  };

  const toGame = (row) => row && {
    id: row.id, humanPlayer: row.human_player, status: row.status, currentPlayer: row.current_player,
    winner: row.winner, createdAt: row.created_at, updatedAt: row.updated_at,
  };

  return {
    /** @returns {string} id de la partida (lg_xxxxxxxx) */
    createGame({ id = `lg_${randomUUID().slice(0, 8)}`, humanPlayer }) {
      q.insertGame.run({ id, humanPlayer, ts: now() });
      return id;
    },
    getGame(id) {
      return toGame(q.getGame.get(id)) ?? null;
    },
    /** @returns {number[]} columnas en orden de turno */
    getMoves(gameId) {
      return q.getMoves.all(gameId).map((r) => r.column);
    },
    /**
     * Guarda jugadas y el nuevo estado en UNA transacción: o queda todo o nada.
     * Un turno repetido viola la PK (game_id, turn) y no se guarda nada.
     * @param {string} gameId
     * @param {Array<{ turn: number, player: number, column: number }>} moves
     * @param {{ status: string, currentPlayer: number|null, winner: number|null }} state
     */
    appendMoves: db.transaction((gameId, moves, state) => {
      const ts = now();
      for (const m of moves) q.insertMove.run({ gameId, turn: m.turn, player: m.player, column: m.column, ts });
      q.updateGame.run({ id: gameId, status: state.status, currentPlayer: state.currentPlayer, winner: state.winner, ts });
    }),
    /** Partidas que quedaron esperando la jugada del bot (p. ej. la API se cayó). */
    gamesAwaitingBot() {
      return q.awaitingBot.all().map((r) => r.id);
    },
  };
}
