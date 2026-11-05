/**
 * Heurística: puntúa un estado no terminal para `player`.
 * Ventanas de 4 (horizontal/vertical/diagonales), amenazas propias y rivales,
 * control del centro. Determinista e interpretable (se explica al jurado).
 * Owner: Jorge (E01).
 */

/** Pesos de la heurística; candidatos a tuning en training/tuners.js (T03). */
export const WEIGHTS = {
  win: 1_000_000,
  threeOpen: 500,
  twoOpen: 60,
  center: 10,
  opponentThreeOpen: -800,
};

/**
 * @param {import('../domain/connect4/types.js').Board} board
 * @param {import('../domain/connect4/types.js').Player} player
 * @returns {number} puntuación desde la perspectiva de `player`
 */
export function evaluate(board, player) {
  throw new Error('TODO(E01): implementar evaluate');
}
