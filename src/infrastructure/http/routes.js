/**
 * Rutas de la API local (contrato en docs/API_LOCAL.md):
 *   POST /api/local-games            crear partida { first: 'human'|'bot' }
 *   GET  /api/local-games/:id        estado + moves (recuperación tras refresh)
 *   POST /api/local-games/:id/moves  jugada humana → respuesta con jugada del bot
 *   GET  /api/health                 { ok: true }
 * Owner: Juan (B01/B02). Congelar contrato con América antes de implementar.
 */

/**
 * @param {Object} deps { localGameService }
 * @returns {import('express').Router}
 */
export function createRoutes(deps) {
  throw new Error('TODO(B01/B02): implementar createRoutes');
}
