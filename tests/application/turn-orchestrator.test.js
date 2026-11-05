/** TurnOrchestrator (A03, Salva): presupuesto, fallback y legalidad antes de entregar. */
import { describe, it, expect } from 'vitest';
import { computeBudget, decideTurn } from '../../src/application/turn-orchestrator.js';
import { turnFromMoves } from '../fixtures/turns.js';

describe('computeBudget', () => {
  it('tope = SEARCH_BUDGET_MS, reserva 1.000 ms y descuenta lo ya usado', () => {
    expect(computeBudget({ deadline_ms: 3000 }, 0, { now: () => 0 })).toBe(1500);
    expect(computeBudget({ deadline_ms: 3000 }, 0, { now: () => 1500 })).toBe(500);
    expect(computeBudget({}, 0, { now: () => 5000 })).toBe(50);
    expect(computeBudget({ deadline_ms: 3000 }, 0, { budgetMs: 1700, now: () => 0 })).toBe(1700);
  });
});

describe('decideTurn', () => {
  it('usa el engine real y devuelve columna legal con su decisión', async () => {
    const { column, decision } = await decideTurn(turnFromMoves([3, 3, 4, 4, 5, 5]), { budgetMs: 100 });
    expect([2, 6]).toContain(column);
    expect(decision.strategy).toBe('search');
  });

  it('respeta legalMoves seguros de validateTurn', async () => {
    const t = turnFromMoves([]);
    const { column } = await decideTurn(t, { legalMoves: [0, 7], budgetMs: 50 });
    expect([0, 7]).toContain(column);
  });

  it('si el engine lanza: fallback legal inmediato', async () => {
    const r = await decideTurn(turnFromMoves([]), { chooseMove: () => { throw new Error('x'); } });
    expect(r).toMatchObject({ column: 3, decision: { fallbackUsed: true, error: 'x' } });
  });

  it('si el engine devuelve ilegal: se corrige antes de entregar', async () => {
    const r = await decideTurn(turnFromMoves([]), { chooseMove: () => ({ column: 42, fallbackUsed: false }) });
    expect(r.column).toBe(3);
    expect(r.decision.fallbackUsed).toBe(true);
  });

  it('pasa al engine el presupuesto local y quiénes somos', async () => {
    let seen;
    await decideTurn(turnFromMoves([3]), { chooseMove: (ctx, s) => { seen = { ctx, s }; return { column: 3 }; }, now: () => 0, budgetMs: 1200 });
    expect(seen.ctx).toMatchObject({ player: 2, timeBudgetMs: 1200, gameId: 'g_fixture' });
    expect(seen.s).toBe('search');
  });
});
