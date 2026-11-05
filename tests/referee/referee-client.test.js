import { describe, it, expect, vi } from 'vitest';
import { createRefereeClient } from '../../src/infrastructure/referee/referee-client.js';

const jsonResponse = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

function makeClient(fetchImpl, overrides = {}) {
  return createRefereeClient({
    baseUrl: 'https://arbitro.test/',
    token: 'tkn-secreto',
    fetchImpl,
    ...overrides,
  });
}

describe('referee-client (A01)', () => {
  it('exige baseUrl y token', () => {
    expect(() => createRefereeClient({ baseUrl: '', token: 'x' })).toThrow();
    expect(() => createRefereeClient({ baseUrl: 'https://a', token: '' })).toThrow();
  });

  it('getNext envía Bearer, wait en la URL y clasifica turn como success', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { status: 'turn', game_id: 'g_1' }));
    const result = await makeClient(fetchImpl).getNext(20);

    expect(result.kind).toBe('success');
    expect(result.data.game_id).toBe('g_1');

    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://arbitro.test/api/next?wait=20'); // sin doble barra
    expect(options.headers.Authorization).toBe('Bearer tkn-secreto');
    expect(options.method).toBe('GET');
  });

  it('getNext con idle también es success (el worker decide qué hacer)', async () => {
    const result = await makeClient(async () => jsonResponse(200, { status: 'idle' })).getNext();
    expect(result.kind).toBe('success');
    expect(result.data.status).toBe('idle');
  });

  it('postMove manda game_id y column en el body y una sola llamada', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { ok: true, state: 'playing' }));
    const result = await makeClient(fetchImpl).postMove('g_7f3a', 4);

    expect(result.kind).toBe('success');
    expect(fetchImpl).toHaveBeenCalledTimes(1); // nunca reintenta solo
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://arbitro.test/api/move');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ game_id: 'g_7f3a', column: 4 });
  });

  it('clasifica 400 como rejected con el error del árbitro', async () => {
    const result = await makeClient(async () =>
      jsonResponse(400, { ok: false, error: 'illegal_move' })
    ).postMove('g_1', 3);
    expect(result.kind).toBe('rejected');
    expect(result.status).toBe(400);
    expect(result.data.error).toBe('illegal_move');
  });

  it('clasifica 401 como auth y 409 como conflict (no penaliza)', async () => {
    const auth = await makeClient(async () => jsonResponse(401, { ok: false, error: 'unauthorized' })).getMe();
    expect(auth.kind).toBe('auth');

    const conflict = await makeClient(async () =>
      jsonResponse(409, { ok: false, error: 'not_your_turn' })
    ).postMove('g_1', 0);
    expect(conflict.kind).toBe('conflict');
  });

  it('clasifica 423 como locked (prácticas/entregas cerradas)', async () => {
    const result = await makeClient(async () =>
      jsonResponse(423, { ok: false, error: 'practice_closed' })
    ).createPractice();
    expect(result.kind).toBe('locked');
  });

  it('clasifica fallo de conexión como network sin lanzar excepción', async () => {
    const result = await makeClient(async () => {
      throw new TypeError('fetch failed');
    }).getNext();
    expect(result.kind).toBe('network');
    expect(result.error).toBeInstanceOf(TypeError);
  });

  it('clasifica timeout local como network_timeout', async () => {
    const neverResolves = (_url, { signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason));
      });
    const result = await makeClient(neverResolves, { postTimeoutMs: 25 }).postMove('g_1', 2);
    expect(result.kind).toBe('network_timeout');
  });

  it('clasifica respuesta no-JSON como parse', async () => {
    const result = await makeClient(async () => new Response('<html>502</html>', { status: 200 })).getMe();
    expect(result.kind).toBe('parse');
  });

  it('registerSubmission usa PUT con repo_url y commit', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { registered_at: 'x' }));
    await makeClient(fetchImpl).registerSubmission('https://github.com/e5/repo', 'abc1234');
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://arbitro.test/api/me/submission');
    expect(options.method).toBe('PUT');
    expect(JSON.parse(options.body)).toEqual({
      repo_url: 'https://github.com/e5/repo',
      commit: 'abc1234',
    });
  });
});
