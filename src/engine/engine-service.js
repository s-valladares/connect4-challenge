/**
 * Punto de entrada único al engine: selecciona la estrategia activa y
 * garantiza una decisión LEGAL (doble validación antes de retornar).
 * Lo consumen el turn-orchestrator (torneo) y local-game-service (humano).
 * Owner: Salva/Jorge.
 */

import { basicStrategy } from './strategies/basic-strategy.js';
import { searchStrategy } from './strategies/search-strategy.js';
import { getSafeFallback } from './tactics.js';

export const strategies = Object.freeze({
  basic: basicStrategy,
  search: searchStrategy,
});

/**
 * @param {import('./types.js').MoveContext} context
 * @param {'basic'|'search'} [strategyName]
 * @param {Record<string, import('./types.js').MoveStrategy>} [registry] inyección para pruebas
 * @returns {import('./types.js').MoveDecision}
 */
export function chooseMove(context, strategyName = 'search', registry = strategies) {
  if (!context?.legalMoves?.length) {
    throw new Error('legalMoves vacío: el llamador no debe invocar chooseMove.');
  }
  const strategy = registry[strategyName];
  if (!strategy) throw new Error(`Estrategia desconocida: ${strategyName}`);
  const start = performance.now();
  try {
    const decision = strategy.chooseMove(context);
    if (context.legalMoves.includes(decision.column)) return decision;
    return { ...decision, column: getSafeFallback(context.legalMoves), fallbackUsed: true };
  } catch (err) {
    // Jamás dejar al worker ni a la API sin jugada: ante cualquier fallo, respaldo legal.
    return {
      column: getSafeFallback(context.legalMoves),
      strategy: strategyName,
      depthCompleted: 0,
      elapsedMs: Math.round(performance.now() - start),
      nodesVisited: 0,
      fallbackUsed: true,
      score: null,
      error: err.message,
    };
  }
}
