/**
 * SearchStrategy: negamax + poda alfa-beta + iterative deepening con deadline.
 * Conserva la mejor jugada de la última iteración COMPLETA; si el tiempo se
 * agota o algo falla, cae a basicStrategy (fallbackUsed=true).
 * La tabla de transposición vive en el Searcher y se reutiliza entre jugadas
 * de la misma sesión (lo aprendido en una jugada sirve para la siguiente).
 * Owner: Jorge (E02/E03).
 */

import { basicStrategy } from './basic-strategy.js';
import { Position } from '../bitboard.js';
import { Searcher } from '../negamax.js';
import { findImmediateWin } from '../tactics.js';

/**
 * @param {{ maxDepth?: number, now?: () => number }} [options]
 * @returns {import('../types.js').MoveStrategy & { searcher: Searcher }}
 */
export function createSearchStrategy({ maxDepth, now } = {}) {
  const searcher = new Searcher({ maxDepth, now });
  return {
    name: 'search',
    searcher,
    /**
     * @param {import('../types.js').MoveContext} context
     * @returns {import('../types.js').MoveDecision}
     */
    chooseMove(context) {
      const start = performance.now();
      const base = { strategy: 'search', fallbackUsed: false, depthCompleted: 0, nodesVisited: 0, score: null };
      const win = findImmediateWin(context.board, context.player, context.legalMoves);
      if (win.length) return { ...base, column: win[0], elapsedMs: Math.round(performance.now() - start) };
      if (context.legalMoves.length === 1) return { ...base, column: context.legalMoves[0], elapsedMs: 0 };
      try {
        const r = searcher.search(Position.fromBoard(context.board, context.player), context.timeBudgetMs);
        const legal = context.legalMoves.includes(r.column);
        if (!legal || r.depthCompleted === 0) throw new Error('La búsqueda no completó ninguna profundidad legal.');
        return {
          ...base,
          column: r.column,
          depthCompleted: r.depthCompleted,
          elapsedMs: Math.round(performance.now() - start),
          nodesVisited: r.nodesVisited,
          score: r.score,
        };
      } catch {
        const d = basicStrategy.chooseMove(context);
        return { ...d, strategy: 'search', fallbackUsed: true, elapsedMs: Math.round(performance.now() - start) };
      }
    },
  };
}

/** Instancia compartida por el proceso (worker o API): una sola TT por proceso. */
/** @type {import('../types.js').MoveStrategy} */
export const searchStrategy = createSearchStrategy();

export { basicStrategy as fallbackStrategy } from './basic-strategy.js';
