/**
 * Cliente HTTP del árbitro oficial (OpenAPI 1.0.1). SOLO transporte:
 * Bearer token, timeouts de red, clasificación de errores. No decide jugadas.
 * Owner: Salva (A01).
 *
 * Toda llamada retorna un resultado clasificado (nunca lanza por red/HTTP):
 *   { kind, status, data, error }
 *   kind: 'success'         2xx con JSON válido
 *       | 'rejected'        400 (data.error: illegal_move | timeout | validation)
 *       | 'auth'            401 token inválido → alerta, no reintentar a ciegas
 *       | 'conflict'        409 not_your_turn/unknown_game → NO penaliza
 *       | 'locked'          423 practice/submission cerradas
 *       | 'http_error'      otros status
 *       | 'network'         fallo de conexión (DNS, reset, offline)
 *       | 'network_timeout' se agotó el timeout local del request
 *       | 'parse'           respuesta no-JSON
 *
 * IMPORTANTE: un postMove con kind network/network_timeout NO se reintenta:
 * el árbitro pudo haberlo procesado. Reconciliar vía getNext/getMe.
 */

const DEFAULT_WAIT_SECONDS = 20;

/**
 * @param {{
 *   baseUrl: string,
 *   token: string,
 *   fetchImpl?: typeof fetch,     // inyectable para tests/mock
 *   postTimeoutMs?: number,       // timeout local de POST/PUT/GET cortos
 *   extraWaitMs?: number,         // margen sobre `wait` del long polling
 * }} config
 */
export function createRefereeClient({
  baseUrl,
  token,
  fetchImpl = fetch,
  postTimeoutMs = 10_000,
  extraWaitMs = 10_000,
}) {
  if (!baseUrl || !token) {
    throw new Error('createRefereeClient: baseUrl y token son requeridos');
  }
  const base = baseUrl.replace(/\/+$/, '');
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  async function request(method, path, { body, timeoutMs } = {}) {
    let res;
    try {
      res = await fetchImpl(`${base}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs ?? postTimeoutMs),
      });
    } catch (error) {
      const isTimeout = error?.name === 'TimeoutError' || error?.name === 'AbortError';
      return { kind: isTimeout ? 'network_timeout' : 'network', status: null, data: null, error };
    }

    let data = null;
    try {
      data = await res.json();
    } catch (error) {
      return { kind: 'parse', status: res.status, data: null, error };
    }

    if (res.ok) return { kind: 'success', status: res.status, data, error: null };
    if (res.status === 401) return { kind: 'auth', status: 401, data, error: null };
    if (res.status === 409) return { kind: 'conflict', status: 409, data, error: null };
    if (res.status === 400) return { kind: 'rejected', status: 400, data, error: null };
    if (res.status === 423) return { kind: 'locked', status: 423, data, error: null };
    return { kind: 'http_error', status: res.status, data, error: null };
  }

  return {
    /** Long polling: GET /api/next?wait=N (máx 25). Timeout local = wait + margen. */
    getNext(waitSeconds = DEFAULT_WAIT_SECONDS) {
      return request('GET', `/api/next?wait=${waitSeconds}`, {
        timeoutMs: waitSeconds * 1000 + extraWaitMs,
      });
    },

    /** POST /api/move. UNA sola vez por turno; nunca reintentar a ciegas. */
    postMove(gameId, column) {
      return request('POST', '/api/move', { body: { game_id: gameId, column } });
    },

    /** POST /api/practice contra casa-aleatorio|casa-basico. */
    createPractice(opponent = 'casa-basico', first = 1) {
      return request('POST', '/api/practice', { body: { opponent, first } });
    },

    /** GET /api/me: valida token, fase y turnos pendientes. */
    getMe() {
      return request('GET', '/api/me');
    },

    /** PUT /api/me/submission: registra repo + hash (hasta 09:45). */
    registerSubmission(repoUrl, commit) {
      return request('PUT', '/api/me/submission', {
        body: { repo_url: repoUrl, commit },
      });
    },
  };
}
