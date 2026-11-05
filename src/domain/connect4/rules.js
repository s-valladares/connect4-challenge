/**
 * Reglas puras: jugadas legales, gravedad y aplicación de movimiento.
 * El estado de origen NUNCA se muta; applyMove devuelve un tablero nuevo.
 * Owner: Jorge (D02).
 */

/**
 * Columnas no llenas, de 0 a 7.
 * @param {import('./types.js').Board} board
 * @returns {number[]}
 */
export function getLegalMoves(board) {
  throw new Error('TODO(D02): implementar getLegalMoves');
}

/**
 * Aplica un movimiento: la ficha cae a la fila vacía más baja de la columna.
 * @param {import('./types.js').Board} board
 * @param {number} column 0..7, debe ser legal
 * @param {import('./types.js').Player} player
 * @returns {import('./types.js').Board} tablero NUEVO (no muta el original)
 */
export function applyMove(board, column, player) {
  throw new Error('TODO(D02): implementar applyMove');
}
