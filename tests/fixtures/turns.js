/**
 * Turnos del árbitro (schema `Turn` del OpenAPI 1.0.1) para pruebas.
 * Regla de tests/fixtures/README.md: los turnos VÁLIDOS se generan con
 * replayMoves() desde tablero vacío. El ejemplo del PDF se guarda SOLO como
 * caso inválido (Edson confirmó que es ilustrativo).
 * Owner: Salva (A02); lo usa Alex en el mock.
 */
import { replayMoves } from '../../src/domain/connect4/game-state.js';

/** Turno coherente a partir de una lista de columnas. */
export function turnFromMoves(moves, extra = {}) {
  const s = replayMoves(moves);
  return {
    status: 'turn', game_id: 'g_fixture', match_id: null, kind: 'practice', you: s.currentPlayer,
    opponent: 'casa-basico', turn: moves.length + 1, board: s.board, moves: [...moves],
    last_move: moves.length ? { by: s.currentPlayer === 1 ? 2 : 1, column: moves.at(-1) } : null,
    legal_moves: s.legalMoves, deadline_ms: 3000, served_at: new Date().toISOString(), ...extra,
  };
}

/**
 * Ejemplo del PDF/OpenAPI: INCONSISTENTE (8 jugadas pero 6 fichas en el tablero
 * y `you: 2` cuando en el turno 9 le toca al 1). NO usar como fixture válida.
 */
export const INCONSISTENT_EXAMPLE = Object.freeze({
  status: 'turn', game_id: 'g_7f3a', match_id: 'm_12', kind: 'league', you: 2,
  opponent: 'Los Recursivos', turn: 9,
  board: [
    [0, 0, 1, 2, 1, 0, 0, 0], [0, 0, 2, 1, 0, 0, 0, 0], [0, 0, 0, 2, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0],
  ],
  moves: [3, 2, 3, 2, 4, 3, 2, 3], last_move: { by: 1, column: 3 },
  legal_moves: [0, 1, 2, 3, 4, 5, 6, 7], deadline_ms: 3000, served_at: '2026-11-05T15:04:05.123Z',
});
