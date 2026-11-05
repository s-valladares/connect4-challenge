/** Worker (A04/O01/O02, Salva): ciclo, clasificación, reconciliación, lock, logs, métricas, config. */
import { describe, it, expect, vi } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { handleNext, runWorker, classifyMoveError, classifyMoveResponse } from '../../src/worker/run-worker.js';
import { acquireWorkerLock } from '../../src/worker/singleton-lock.js';
import { loadConfig } from '../../src/worker/config.js';
import { RefereeError } from '../../src/infrastructure/referee/referee-client.js';
import { createLogger, configureLogger, log } from '../../src/observability/logger.js';
import { createMetrics } from '../../src/observability/metrics.js';
import { turnFromMoves } from '../fixtures/turns.js';

const turn = { ...turnFromMoves([3, 3]), game_id: 'g1' };
const httpErr = (kind, body) => new RefereeError(kind, kind, { body });

describe('clasificación de POST /api/move', () => {
  it.each([
    [{ state: 'playing' }, 'accepted'], [{ state: 'won' }, 'won'], [{ state: 'draw' }, 'draw'], [null, 'unknown'],
  ])('200 %j → %s', (body, kind) => expect(classifyMoveResponse(body)).toBe(kind));

  it.each([
    ['http_400', { error: 'illegal_move' }, 'lost_illegal'],
    ['http_400', { error: 'timeout' }, 'lost_timeout'],
    ['http_400', { error: 'validation' }, 'validation'],
    ['http_409', {}, 'conflict'],
    ['http_401', {}, 'unauthorized'],
    ['http_423', {}, 'frozen'],
    ['http_other', {}, 'unknown'],
  ])('%s %j → %s', (kind, body, result) => expect(classifyMoveError(httpErr(kind, body))).toBe(result));
});

describe('handleNext', () => {
  it('idle y turno inválido (sin POST)', async () => {
    const client = { postMove: vi.fn() };
    expect(await handleNext({ status: 'idle' }, { client })).toEqual({ kind: 'idle' });
    expect((await handleNext({ ...turn, legal_moves: [] }, { client })).kind).toBe('skipped');
    expect(client.postMove).not.toHaveBeenCalled();
  });

  it('turno → UN POST con columna legal; métricas registradas', async () => {
    const client = { postMove: vi.fn(async () => ({ ok: true, state: 'playing', turn: 4 })) };
    const metrics = createMetrics();
    const ev = await handleNext(turn, { client, budgetMs: 50, metrics });
    expect(ev).toMatchObject({ kind: 'moved', result: 'accepted', gameId: 'g1', turn: 3 });
    expect(client.postMove).toHaveBeenCalledTimes(1);
    expect(turn.legal_moves).toContain(client.postMove.mock.calls[0][1]);
    expect(metrics.snapshot()).toMatchObject({ turns: 1, results: { accepted: 1 } });
  });

  it('turno inconsistente: igual juega legal y deja log', async () => {
    const warn = vi.fn();
    const client = { postMove: vi.fn(async () => ({ state: 'playing' })) };
    const bad = { ...turnFromMoves([0, 0, 0, 0, 0, 0, 0]), legal_moves: [0, 5] };
    const ev = await handleNext(bad, { client, budgetMs: 50, log: { info() {}, warn, error() {} } });
    expect(ev.column).toBe(5);
    expect(warn).toHaveBeenCalledWith('turn_inconsistent', expect.any(Object));
  });

  it('POST sin respuesta (network) → reconcilia con /api/games/{id}', async () => {
    let posted;
    const client = {
      postMove: async (_g, column) => { posted = column; throw new RefereeError('network', 'socket hang up'); },
      getGame: async () => ({ moves: [{ turn: 3, column: posted }] }),
    };
    expect((await handleNext(turn, { client, budgetMs: 30 })).result).toBe('accepted_reconciled');
    const down = { ...client, getGame: async () => { throw new Error('caído'); } };
    expect((await handleNext(turn, { client: down, budgetMs: 30 })).result).toBe('unknown');
  });

  it('400 illegal → lost_illegal (log error); 401 se propaga; error de programación se propaga', async () => {
    const error = vi.fn();
    const lost = { postMove: async () => { throw httpErr('http_400', { error: 'illegal_move' }); } };
    expect((await handleNext(turn, { client: lost, budgetMs: 30, log: { info() {}, warn() {}, error } })).result).toBe('lost_illegal');
    expect(error).toHaveBeenCalled();
    await expect(handleNext(turn, { client: { postMove: async () => { throw httpErr('http_401'); } }, budgetMs: 30 })).rejects.toMatchObject({ kind: 'http_401' });
    await expect(handleNext(turn, { client: { postMove: async () => { throw new TypeError('bug'); } }, budgetMs: 30 })).rejects.toThrow('bug');
  });
});

