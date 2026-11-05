/**
 * SearchStrategy: negamax + poda alfa-beta + iterative deepening con deadline.
 * Conserva la mejor jugada de la última iteración COMPLETA; si el tiempo se
 * agota o algo falla, cae a basicStrategy (fallbackUsed=true).
 * Owner: Jorge (E02/E03).
 */

import { basicStrategy } from './basic-strategy.js';

/** @type {import('../types.js').MoveStrategy} */
export const searchStrategy = {
  name: 'search',
  /**
   * @param {import('../types.js').MoveContext} context
   * @returns {import('../types.js').MoveDecision}
   */
  chooseMove(context) {
    // TODO(E03): iterative deepening con comprobación periódica de deadline
    // (performance.now()), nunca exceder context.timeBudgetMs de forma relevante.
    throw new Error('TODO(E02/E03): implementar searchStrategy.chooseMove');
  },
};

export { basicStrategy as fallbackStrategy };
