/** API HTTP (B01/B02/B05, Juan): contrato docs/API_LOCAL.md sobre Express real en puerto efímero. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../../src/infrastructure/persistence/sqlite.js';
import { createGameRepository } from '../../src/infrastructure/persistence/game-repository.js';
import { createLocalGameService } from '../../src/application/local-game-service.js';
import { createApp } from '../../src/infrastructure/http/app.js';
import { configureLogger } from '../../src/observability/logger.js';

async function start(db = openDatabase(':memory:'), extra = {}) {
  const svc = createLocalGameService({ gameRepository: createGameRepository(db), botBudgetMs: 20, ...extra });
  const server = createApp({ localGameService: svc }).listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, body, raw) => {
    const res = await fetch(`${base}${path}`, {
      method, headers: { 'Content-Type': 'application/json' }, body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
    });
    return { status: res.status, body: await res.json() };
  };
  return { svc, call, close: () => new Promise((r) => server.close(r)) };
}

describe('contrato API_LOCAL', () => {
  let api;
  beforeAll(async () => { api = await start(); });
  afterAll(() => api.close());

  it('GET /api/health', async () => {
    expect(await api.call('GET', '/api/health')).toEqual({ status: 200, body: { ok: true } });
  });

  it('POST /api/local-games → 201 con gameId, state y botMove', async () => {
    const r = await api.call('POST', '/api/local-games', { first: 'human' });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ ok: true, gameId: expect.stringMatching(/^lg_/), botMove: null });
    expect(Object.keys(r.body.state).sort()).toEqual(['board', 'currentPlayer', 'legalMoves', 'moves', 'status', 'winner', 'winningCells', 'youAre']);
  });

  it('POST moves → playerMove + botMove + state; GET recupera tras refresh', async () => {
    const { body: g } = await api.call('POST', '/api/local-games', { first: 'human' });
    const r = await api.call('POST', `/api/local-games/${g.gameId}/moves`, { column: 3, turn: 1 });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, playerMove: { column: 3 }, botMove: { column: expect.any(Number) } });
    const again = await api.call('GET', `/api/local-games/${g.gameId}`);
    expect(again.body.state.moves).toEqual(r.body.state.moves);
  });

  it('errores uniformes { ok:false, error, message }', async () => {
    const { body: g } = await api.call('POST', '/api/local-games', { first: 'human' });
    const moves = `/api/local-games/${g.gameId}/moves`;
    expect(await api.call('POST', moves, { column: 9 })).toMatchObject({ status: 400, body: { ok: false, error: 'illegal_move' } });
    expect(await api.call('POST', moves, { column: 'x' })).toMatchObject({ status: 422, body: { error: 'validation' } });
    expect(await api.call('POST', '/api/local-games', { first: 3 })).toMatchObject({ status: 422, body: { error: 'validation' } });
    expect(await api.call('POST', moves, undefined, '{roto')).toMatchObject({ status: 422, body: { error: 'validation' } });
    expect(await api.call('GET', '/api/local-games/nope')).toMatchObject({ status: 404, body: { error: 'not_found' } });
    expect(await api.call('GET', '/api/otra')).toMatchObject({ status: 404, body: { error: 'not_found' } });
    await api.call('POST', moves, { column: 2, turn: 1 });
    expect(await api.call('POST', moves, { column: 2, turn: 1 })).toMatchObject({ status: 409, body: { error: 'not_your_turn' } });
  });
});

describe('robustez', () => {
  it('la partida sobrevive al reinicio de la API (archivo SQLite)', async () => {
    const path = join(mkdtempSync(join(tmpdir(), 'c4-')), 'local.db');
    const a = await start(openDatabase(path));
    const { body: g } = await a.call('POST', '/api/local-games', { first: 'human' });
    await a.call('POST', `/api/local-games/${g.gameId}/moves`, { column: 3 });
    await a.close();
    const b = await start(openDatabase(path));
    expect((await b.call('GET', `/api/local-games/${g.gameId}`)).body.state.moves).toHaveLength(2);
    await b.close();
  });

  it('error inesperado → 500 sin stack trace (y queda en el log)', async () => {
    const lines = [];
    configureLogger({ sink: (l) => lines.push(l) });
    const db = openDatabase(':memory:');
    const api = await start(db);
    db.close(); // fuerza un error de infraestructura
    const r = await api.call('GET', '/api/local-games/lg_x');
    expect(r).toEqual({ status: 500, body: { ok: false, error: 'internal', message: 'Error inesperado.' } });
    expect(lines.join()).toMatch(/api_unexpected_error/);
    configureLogger();
    await api.close();
  });

  it('RuleError del dominio (si se escapara) se traduce a 400/409', async () => {
    const { RuleError } = await import('../../src/domain/connect4/errors.js');
    const { errorHandler } = await import('../../src/infrastructure/http/error-handler.js');
    const res = { status(s) { this.s = s; return this; }, json(b) { this.b = b; return this; } };
    errorHandler(new RuleError('illegal_move', 'llena'), {}, res, () => {});
    expect([res.s, res.b.error]).toEqual([400, 'illegal_move']);
    errorHandler(new RuleError('game_over', 'fin'), {}, res, () => {});
    expect([res.s, res.b.error]).toEqual([409, 'not_your_turn']);
  });
});
