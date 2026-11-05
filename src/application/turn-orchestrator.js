/**
 * TurnOrchestrator: recibe un turno validado del árbitro y produce la jugada.
 * 1) Calcula presupuesto local (deadline_ms − margen de red/POST).
 * 2) Elige fallback legal INMEDIATO (protección ante excepciones).
 * 3) Invoca engine-service.chooseMove con MoveContext.
 * 4) Verifica decision.column ∈ legal_moves justo antes de entregarla.
 * NO hace HTTP directamente (eso es del referee-client) ni depende de SQLite.
 * Owner: Salva (A03).
 */

/**
 * @param {Object} turn  Turno ya validado por referee-validator (shape 1.0.1).
 * @param {Object} [deps] Inyección para tests: { chooseMove, now, budgetMs }
 * @returns {Promise<{ column: number, decision: import('../engine/types.js').MoveDecision }>}
 */
export async function decideTurn(turn, deps = {}) {
  throw new Error('TODO(A03): implementar decideTurn');
}
