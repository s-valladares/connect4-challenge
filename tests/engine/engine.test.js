/** Engine (D04, E01–E04, Jorge): nunca ilegal, tiempo, tableros límite, táctica, contratos. */
import { describe, it, expect } from 'vitest';
import { replayMoves, createGameState, playTurn } from '../../src/domain/connect4/game-state.js';
import { chooseMove } from '../../src/engine/engine-service.js';
import { basicStrategy, CENTER_ORDER } from '../../src/engine/strategies/basic-strategy.js';
import { createSearchStrategy, searchStrategy, fallbackStrategy } from '../../src/engine/strategies/search-strategy.js';
import { getSafeFallback, findImmediateWin, findImmediateBlock } from '../../src/engine/tactics.js';
import { evaluate, evaluateBoard, WEIGHTS } from '../../src/engine/evaluator.js';
import { orderMoves, orderPositionMoves } from '../../src/engine/move-ordering.js';
import { TranspositionTable, positionKey } from '../../src/engine/transposition-table.js';
import { Searcher, negamax, isForced, WIN_SCORE, nonLosingMoves } from '../../src/engine/negamax.js';
import { Position, hasFour } from '../../src/engine/bitboard.js';
import { patternSequence, allCells, contextFrom, seeded } from '../fixtures/helpers.js';

describe('táctica y estrategia básica', () => {
  it('getSafeFallback prefiere el centro y respeta la legalidad', () => {
    expect(CENTER_ORDER).toEqual([3, 4, 2, 5, 1, 6, 0, 7]);
    expect(getSafeFallback([0, 1, 2, 3, 4, 5, 6, 7])).toBe(3);
    expect(getSafeFallback([0, 7])).toBe(0);
  });

  it('findImmediateWin y findImmediateBlock', () => {
    const win = contextFrom([3, 3, 4, 4, 5, 5]);
    expect(findImmediateWin(win.board, win.player, win.legalMoves)).toEqual([2, 6]);
    const block = contextFrom([2, 3, 0, 4, 7, 5]);
    expect(findImmediateBlock(block.board, block.player, block.legalMoves)).toEqual([6]);
  });

  it('basicStrategy: gana, bloquea o va al centro', () => {
    expect(basicStrategy.chooseMove(contextFrom([3, 3, 4, 4, 5, 5])).column).toBe(2);
    expect(basicStrategy.chooseMove(contextFrom([2, 3, 0, 4, 7, 5])).column).toBe(6);
    expect(basicStrategy.chooseMove(contextFrom([])).column).toBe(3);
    expect(fallbackStrategy).toBe(basicStrategy);
  });
});

describe('búsqueda (searchStrategy)', () => {
  it('gana si puede y bloquea la única amenaza', () => {
    expect([2, 6]).toContain(chooseMove(contextFrom([3, 3, 4, 4, 5, 5])).column);
    expect(chooseMove(contextFrom([2, 3, 0, 4, 7, 5], { timeBudgetMs: 300 })).column).toBe(6);
  });

  it('detecta derrota forzada (doble amenaza) y aun así juega legal', () => {
    const ctx = contextFrom([0, 3, 0, 4, 7, 5], { timeBudgetMs: 300 });
    const d = chooseMove(ctx);
    expect(ctx.legalMoves).toContain(d.column);
    expect(d.score).toBeLessThanOrEqual(-(WIN_SCORE - 60));
    expect(isForced(d.score)).toBe(true);
    expect(isForced(10)).toBe(false);
  });

  it('nunca devuelve una jugada ilegal (80 tableros aleatorios reproducibles)', () => {
    const rnd = seeded(42);
    for (let i = 0; i < 80; i++) {
      let s = createGameState();
      const n = Math.floor(rnd() * 45);
      for (let k = 0; k < n && s.status === 'playing'; k++) s = playTurn(s, s.legalMoves[Math.floor(rnd() * s.legalMoves.length)]);
      if (s.status !== 'playing') continue;
      const d = chooseMove({ board: s.board, player: s.currentPlayer, legalMoves: s.legalMoves, timeBudgetMs: 20 });
      expect(s.legalMoves).toContain(d.column);
    }
  });

  it('tableros límite: una sola columna y casi lleno', () => {
    const one = contextFrom(patternSequence(allCells(7)));
    expect(one.legalMoves).toEqual([7]);
    expect(chooseMove(one).column).toBe(7);
    const almost = contextFrom(patternSequence(allCells()).slice(0, -2));
    expect(almost.legalMoves).toContain(chooseMove(almost).column);
  });

  it('respeta el presupuesto: 1.500 ms → responde en menos de 2.000 ms con profundidad ≥ 8', () => {
    const t0 = performance.now();
    const d = chooseMove(contextFrom([3, 4, 3, 4], { timeBudgetMs: 1500 }));
    expect(performance.now() - t0).toBeLessThan(2000);
    expect(d.depthCompleted).toBeGreaterThanOrEqual(8);
    expect(d.fallbackUsed).toBe(false);
  });

  it('si el reloj se agota a media búsqueda devuelve la última profundidad completa', () => {
    let calls = 0;
    const s = new Searcher({ now: () => (calls++ === 0 ? 0 : Number.POSITIVE_INFINITY) });
    const r = s.search(Position.fromBoard(contextFrom([3]).board, 2), 1);
    expect(r.depthCompleted).toBeLessThan(15);
    expect([0, 1, 2, 3, 4, 5, 6, 7]).toContain(r.column);
  });

  it('sin profundidad completa o con error en la búsqueda → cae a la estrategia básica', () => {
    const strat = createSearchStrategy();
    strat.searcher.search = () => ({ column: 3, depthCompleted: 0 });
    expect(strat.chooseMove(contextFrom([2, 3, 0, 4, 7, 5]))).toMatchObject({ column: 6, fallbackUsed: true, strategy: 'search' });
    strat.searcher.search = () => { throw new Error('bug'); };
    expect(strat.chooseMove(contextFrom([]))).toMatchObject({ column: 3, fallbackUsed: true });
  });

  it('no muta board ni legalMoves y respeta maxDepth', () => {
    const ctx = contextFrom([3, 4, 2]);
    const before = JSON.stringify(ctx);
    chooseMove(ctx);
    expect(JSON.stringify(ctx)).toBe(before);
    const shallow = createSearchStrategy({ maxDepth: 2 }).chooseMove(contextFrom([3], { timeBudgetMs: 1000 }));
    expect(shallow.depthCompleted).toBeLessThanOrEqual(2);
    expect(searchStrategy.name).toBe('search');
  });
});

