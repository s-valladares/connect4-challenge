/**
 * Detección de resultado: victoria en 4 direcciones (horizontal, vertical,
 * ambas diagonales) y empate (56 casillas llenas sin ganador).
 * Owner: Jorge (D03).
 */

/**
 * @typedef {Object} Outcome
 * @property {'playing'|'won'|'draw'} status
 * @property {import('./types.js').Player|null} winner
 * @property {Array<[number, number]>|null} winningCells Celdas [fila, columna] de la línea de 4.
 */

/**
 * @param {import('./types.js').Board} board
 * @returns {Outcome}
 */
export function getOutcome(board) {
  throw new Error('TODO(D03): implementar getOutcome');
}
