/**
 * Ordenación de movimientos para maximizar poda alfa-beta:
 * centro primero, luego jugadas tácticas (victoria/bloqueo) si se conocen.
 * Owner: Jorge (E02).
 */

import { CENTER_ORDER } from './strategies/basic-strategy.js';

/**
 * @param {number[]} legalMoves
 * @param {Object} [hints] p. ej. mejor jugada de iteración anterior o TT
 * @returns {number[]} columnas ordenadas por prioridad de exploración
 */
export function orderMoves(legalMoves, hints) {
  // Orden base por cercanía al centro; estable y sin aleatoriedad.
  return CENTER_ORDER.filter((c) => legalMoves.includes(c));
}
