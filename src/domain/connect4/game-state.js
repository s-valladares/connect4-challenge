/**
 * Estado de una partida: tablero + turno + historial de columnas jugadas.
 * Permite reconstruir un tablero desde `moves` (como entrega el árbitro).
 * Owner: Jorge (D01/D02), lo consume Juan en local-game-service.
 */

/**
 * @typedef {Object} GameState
 * @property {import('./types.js').Board} board
 * @property {import('./types.js').Player} currentPlayer
 * @property {number[]} moves Columnas jugadas desde el inicio, en orden.
 * @property {'playing'|'won'|'draw'} status
 * @property {import('./types.js').Player|null} winner
 * @property {Array<[number, number]>|null} winningCells
 */

/**
 * @param {import('./types.js').Player} [firstPlayer]
 * @returns {GameState} partida nueva con tablero vacío
 */
export function createGameState(firstPlayer = 1) {
  throw new Error('TODO(D02): implementar createGameState');
}

/**
 * Reconstruye el estado aplicando la secuencia de columnas desde tablero vacío.
 * @param {number[]} moves
 * @returns {GameState}
 */
export function replayMoves(moves) {
  throw new Error('TODO(D02): implementar replayMoves');
}
