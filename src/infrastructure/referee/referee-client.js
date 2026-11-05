/**
 * Cliente HTTP del árbitro oficial (OpenAPI 1.0.1). SOLO transporte:
 * Bearer token, timeouts de red, clasificación de errores. No decide jugadas.
 * Base URL y token vienen de parámetros (los lee el worker desde env).
 * Owner: Salva (A01).
 */

/** Error clasificado: network | http_400 | http_401 | http_409 | http_423 | http_other | parse. */
export class RefereeError extends Error {
  constructor(kind, message, { status = null, body = null } = {}) {
    super(message);
    this.name = 'RefereeError';
    this.kind = kind;
    this.status = status;
    this.body = body;
  }
}

const KIND_BY_STATUS = { 400: 'http_400', 401: 'http_401', 409: 'http_409', 423: 'http_423' };

/**
 * @typedef {Object} RefereeClient
 * @property {(waitSeconds?: number) => Promise<Object>} getNext  GET /api/next?wait=N
 * @property {(gameId: string, column: number) => Promise<Object>} postMove  POST /api/move
 * @property {(opponent?: string, first?: 1|2) => Promise<Object>} createPractice  POST /api/practice
 * @property {() => Promise<Object>} getMe  GET /api/me
 * @property {(repoUrl: string, commit: string) => Promise<Object>} registerSubmission  PUT /api/me/submission
 * @property {(gameId: string) => Promise<Object>} getGame  GET /api/games/{id} (reconciliar POST dudoso)
 * @property {() => Promise<Object>} getHealth  GET /api/health
 * @property {() => Promise<Object>} getOpenApi  GET /api/openapi.json
 */

/**
 * @param {{ baseUrl: string, token: string, fetchImpl?: typeof fetch, postTimeoutMs?: number }} config
 * @returns {RefereeClient}
 */
export function createRefereeClient({ baseUrl, token, fetchImpl = fetch, postTimeoutMs = 4000 }) {
  if (!baseUrl) throw new Error('Falta ARBITRO_URL.');
  const base = baseUrl.replace(/\/+$/, '');

  async function request(method, path, { body, timeoutMs = 10_000 } = {}) {
    let res;
    try {
      res = await fetchImpl(`${base}${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      throw new RefereeError('network', `Error de red en ${method} ${path}: ${e.message}`);
    }
    let json;
    try {
      json = await res.json();
    } catch {
      throw new RefereeError('parse', `Respuesta no JSON en ${method} ${path} (HTTP ${res.status}).`, { status: res.status });
    }
    if (res.status >= 200 && res.status < 300) return json;
    const kind = KIND_BY_STATUS[res.status] ?? 'http_other';
    throw new RefereeError(kind, `${method} ${path} → HTTP ${res.status} ${json?.error ?? ''}`.trim(), { status: res.status, body: json });
  }

  return {
    // Timeout local mayor que `wait` (p. ej. 27 s para 20 s): el long polling no es un error.
    getNext: (waitSeconds = 20) => request('GET', `/api/next?wait=${waitSeconds}`, { timeoutMs: (waitSeconds + 7) * 1000 }),
    // El POST de jugada NUNCA se repite a ciegas tras timeout (pudo llegar): lo decide el worker.
    postMove: (gameId, column) => request('POST', '/api/move', { body: { game_id: gameId, column }, timeoutMs: postTimeoutMs }),
    createPractice: (opponent = 'casa-basico', first = 1) => request('POST', '/api/practice', { body: { opponent, first } }),
    getMe: () => request('GET', '/api/me'),
    registerSubmission: (repoUrl, commit) => request('PUT', '/api/me/submission', { body: { repo_url: repoUrl, commit } }),
    getGame: (gameId) => request('GET', `/api/games/${encodeURIComponent(gameId)}`),
    getHealth: () => request('GET', '/api/health'),
    getOpenApi: () => request('GET', '/api/openapi.json'),
  };
}
