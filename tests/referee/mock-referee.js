/**
 * MockReferee (Q03, Alex): emula el árbitro OpenAPI 1.0.1 SIN red real.
 * Versión EN MEMORIA con la misma interfaz que referee-client (inyección de
 * dependencias): ideal para escenarios exactos en pruebas del worker.
 * Para E2E por HTTP (Q05) ver mock-referee-server.js.
 *
 * `script`: respuestas de GET /api/next en orden (objeto, función que devuelve
 * el objeto, o Error que se lanza). Al agotarse responde { status: 'idle' }.
 * `moveResponses`: igual, para POST /api/move (por defecto 200 playing).
 * Las fixtures provienen de tests/fixtures (coherentes, ver su README).
 */
import { RefereeError } from '../../src/infrastructure/referee/referee-client.js';

export function createMockReferee(script = [], { moveResponses = [], games = {}, phase = 'practice' } = {}) {
  const nextQueue = [...script];
  const moveQueue = [...moveResponses];
  const posts = [];
  const take = (queue, fallback) => {
    const step = queue.length ? queue.shift() : fallback;
    if (step instanceof Error) throw step;
    return typeof step === 'function' ? step() : step;
  };
  return {
    posts,
    remaining: () => nextQueue.length,
    getNext: async () => take(nextQueue, { status: 'idle' }),
    postMove: async (gameId, column) => {
      posts.push({ gameId, column });
      return take(moveQueue, { ok: true, state: 'playing', turn: 0 });
    },
    getGame: async (gameId) => {
      if (!games[gameId]) throw new RefereeError('http_other', 'not_found', { status: 404, body: { error: 'not_found' } });
      return games[gameId];
    },
    getMe: async () => ({ team: { id: 'equipo-5', name: 'Equipo 5' }, phase, pending_turns: [], submission: null }),
    createPractice: async (opponent = 'casa-basico', first = 1) => ({ game_id: 'g_p_01', you: first, opponent }),
    registerSubmission: async (repoUrl, commit) => ({ repo_url: repoUrl, commit }),
    getHealth: async () => ({ ok: true, phase }),
    getOpenApi: async () => ({ info: { version: '1.1.0' } }),
  };
}
