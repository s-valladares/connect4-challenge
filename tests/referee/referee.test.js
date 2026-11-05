/** Cliente y validador del árbitro (A01/A02, Salva). Sin red: fetch inyectado. */
import { describe, it, expect } from 'vitest';
import { createRefereeClient, RefereeError } from '../../src/infrastructure/referee/referee-client.js';
import { validateTurn } from '../../src/infrastructure/referee/referee-validator.js';
import { turnFromMoves, INCONSISTENT_EXAMPLE } from '../fixtures/turns.js';

const reply = (status, body) => async () => ({ status, json: async () => body });

describe('createRefereeClient', () => {
  it('manda Bearer + JSON y construye cada ruta del OpenAPI 1.0.1', async () => {
    const calls = [];
    const fetchImpl = async (url, init) => { calls.push({ url, init }); return { status: 200, json: async () => ({ ok: true }) }; };
    const c = createRefereeClient({ baseUrl: 'http://x/', token: 'abc', fetchImpl });
    await c.getNext(20);
    await c.postMove('g', 2);
    await c.createPractice();
    await c.registerSubmission('r', 'c');
    await c.getMe();
    await c.getGame('g 1');
    await c.getOpenApi();
    await c.getHealth();
    expect(calls.map((x) => x.url)).toEqual([
      'http://x/api/next?wait=20', 'http://x/api/move', 'http://x/api/practice', 'http://x/api/me/submission',
      'http://x/api/me', 'http://x/api/games/g%201', 'http://x/api/openapi.json', 'http://x/api/health',
    ]);
    expect(calls[0].init.headers.Authorization).toBe('Bearer abc');
    expect(JSON.parse(calls[1].init.body)).toEqual({ game_id: 'g', column: 2 });
    expect(JSON.parse(calls[2].init.body)).toEqual({ opponent: 'casa-basico', first: 1 });
    expect(JSON.parse(calls[3].init.body)).toEqual({ repo_url: 'r', commit: 'c' });
  });

  it('clasifica errores: network, parse, 400, 401, 409, 423 y otros', async () => {
    const mk = (fetchImpl) => createRefereeClient({ baseUrl: 'http://x', token: 't', fetchImpl });
    await expect(mk(async () => { throw new Error('ECONNREFUSED'); }).getHealth()).rejects.toMatchObject({ kind: 'network' });
    await expect(mk(async () => ({ status: 502, json: async () => { throw new Error(); } })).getHealth()).rejects.toMatchObject({ kind: 'parse', status: 502 });
    await expect(mk(reply(400, { error: 'illegal_move' })).postMove('g', 9)).rejects.toMatchObject({ kind: 'http_400', body: { error: 'illegal_move' } });
    await expect(mk(reply(401, { error: 'unauthorized' })).getMe()).rejects.toBeInstanceOf(RefereeError);
    await expect(mk(reply(409, { error: 'not_your_turn' })).postMove('g', 1)).rejects.toMatchObject({ kind: 'http_409' });
    await expect(mk(reply(423, { error: 'practice_closed' })).createPractice()).rejects.toMatchObject({ kind: 'http_423' });
    await expect(mk(reply(500, {})).getHealth()).rejects.toMatchObject({ kind: 'http_other' });
    expect(() => createRefereeClient({ token: 't' })).toThrow(/ARBITRO_URL/);
  });
});

describe('validateTurn', () => {
  it('acepta un turno coherente sin issues', () => {
    const v = validateTurn(turnFromMoves([3, 4, 3]));
    expect(v).toMatchObject({ ok: true, issues: [] });
    expect(v.safeMoves).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('fatal: no es turno, faltan campos, you inválido, legal_moves vacío o fuera de rango', () => {
    expect(validateTurn({ status: 'idle' }).ok).toBe(false);
    expect(validateTurn({ status: 'turn' }).reason).toMatch(/Faltan campos/);
    expect(validateTurn({ ...turnFromMoves([]), you: 3 }).ok).toBe(false);
    expect(validateTurn({ ...turnFromMoves([]), legal_moves: [] }).reason).toMatch(/vacío/);
    expect(validateTurn({ ...turnFromMoves([]), legal_moves: [9, -1] }).ok).toBe(false);
  });

  it('el ejemplo del PDF se detecta como inconsistente (no se usa como fixture válida)', () => {
    const v = validateTurn(INCONSISTENT_EXAMPLE);
    expect(v.ok).toBe(true);
    expect(v.issues.join(' ')).toMatch(/no coincide con moves|le toca/);
  });

  it('juega solo columnas libres: legal_moves con columna llena se filtra', () => {
    const full = { ...turnFromMoves([0, 0, 0, 0, 0, 0, 0]), legal_moves: [0, 5, 12] };
    const v = validateTurn(full);
    expect(v.safeMoves).toEqual([5]);
    expect(v.issues.join(' ')).toMatch(/llenas/);
    expect(v.issues.join(' ')).toMatch(/fuera de 0..7/);
  });

  it('tablero imposible (ficha flotando) o moves inválidos: reporta, no inventa', () => {
    const floating = turnFromMoves([]);
    floating.board = floating.board.map((r) => [...r]);
    floating.board[3][3] = 1;
    expect(validateTurn(floating).issues.join()).toMatch(/flotando/);
    expect(validateTurn({ ...turnFromMoves([3]), moves: [9] }).issues.join()).toMatch(/moves/);
  });
});
