import { describe, it, expect } from 'vitest';
import {
  decideTurn,
  computeBudgetMs,
  pickFallbackColumn,
} from '../../src/application/turn-orchestrator.js';
import { createBoard } from '../../src/domain/connect4/board.js';

const NOW = Date.parse('2026-11-05T15:00:00.000Z');

function validatedTurn(overrides = {}) {
  return {
    turn: {
      status: 'turn',
      game_id: 'g_orq',
      you: 1,
      board: createBoard(),
      deadline_ms: 3000,
      served_at: new Date(NOW).toISOString(),
      ...overrides.turn,
    },
    legalMoves: overrides.legalMoves ?? [0, 1, 2, 3, 4, 5, 6, 7],
    warnings: [],
  };
}

describe('turn-orchestrator (A03)', () => {
  it('pickFallbackColumn prefiere el centro y respeta legalMoves', () => {
    expect(pickFallbackColumn([0, 1, 2, 3, 4, 5, 6, 7])).toBe(3);
    expect(pickFallbackColumn([0, 5, 7])).toBe(5);
    expect(pickFallbackColumn([7])).toBe(7);
  });

  it('computeBudgetMs descuenta transcurrido y margen, con tope y piso', () => {
    const turn = { deadline_ms: 3000, served_at: new Date(NOW).toISOString() };
    // recién servido: 3000 - 0 - 800 = 2200 → tope 1500
    expect(computeBudgetMs(turn, { now: NOW, maxBudgetMs: 1500 })).toBe(1500);
    // 2s después: 3000 - 2000 - 800 = 200
    expect(computeBudgetMs(turn, { now: NOW + 2000, maxBudgetMs: 1500 })).toBe(200);
    // casi vencido: piso de 50
    expect(computeBudgetMs(turn, { now: NOW + 2960, maxBudgetMs: 1500 })).toBe(50);
    // served_at ilegible: asume 0 transcurrido
    expect(computeBudgetMs({ deadline_ms: 3000, served_at: 'x' }, { now: NOW, maxBudgetMs: 1500 })).toBe(1500);
  });

  it('usa la decisión del engine cuando es legal', async () => {
    const chooseMove = (context) => ({
      column: 5,
      strategy: 'search',
      depthCompleted: 4,
      elapsedMs: 10,
      nodesVisited: 100,
      fallbackUsed: false,
      score: 42,
    });
    const { column, decision } = await decideTurn(validatedTurn(), { chooseMove, now: () => NOW });
    expect(column).toBe(5);
    expect(decision.fallbackUsed).toBe(false);
  });

  it('pasa al engine el presupuesto y el contexto correctos', async () => {
    let received;
    const chooseMove = (context) => {
      received = context;
      return { column: context.legalMoves[0], strategy: 's', depthCompleted: 1, elapsedMs: 1, nodesVisited: 1, fallbackUsed: false, score: 0 };
    };
    await decideTurn(validatedTurn({ legalMoves: [2, 3] }), { chooseMove, now: () => NOW, maxBudgetMs: 1200 });
    expect(received.player).toBe(1);
    expect(received.legalMoves).toEqual([2, 3]);
    expect(received.timeBudgetMs).toBe(1200);
    expect(received.gameId).toBe('g_orq');
  });

  it('cae al fallback si el engine lanza (estado actual: stubs TODO)', async () => {
    const { column, decision } = await decideTurn(validatedTurn(), { now: () => NOW });
    expect(column).toBe(3); // central
    expect(decision.fallbackUsed).toBe(true);
    expect(decision.strategy).toContain('engine_error');
  });

  it('cae al fallback si el engine devuelve columna ilegal', async () => {
    const chooseMove = () => ({ column: 0, strategy: 'rota', depthCompleted: 1, elapsedMs: 1, nodesVisited: 1, fallbackUsed: false, score: 0 });
    const { column, decision } = await decideTurn(validatedTurn({ legalMoves: [3, 4] }), {
      chooseMove,
      now: () => NOW,
    });
    expect(column).toBe(3);
    expect(decision.fallbackUsed).toBe(true);
    expect(decision.strategy).toContain('decision_ilegal');
  });

  it('lanza si legalMoves está vacío (invariante: no inventar jugadas)', async () => {
    await expect(decideTurn(validatedTurn({ legalMoves: [] }))).rejects.toThrow(/legalMoves vacío/);
  });
});
