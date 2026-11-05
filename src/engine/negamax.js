/**
 * Negamax con poda alfa-beta sobre el dominio puro.
 * No conoce HTTP ni deadlines absolutos: recibe un presupuesto/checker.
 * Owner: Jorge (E02).
 */

/**
 * @param {Object} params
 * @param {import('../domain/connect4/types.js').Board} params.board
 * @param {import('../domain/connect4/types.js').Player} params.player
 * @param {number} params.depth
 * @param {number} params.alpha
 * @param {number} params.beta
 * @param {() => boolean} params.isTimeUp  Checker del presupuesto (iterative deepening).
 * @returns {{ score: number, column: number|null, nodes: number }}
 */
export function negamax(params) {
  throw new Error('TODO(E02): implementar negamax con poda alfa-beta');
}
