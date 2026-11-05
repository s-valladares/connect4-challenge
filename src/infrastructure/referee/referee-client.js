/**
 * Cliente HTTP del árbitro oficial (OpenAPI 1.0.1). SOLO transporte:
 * Bearer token, timeouts de red, clasificación de errores. No decide jugadas.
 * Base URL y token vienen de parámetros (los lee el worker desde env).
 * Owner: Salva (A01).
 */

/**
 * @typedef {Object} RefereeClient
 * @property {(waitSeconds?: number) => Promise<Object>} getNext  GET /api/next?wait=N
 * @property {(gameId: string, column: number) => Promise<Object>} postMove  POST /api/move
 * @property {(opponent?: string, first?: 1|2) => Promise<Object>} createPractice  POST /api/practice
 * @property {() => Promise<Object>} getMe  GET /api/me
 * @property {(repoUrl: string, commit: string) => Promise<Object>} registerSubmission  PUT /api/me/submission
 */

/**
 * @param {{ baseUrl: string, token: string, fetchImpl?: typeof fetch }} config
 * @returns {RefereeClient}
 */
export function createRefereeClient(config) {
  // TODO(A01): fetch con AbortSignal.timeout, headers Bearer + JSON,
  // errores clasificados: network | http_401 | http_409 | http_400 | parse.
  // El POST de jugada NUNCA se repite a ciegas tras timeout (pudo llegar).
  throw new Error('TODO(A01): implementar createRefereeClient');
}
