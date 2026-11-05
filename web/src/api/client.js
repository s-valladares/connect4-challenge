/**
 * Único punto de acceso del frontend a la API local (contrato: docs/API_LOCAL.md).
 * Los componentes NO usan fetch directamente; consumen estas funciones.
 * Owner: América (F02), contrato congelado con Juan (B01).
 */

/** Error normalizado: code = código de la API (illegal_move, not_your_turn…) o 'network'. */
export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

/** @param {{ baseUrl?: string, fetchImpl?: typeof fetch, timeoutMs?: number }} [options] */
export function createApiClient({ baseUrl = '/api', fetchImpl = (...a) => fetch(...a), timeoutMs = 15_000 } = {}) {
  async function request(path, { method = 'GET', body } = {}) {
    let res;
    try {
      res = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new ApiError(0, 'network', 'No hay conexión con la API.');
    }
    const data = await res.json().catch(() => null);
    if (!res.ok || data?.ok === false) {
      throw new ApiError(res.status, data?.error ?? 'internal', data?.message ?? 'Error inesperado.');
    }
    return data;
  }

  return {
    /** @param {{ first: 'human'|'bot' }} opts */
    createGame: ({ first }) => request('/local-games', { method: 'POST', body: { first } }),
    /** @param {string} gameId */
    getGame: (gameId) => request(`/local-games/${encodeURIComponent(gameId)}`),
    /** @param {string} gameId @param {number} column @param {{ turn?: number }} [opts] */
    playMove: (gameId, column, { turn } = {}) => request(`/local-games/${encodeURIComponent(gameId)}/moves`, { method: 'POST', body: { column, turn } }),
    checkHealth: () => request('/health'),
  };
}

const defaultClient = createApiClient();

export const { createGame, getGame, playMove, checkHealth } = defaultClient;
export default defaultClient;
