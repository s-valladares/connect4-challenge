/** Estabilidad y medición (T01/T02, Alex): 120+ partidas con semilla, benchmark y repositorio. */
import { describe, it, expect } from 'vitest';
import { runMatchup, runSearchBenchmark, playGame, makePlayer, seeded, percentile, parseArgs } from '../../src/training/arena.js';
import { openDatabase } from '../../src/infrastructure/persistence/sqlite.js';
import { createTrainingRepository } from '../../src/infrastructure/persistence/training-repository.js';

describe('estabilidad del engine en 120 partidas con semilla', () => {
  it('0 jugadas ilegales; search no pierde contra random; basic le gana a random', () => {
    const r1 = runMatchup('search', 'random', { games: 60, budgetMs: 5, seed: 1 });
    const r2 = runMatchup('basic', 'random', { games: 60, budgetMs: 5, seed: 2 });
    expect(r1.illegal + r2.illegal).toBe(0);
    expect(r1.winsB).toBe(0);
    expect(r2.winsA).toBeGreaterThan(r2.winsB);
  });

  it('search le gana a basic abriendo y sin abrir', () => {
    const r = runMatchup('search', 'basic', { games: 6, budgetMs: 60, seed: 3 });
    expect(r.illegal).toBe(0);
    expect(r.winsA).toBeGreaterThanOrEqual(5);
    expect(r.avgDepth).toBeGreaterThan(0);
  });

  it('una jugada ilegal se detecta y corta la partida', () => {
    const cheater = () => ({ column: 99, elapsedMs: 0 });
    const g = playGame(cheater, makePlayer('random', 0, seeded(1)), { rnd: seeded(1), openingPlies: 0 });
    expect(g.illegal).toBe(1);
    expect(() => makePlayer('magia', 0, seeded(1))).toThrow(/desconocida/);
  });
});

describe('benchmark, utilidades y repositorio', () => {
  it('runSearchBenchmark reporta tiempos, profundidad y nodos/s', () => {
    const [row] = runSearchBenchmark({ budgetMs: 30, repeats: 1, positions: { apertura: [] } });
    expect(row).toMatchObject({ name: 'apertura', plies: 0 });
    expect(row.depth).toBeGreaterThan(0);
    expect(row.nodesPerSec).toBeGreaterThan(0);
  });

  it('percentile y parseArgs', () => {
    expect(percentile([], 50)).toBe(0);
    expect(percentile([5, 1, 3], 50)).toBe(3);
    expect(parseArgs(['--games', '20', '--seed=7', '--a', 'search', '--save'])).toEqual({ games: 20, seed: 7, a: 'search', save: true });
  });

  it('training-repository guarda corrida, resultados y resumen', () => {
    const repo = createTrainingRepository(openDatabase(':memory:'));
    const id = repo.startRun({ config: { a: 'search' }, seed: 7, games: 2 });
    repo.saveResult(id, { gameIndex: 0, firstStrategy: 'search', secondStrategy: 'basic', winner: 1, plies: 21, maxMs: 12.6 });
    repo.saveResult(id, { gameIndex: 1, firstStrategy: 'basic', secondStrategy: 'search', plies: 56 });
    repo.finishRun(id, [{ winsA: 2 }]);
    expect(repo.getRun(id)).toMatchObject({ seed: 7, games: 2, results: 2, config: { a: 'search' }, summary: [{ winsA: 2 }] });
    expect(repo.getRun('nada')).toBeNull();
  });
});
