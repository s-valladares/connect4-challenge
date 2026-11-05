/**
 * Punto de entrada único al engine: selecciona la estrategia activa y
 * garantiza una decisión LEGAL (doble validación antes de retornar).
 * Lo consumen el turn-orchestrator (torneo) y local-game-service (humano).
 * Owner: Salva/Jorge.
 */

import { basicStrategy } from './strategies/basic-strategy.js';
import { searchStrategy } from './strategies/search-strategy.js';

const strategies = {
  basic: basicStrategy,
  search: searchStrategy,
};

/**
 * @param {import('./types.js').MoveContext} context
 * @param {'basic'|'search'} [strategyName]
 * @returns {import('./types.js').MoveDecision}
 */
export function chooseMove(context, strategyName = 'search') {
  // TODO(A03/D04): validar context.legalMoves no vacío, invocar estrategia,
  // verificar decision.column ∈ legalMoves; si no, fallback legal + log.
  throw new Error('TODO: implementar engine-service.chooseMove');
}
