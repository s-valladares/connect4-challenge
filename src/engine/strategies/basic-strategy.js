/**
 * BasicStrategy: (1) victoria inmediata, (2) bloqueo de victoria rival,
 * (3) preferencia central [3,4,2,5,1,6,0,7], (4) fallback legal.
 * Es el piso de seguridad del bot y el fallback de SearchStrategy.
 * Owner: Jorge (D04).
 */

import { findImmediateWin, findImmediateBlock, getSafeFallback } from '../tactics.js';

export { CENTER_ORDER } from '../bitboard.js';

/** @type {import('../types.js').MoveStrategy} */
export const basicStrategy = {
  name: 'basic',
  /**
   * @param {import('../types.js').MoveContext} context
   * @returns {import('../types.js').MoveDecision}
   */
  chooseMove(context) {
    const start = performance.now();
    const win = findImmediateWin(context.board, context.player, context.legalMoves);
    const block = win.length ? [] : findImmediateBlock(context.board, context.player, context.legalMoves);
    const column = win[0] ?? block[0] ?? getSafeFallback(context.legalMoves);
    return {
      column,
      strategy: 'basic',
      depthCompleted: win.length || block.length ? 1 : 0,
      elapsedMs: Math.round(performance.now() - start),
      nodesVisited: 0,
      fallbackUsed: false,
      score: null,
    };
  },
};
