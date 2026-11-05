/** Mock del árbitro (Q03/Q05, Alex): contrato OpenAPI 1.0.1, reglas de tiempo y escenarios en memoria. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createRefereeMockServer } from './mock-referee-server.js';
import { createMockReferee } from './mock-referee.js';
import { houseMove, immediateWins } from './house-bots.js';
import { replayMoves } from '../../src/domain/connect4/game-state.js';
import { RefereeError } from '../../src/infrastructure/referee/referee-client.js';
import { runWorker } from '../../src/worker/run-worker.js';
import { turnFromMoves } from '../fixtures/turns.js';

const TOKEN = 't-test';
const H = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
const call = (url, path, method = 'GET', body) => fetch(`${url}${path}`, { method, headers: H, body: body && JSON.stringify(body) })
  .then(async (r) => ({ status: r.status, body: await r.json() }));

describe('bots de la casa', () => {
  it('casa-basico gana o bloquea; casa-aleatorio juega legal', () => {
    expect([2, 6]).toContain(houseMove('casa-basico', replayMoves([3, 3, 4, 4, 5, 5]), () => 0));
    expect([2, 6]).toContain(houseMove('casa-basico', replayMoves([3, 0, 4, 0, 5]), () => 0));
    expect(houseMove('casa-aleatorio', replayMoves([0, 0, 0, 0, 0, 0, 0]), () => 0)).not.toBe(0);
    expect(immediateWins(replayMoves([3, 3, 4, 4, 5]), 1)).toEqual([2, 6]);
  });
});

describe('createMockReferee (en memoria, mismo contrato que referee-client)', () => {
  it('guion: turno → POST → idle; registra los POST', async () => {
    const mock = createMockReferee([turnFromMoves([3, 3, 4, 4, 5, 5])], { moveResponses: [{ ok: true, state: 'won', turn: 7 }] });
    const events = await runWorker({ client: mock, maxEvents: 2, budgetMs: 50 });
    expect(events.map((e) => e.kind)).toEqual(['moved', 'idle']);
    expect(events[0].result).toBe('won');
    expect([2, 6]).toContain(mock.posts[0].column);
    expect(mock.remaining()).toBe(0);
  });

  it('escenarios de fallo: 409, 400 timeout, red caída en POST con y sin reconciliación', async () => {
    const t = { ...turnFromMoves([3]), game_id: 'g9' };
    const conflict = new RefereeError('http_409', 'x', { body: { error: 'not_your_turn' } });
    const late = new RefereeError('http_400', 'x', { body: { error: 'timeout' } });
    const cut = new RefereeError('network', 'socket hang up');
    const mock = createMockReferee([t, t, t, t], {
      moveResponses: [conflict, late, cut, cut],
      games: { g9: { moves: [{ turn: 2, column: 3 }] } },
    });
    const events = await runWorker({ client: mock, maxEvents: 4, budgetMs: 30 });
    expect(events.map((e) => e.result)).toEqual(['conflict', 'lost_timeout', expect.stringMatching(/accepted_reconciled|unknown/), expect.stringMatching(/accepted_reconciled|unknown/)]);
    expect(await mock.getMe()).toMatchObject({ team: { name: 'Equipo 5' } });
    expect(await mock.createPractice()).toMatchObject({ you: 1 });
    expect(await mock.registerSubmission('r', 'c')).toEqual({ repo_url: 'r', commit: 'c' });
    expect((await mock.getOpenApi()).info.version).toBe('1.1.0');
    expect((await mock.getHealth()).ok).toBe(true);
    await expect(mock.getGame('nada')).rejects.toMatchObject({ status: 404 });
  });

  it('errores de red en GET y luego un turno por función', async () => {
    const mock = createMockReferee([new RefereeError('network', 'caído'), () => ({ status: 'idle' })]);
    const events = await runWorker({ client: mock, maxEvents: 2, backoffMs: 1, random: () => 0 });
    expect(events.map((e) => e.kind)).toEqual(['error', 'idle']);
  });
});

describe('createRefereeMockServer: contrato HTTP', () => {
  let mock;
  let url;
  beforeAll(async () => {
    mock = createRefereeMockServer({ token: TOKEN });
    url = await mock.listen(0);
  });
  afterAll(() => mock.close());

  it('401 sin token; 400 con wait inválido o JSON roto', async () => {
    expect((await fetch(`${url}/api/next?wait=0`)).status).toBe(401);
    expect((await call(url, '/api/next?wait=30')).status).toBe(400);
    expect((await fetch(`${url}/api/move`, { method: 'POST', headers: H, body: '{x' })).status).toBe(400);
  });

  it('idle al vencer wait y Turn válido tras crear práctica; ilegal = derrota', async () => {
    expect((await call(url, '/api/next?wait=0')).body).toEqual({ status: 'idle' });
    const p = await call(url, '/api/practice', 'POST', { opponent: 'casa-aleatorio', first: 2 });
    expect(p).toMatchObject({ status: 201, body: { you: 2 } });
    const t = (await call(url, '/api/next?wait=0')).body;
    expect(t.board).toHaveLength(7);
    expect(t.moves).toHaveLength(1);
    expect(t).toMatchObject({ status: 'turn', you: 2, turn: 2, deadline_ms: 3000, kind: 'practice', match_id: null });
    expect((await call(url, '/api/move', 'POST', { game_id: t.game_id, column: 11 })).body.error).toBe('illegal_move');
    expect((await call(url, `/api/games/${t.game_id}`)).body.result).toMatchObject({ reason: 'illegal_move', forfeited_by: 2 });
  });

  it('409 sin turno pendiente, 400 práctica inválida, entrega validada', async () => {
    expect((await call(url, '/api/move', 'POST', { game_id: 'nada', column: 3 })).status).toBe(409);
    expect((await call(url, '/api/practice', 'POST', { opponent: 'x' })).status).toBe(400);
    expect((await call(url, '/api/me/submission', 'PUT', { repo_url: 'https://gitlab.com/a/b', commit: 'abcdef1' })).status).toBe(400);
    const ok = await call(url, '/api/me/submission', 'PUT', { repo_url: 'https://github.com/s-valladares/connect4-challenge', commit: 'abcdef1' });
    expect(ok.body).toMatchObject({ commit: 'abcdef1' });
    expect((await call(url, '/api/me')).body.submission.commit).toBe('abcdef1');
  });

  it('endpoints públicos: GET /api/games SIN board, la partida individual CON board', async () => {
    expect((await call(url, '/api/health')).body.ok).toBe(true);
    expect((await call(url, '/api/standings')).body.standings).toEqual([]);
    expect((await call(url, '/api/openapi.json')).body.info.version).toBe('1.1.0');
    const list = await call(url, '/api/games');
    expect(Array.isArray(list.body)).toBe(true); // OpenAPI: arreglo plano de GameSummary
    expect(list.body[0]).not.toHaveProperty('board');
    expect((await call(url, `/api/games/${list.body[0].game_id}`)).body).toHaveProperty('board');
    expect(Object.values(list.body[0].players)[0]).toHaveProperty('team_id');
    expect((await call(url, '/api/games/zzz')).status).toBe(404);
    expect((await call(url, '/api/state')).body).toHaveProperty('live');
    expect((await call(url, '/api/otra')).status).toBe(404);
  });
});

describe('reglas de tiempo y fase', () => {
  it('timeout (>3.000 ms desde served_at) y ausencia (>30 s sin recoger)', async () => {
    let clock = 1_000_000;
    const mock = createRefereeMockServer({ token: TOKEN, now: () => clock });
    const url = await mock.listen(0);
    const p1 = (await call(url, '/api/practice', 'POST', { first: 1 })).body;
    await call(url, '/api/next?wait=0');
    clock += 3001;
    expect((await call(url, '/api/move', 'POST', { game_id: p1.game_id, column: 3 })).body.error).toBe('timeout');
    const p2 = (await call(url, '/api/practice', 'POST', { first: 1 })).body;
    clock += 30_001;
    expect((await call(url, '/api/me')).body.pending_turns).toEqual([]);
    expect((await call(url, `/api/games/${p2.game_id}`)).body.result.reason).toBe('absent');
    await mock.close();
  });

  it('fase congelada: prácticas y entregas 423', async () => {
    const mock = createRefereeMockServer({ token: TOKEN, phase: 'frozen' });
    const url = await mock.listen(0);
    expect((await call(url, '/api/practice', 'POST', {})).status).toBe(423);
    expect((await call(url, '/api/me/submission', 'PUT', { repo_url: 'https://github.com/a/b', commit: 'abcdef1' })).status).toBe(423);
    await mock.close();
  });
});
