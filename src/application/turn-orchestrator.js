/**
 * TurnOrchestrator: recibe un turno VALIDADO (referee-validator) y produce
 * la jugada. Garantías:
 *  1. Presupuesto local = deadline_ms − transcurrido desde served_at − margen
 *     de red, acotado a [MIN_BUDGET_MS, maxBudgetMs]. Nunca fechas absolutas
 *     hacia el engine.
 *  2. Fallback legal calculado ANTES de invocar el engine (orden central).
 *  3. La decisión del engine se valida contra legalMoves; si lanza, excede
 *     o devuelve columna ilegal → se usa el fallback (fallbackUsed: true).
 * NO hace HTTP ni depende de SQLite.
 * Owner: Salva (A03).
 */

import { chooseMove as engineChooseMove } from '../engine/engine-service.js';
import { CENTER_ORDER } from '../engine/strategies/basic-strategy.js';

const NETWORK_MARGIN_MS = 800; // reserva para POST + validación + jitter de red
const MIN_BUDGET_MS = 50;
const DEFAULT_DEADLINE_MS = 3000;
const DEFAULT_MAX_BUDGET_MS = 1500;

/** Columna segura: la más central disponible. @param {number[]} legalMoves */
export function pickFallbackColumn(legalMoves) {
  for (const col of CENTER_ORDER) {
    if (legalMoves.includes(col)) return col;
  }
  return legalMoves[0];
}

/**
 * Presupuesto LOCAL de búsqueda en ms a partir del turno oficial.
 * @param {{ deadline_ms?: number, served_at?: string }} turn
 */
export function computeBudgetMs(turn, { now = Date.now(), maxBudgetMs = DEFAULT_MAX_BUDGET_MS, marginMs = NETWORK_MARGIN_MS } = {}) {
  const deadline =
    Number.isInteger(turn.deadline_ms) && turn.deadline_ms > 0
      ? turn.deadline_ms
      : DEFAULT_DEADLINE_MS;
  const servedAt = Date.parse(turn.served_at ?? '');
  const elapsed = Number.isNaN(servedAt) ? 0 : Math.max(0, now - servedAt);
  const remaining = deadline - elapsed - marginMs;
  return Math.max(MIN_BUDGET_MS, Math.min(maxBudgetMs, remaining));
}

/**
 * @param {{ turn: Object, legalMoves: number[] }} validated Resultado ok de validateTurn.
 * @param {{ chooseMove?: Function, maxBudgetMs?: number, now?: () => number }} [deps]
 * @returns {Promise<{ column: number, decision: import('../engine/types.js').MoveDecision }>}
 */
export async function decideTurn(validated, deps = {}) {
  const { turn, legalMoves } = validated;
  if (!Array.isArray(legalMoves) || legalMoves.length === 0) {
    // Invariante 3: jamás inventar una jugada sin movimientos legales.
    throw new Error('decideTurn: legalMoves vacío (estado terminal o anómalo)');
  }

  const chooseMove = deps.chooseMove ?? engineChooseMove;
  const timeBudgetMs = computeBudgetMs(turn, {
    now: deps.now ? deps.now() : Date.now(),
    maxBudgetMs: deps.maxBudgetMs ?? DEFAULT_MAX_BUDGET_MS,
  });
  const fallbackColumn = pickFallbackColumn(legalMoves);

  const started = performance.now();
  let fallbackReason = null;
  try {
    const decision = chooseMove({
      board: turn.board,
      player: turn.you,
      legalMoves,
      timeBudgetMs,
      gameId: turn.game_id,
    });
    if (decision && Number.isInteger(decision.column) && legalMoves.includes(decision.column)) {
      return { column: decision.column, decision };
    }
    fallbackReason = 'decision_ilegal_o_invalida';
  } catch (error) {
    fallbackReason = `engine_error:${error?.message ?? 'desconocido'}`;
  }

  return {
    column: fallbackColumn,
    decision: {
      column: fallbackColumn,
      strategy: `fallback-central(${fallbackReason})`,
      depthCompleted: 0,
      elapsedMs: Math.round(performance.now() - started),
      nodesVisited: 0,
      fallbackUsed: true,
      score: null,
    },
  };
}