describe('runWorker', () => {
  it('reintenta con backoff tras error de red y se detiene con la señal', async () => {
    const seq = [new RefereeError('network', 'ECONNRESET'), { status: 'idle' }];
    const client = { getNext: async () => { const r = seq.shift(); if (r instanceof Error) throw r; return r; } };
    const metrics = createMetrics();
    const events = await runWorker({ client, metrics, maxEvents: 2, backoffMs: 1, random: () => 0 });
    expect(events.map((e) => e.kind)).toEqual(['error', 'idle']);
    expect(metrics.snapshot()).toMatchObject({ errors: { network: 1 }, idle: 1 });
    const ctrl = new AbortController();
    ctrl.abort();
    expect(await runWorker({ client, signal: ctrl.signal })).toEqual([]);
  });

  it('401 en GET detiene el worker; errores sin kind se tratan como inesperados', async () => {
    await expect(runWorker({ client: { getNext: async () => { throw httpErr('http_401'); } } })).rejects.toMatchObject({ kind: 'http_401' });
    const odd = [new Error('raro'), { status: 'idle' }];
    const client = { getNext: async () => { const r = odd.shift(); if (r instanceof Error) throw r; return r; } };
    const events = await runWorker({ client, maxEvents: 2, backoffMs: 1, random: () => 0 });
    expect(events[0]).toMatchObject({ kind: 'error', errorKind: 'unexpected' });
  });
});

describe('lock, logger, métricas y config', () => {
  it('una sola instancia por token; lock abandonado se recupera', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lock-'));
    const a = acquireWorkerLock('tok', { dir });
    expect(() => acquireWorkerLock('tok', { dir, pid: process.pid + 1 })).toThrow(/Ya hay un bot/);
    a.release();
    writeFileSync(a.file, '999999');
    const b = acquireWorkerLock('tok', { dir });
    b.release();
    b.release();
  });

  it('el logger nunca imprime el token y respeta el nivel mínimo', () => {
    const out = [];
    const l = createLogger({ secrets: ['SECRETO'], sink: (x) => out.push(x), minLevel: 'info' });
    l.debug('oculto');
    l.info('token SECRETO', { auth: 'Bearer SECRETO' });
    l.warn('w');
    l.error('e');
    expect(out).toHaveLength(3);
    expect(out.join()).not.toContain('SECRETO');
    const sink = [];
    configureLogger({ secrets: ['XYZ'], sink: (x) => sink.push(x) });
    log('info', 'evento', { t: 'XYZ' });
    expect(JSON.parse(sink[0])).toMatchObject({ level: 'info', event: 'evento', t: '***' });
    configureLogger();
  });

  it('métricas: uptime y tiempo desde el último GET', () => {
    let t = 0;
    const m = createMetrics({ now: () => t });
    expect(m.snapshot().sinceLastPollMs).toBeNull();
    m.recordPoll('turn');
    m.recordMove({ result: 'won', decisionMs: 900, totalMs: 1100, fallback: true });
    t = 2000;
    expect(m.snapshot()).toMatchObject({ uptimeSec: 2, sinceLastPollMs: 2000, maxDecisionMs: 900, fallbacks: 1 });
  });

  it('config: defaults del plan y SEARCH_BUDGET_MS de .env', () => {
    expect(loadConfig({})).toMatchObject({ arbitroUrl: '', teamToken: '', budgetMs: 1500, waitSec: 20, strategy: 'search' });
    expect(loadConfig({ SEARCH_BUDGET_MS: '1200' }).budgetMs).toBe(1200);
  });
});
