/**
 * Único punto de acceso del frontend a la API local (contrato: docs/API_LOCAL.md).
 * Los componentes NO usan fetch directamente; consumen estas funciones.
 * Owner: América (F02), contrato congelado con Juan (B01).
 */

/** @param {{ first: 'human'|'bot' }} opts */
export async function createGame(opts) {
  throw new Error('TODO(F02): POST /api/local-games');
}

/** @param {string} gameId */
export async function getGame(gameId) {
  throw new Error('TODO(F02): GET /api/local-games/:id (recuperación tras refresh)');
}

/** @param {string} gameId @param {number} column */
export async function playMove(gameId, column) {
  throw new Error('TODO(F02): POST /api/local-games/:id/moves');
}
