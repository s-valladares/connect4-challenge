/**
 * TurnOrchestrator: recibe un turno validado del árbitro y produce la jugada.
 * 1) Calcula presupuesto local (deadline_ms − margen de red/POST).
 * 2) Elige fallback legal INMEDIATO (protección ante excepciones).
 * 3) Invoca engine-service.chooseMove con MoveContext.
 * 4) Verifica decision.column ∈ legal_moves justo antes de entregarla.
 * NO hace HTTP directamente (eso es del referee-client) ni depende de SQLite.
 * Owner: Salva (A03).
 */

import { chooseMove as engineChooseMove } from '../engine/engine-service.js';
import { getSafeFallback } from '../engine/tactics.js';

/**
 * Presupuesto local conservador. No restamos relojes de máquinas distintas
 * (served_at viene del servidor): medimos desde que RECIBIMOS el turno y
 * reservamos `safetyMs` para validar y enviar el POST.
 */
export function computeBudget(turn, receivedAt, { budgetMs = 1500, safetyMs = 1000, now = () => performance.now() } = {}) {
  const deadline = Number.isFinite(turn?.deadline_ms) ? turn.deadline_ms : 3000;
  const already = now() - receivedAt;
  return Math.max(50, Math.min(budgetMs, deadline - safetyMs - already));
}

/**
 * @param {Object} turn  Turno ya validado por referee-validator (shape 1.0.1).
 * @param {Object} [deps] Inyección para tests: { chooseMove, now, budgetMs, receivedAt, legalMoves, strategy }
 *   `legalMoves`: columnas seguras de validateTurn (por defecto turn.legal_moves).
 * @returns {Promise<{ column: number, decision: import('../engine/types.js').MoveDecision }>}
 */
export async function decideTurn(turn, deps = {}) {
  const {
    chooseMove = engineChooseMove, now = () => performance.now(), budgetMs = 1500,
    receivedAt = now(), legalMoves = turn.legal_moves, strategy = 'search',
  } = deps;
  const fallback = getSafeFallback(legalMoves);
  const timeBudgetMs = computeBudget(turn, receivedAt, { budgetMs, now });
  let decision;
  try {
    decision = chooseMove({ board: turn.board, player: turn.you, legalMoves, timeBudgetMs, gameId: turn.game_id }, strategy);
  } catch (e) {
    decision = {
      column: fallback, strategy, depthCompleted: 0, elapsedMs: 0, nodesVisited: 0, fallbackUsed: true, score: null, error: e.message,
    };
  }
  if (!legalMoves.includes(decision.column)) {
    decision = { ...decision, column: fallback, fallbackUsed: true };
  }
  return { column: decision.column, decision };
}
