/**
 * CONTRATO CONGELADO v1 (G0) — interfaz de toda estrategia del engine.
 * Cambios requieren acuerdo entre Salva, Jorge y Juan (ver AGENTS.md).
 *
 * Invariantes:
 * - chooseMove NO hace HTTP/SQL, NO muta el tablero y SIEMPRE retorna columna legal.
 * - El presupuesto es LOCAL (timeBudgetMs); el orquestador ya descontó margen de red.
 * - Si legalMoves está vacío, el llamador no debe invocar chooseMove.
 */

/**
 * @typedef {Object} MoveContext
 * @property {import('../domain/connect4/types.js').Board} board
 * @property {import('../domain/connect4/types.js').Player} player  Quiénes somos en este turno.
 * @property {number[]} legalMoves  Columnas no llenas (0..7), nunca vacío.
 * @property {number} timeBudgetMs  Presupuesto LOCAL de búsqueda en ms.
 * @property {string} [gameId]      Metadato para logs; las reglas no lo usan.
 * @property {Object} [hints]       Información opcional de búsquedas previas (pondering/TT).
 */

/**
 * @typedef {Object} MoveDecision
 * @property {number} column         Columna elegida; DEBE pertenecer a legalMoves.
 * @property {string} strategy       Nombre de la estrategia que decidió.
 * @property {number} depthCompleted Última profundidad completada (0 si no aplica).
 * @property {number} elapsedMs      Tiempo real de cálculo.
 * @property {number} nodesVisited   Nodos explorados (0 si no aplica).
 * @property {boolean} fallbackUsed  true si se usó el fallback legal.
 * @property {number|null} score     Evaluación de la posición elegida (null si no aplica).
 */

/**
 * Interfaz conceptual (duck typing):
 * @typedef {Object} MoveStrategy
 * @property {string} name
 * @property {(context: MoveContext) => MoveDecision} chooseMove
 */

export {};