describe('engine-service (contrato MoveContext → MoveDecision)', () => {
  it('MoveDecision tiene todos los campos del contrato congelado', () => {
    const d = chooseMove(contextFrom([3, 4]));
    expect(Object.keys(d)).toEqual(expect.arrayContaining(['column', 'strategy', 'depthCompleted', 'elapsedMs', 'nodesVisited', 'fallbackUsed', 'score']));
    expect(chooseMove(contextFrom([]), 'basic').strategy).toBe('basic');
  });

  it('errores del llamador: legalMoves vacío y estrategia desconocida', () => {
    expect(() => chooseMove({ ...contextFrom([]), legalMoves: [] })).toThrow(/legalMoves vacío/);
    expect(() => chooseMove(contextFrom([]), 'magia')).toThrow(/desconocida/);
  });

  it('si la estrategia falla o devuelve ilegal, respaldo legal', () => {
    const boom = { name: 'boom', chooseMove: () => { throw new Error('boom'); } };
    expect(chooseMove(contextFrom([]), 'boom', { boom })).toMatchObject({ column: 3, fallbackUsed: true, error: 'boom' });
    const bad = { name: 'bad', chooseMove: () => ({ column: 9, strategy: 'bad', fallbackUsed: false }) };
    expect(chooseMove({ ...contextFrom([]), legalMoves: [0, 1] }, 'bad', { bad })).toMatchObject({ column: 1, fallbackUsed: true });
  });
});

describe('heurística, orden, TT y negamax', () => {
  it('evaluate es antisimétrica y premia el centro', () => {
    const b = replayMoves([3]).board;
    expect(evaluate(b, 1)).toBe(-evaluate(b, 2));
    expect(evaluateBoard(b, 1)).toBeGreaterThan(0);
    expect(WEIGHTS.columns).toEqual([1, 2, 3, 4, 4, 3, 2, 1]);
  });

  it('orderMoves: sugerencia primero, luego centro; orderPositionMoves usa la pista', () => {
    expect(orderMoves([0, 3, 7])).toEqual([3, 0, 7]);
    expect(orderMoves([0, 3, 7], { first: 7 })).toEqual([7, 3, 0]);
    expect(orderMoves([0, 3], { first: 5 })).toEqual([3, 0]);
    const pos = Position.fromBoard(replayMoves([]).board, 1);
    expect(orderPositionMoves(pos, nonLosingMoves(pos), 7)[0]).toBe(7);
  });

  it('TranspositionTable acota su tamaño y mide hit-rate; positionKey es estable', () => {
    const tt = new TranspositionTable(2);
    tt.set(1n, { depth: 1 });
    tt.set(2n, { depth: 1 });
    tt.set(3n, { depth: 1 });
    expect(tt.size).toBe(1);
    expect(tt.get(3n)).toEqual({ depth: 1 });
    expect(tt.get(9n)).toBeUndefined();
    expect(tt.stats()).toMatchObject({ hits: 1, misses: 1, hitRate: 0.5 });
    tt.clear();
    expect(tt.stats()).toEqual({ size: 0, hits: 0, misses: 0, hitRate: 0 });
    const b = replayMoves([3, 4]).board;
    expect(positionKey(b, 1)).toBe(positionKey(b, 1));
    expect(positionKey(b, 1)).not.toBe(positionKey(b, 2));
  });

  it('negamax a profundidad fija encuentra la victoria; se corta con isTimeUp', () => {
    const ctx = contextFrom([3, 3, 4, 4, 5, 5]);
    const r = negamax({ board: ctx.board, player: ctx.player, depth: 2 });
    expect([2, 6]).toContain(r.column);
    expect(isForced(r.score)).toBe(true);
    const cut = negamax({ board: contextFrom([]).board, player: 1, depth: 30, isTimeUp: () => true });
    expect(cut).toMatchObject({ column: null, timedOut: true });
  });

  it('bit centinela: 3 arriba de una columna + 1 abajo de la siguiente NO es 4 en línea', () => {
    const p = (0b111n << 4n) | (1n << 8n); // filas 4-6 de col 0 y fila 0 de col 1
    expect(hasFour(p)).toBe(false);
    expect(hasFour(0b1111n)).toBe(true);
  });
});
