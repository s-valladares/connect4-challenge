/**
 * Arena de entrenamiento y medición (T01/T02, Alex): partidas en memoria entre
 * estrategias, con semilla, alternando quién abre. Mide, NO "aprende".
 * Usa solo dominio + engine (sin red ni BD). La usan self-play.js y benchmark.js.
 */

import { createGameState, playTurn, replayMoves } from '../domain/connect4/game-state.js';
import { chooseMove } from '../engine/engine-service.js';
import { basicStrategy } from '../engine/strategies/basic-strategy.js';
import { createSearchStrategy } from '../engine/strategies/search-strategy.js';

/** Generador pseudoaleatorio reproducible (mulberry32). */
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function percentile(xs, p) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.round((p / 100) * (s.length - 1)))];
}

/** Jugador: 'random' | 'basic' | 'search'. Cada jugador search tiene SU propia TT. */
export function makePlayer(kind, budgetMs, rnd) {
  if (kind === 'random') return (s) => ({ column: s.legalMoves[Math.floor(rnd() * s.legalMoves.length)], elapsedMs: 0, depthCompleted: 0 });
  const registry = { basic: basicStrategy, search: createSearchStrategy() };
  if (!registry[kind]) throw new Error(`Estrategia desconocida: ${kind}`);
  return (s) => chooseMove({ board: s.board, player: s.currentPlayer, legalMoves: s.legalMoves, timeBudgetMs: budgetMs }, kind, registry);
}

/**
 * Una partida: `first` abre (jugador 1). `openingPlies` jugadas al azar para diversificar.
 * @returns {{ winner: 1|2|null, status: string, plies: number, illegal: number, times: number[][], depths: number[][] }}
 */
export function playGame(first, second, { rnd, openingPlies = 2 } = {}) {
  let s = createGameState();
  let illegal = 0;
  const times = [[], []];
  const depths = [[], []];
  while (s.status === 'playing') {
    let column;
    const idx = s.currentPlayer - 1;
    if (s.moves.length < openingPlies) {
      column = s.legalMoves[Math.floor(rnd() * s.legalMoves.length)];
    } else {
      const d = (idx === 0 ? first : second)(s);
      times[idx].push(d.elapsedMs);
      depths[idx].push(d.depthCompleted ?? 0);
      column = d.column;
      if (!s.legalMoves.includes(column)) {
        illegal += 1;
        break;
      }
    }
    s = playTurn(s, column);
  }
  return { winner: s.winner, status: s.status, plies: s.moves.length, illegal, times, depths };
}

/**
 * N partidas A contra B alternando quién abre.
 * @returns {{ a, b, games, winsA, winsB, draws, illegal, p50Ms, p95Ms, maxMs, avgDepth }} métricas de A
 */
export function runMatchup(kindA, kindB, { games = 10, budgetMs = 50, seed = 7, openingPlies = 2, onGame } = {}) {
  const rnd = seeded(seed);
  const res = { a: kindA, b: kindB, games, winsA: 0, winsB: 0, draws: 0, illegal: 0 };
  const timesA = [];
  const depthsA = [];
  for (let i = 0; i < games; i++) {
    const aFirst = i % 2 === 0;
    const pa = makePlayer(kindA, budgetMs, rnd);
    const pb = makePlayer(kindB, budgetMs, rnd);
    const g = aFirst ? playGame(pa, pb, { rnd, openingPlies }) : playGame(pb, pa, { rnd, openingPlies });
    const aIdx = aFirst ? 0 : 1;
    timesA.push(...g.times[aIdx]);
    depthsA.push(...g.depths[aIdx]);
    res.illegal += g.illegal;
    if (g.status === 'draw') res.draws += 1;
    else if ((g.winner === 1) === aFirst) res.winsA += 1;
    else res.winsB += 1;
    onGame?.({ index: i, first: aFirst ? kindA : kindB, second: aFirst ? kindB : kindA, ...g });
  }
  const avg = depthsA.length ? depthsA.reduce((x, y) => x + y, 0) / depthsA.length : 0;
  return {
    ...res, p50Ms: percentile(timesA, 50), p95Ms: percentile(timesA, 95), maxMs: Math.max(0, ...timesA), avgDepth: Math.round(avg * 10) / 10,
  };
}

/** Posiciones fijas para medir tiempo y profundidad (prefijos del patrón sin 4 en línea). */
export const BENCHMARK_POSITIONS = Object.freeze({
  apertura: [],
  'apertura-2': [3, 4],
  'medio-tactico': [3, 4, 3, 4, 2, 5, 2, 5, 4, 3, 1, 6],
  'medio-2': [0, 0, 0, 0, 0, 0, 0, 2, 1, 1, 1, 1, 1, 1, 1, 3, 2, 2, 2, 2, 2, 2],
  'casi-final': [0, 0, 0, 0, 0, 0, 0, 2, 1, 1, 1, 1, 1, 1, 1, 3, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 6, 5, 5, 5, 5],
});

/** Tiempo y profundidad de searchStrategy sobre posiciones fijas (TT nueva en cada repetición). */
export function runSearchBenchmark({ budgetMs = 1500, repeats = 3, positions = BENCHMARK_POSITIONS } = {}) {
  const rows = [];
  for (const [name, moves] of Object.entries(positions)) {
    const s = replayMoves(moves);
    const times = [];
    const depths = [];
    let nodes = 0;
    for (let i = 0; i < repeats; i++) {
      const d = createSearchStrategy().chooseMove({ board: s.board, player: s.currentPlayer, legalMoves: s.legalMoves, timeBudgetMs: budgetMs });
      times.push(d.elapsedMs);
      depths.push(d.depthCompleted);
      nodes += d.nodesVisited;
    }
    const total = times.reduce((a, b) => a + b, 0);
    rows.push({
      name, plies: moves.length, p50: percentile(times, 50), p95: percentile(times, 95), max: Math.max(...times),
      depth: Math.min(...depths), nodesPerSec: Math.round((nodes / Math.max(1, total)) * 1000),
    });
  }
  return rows;
}

/** `--games 20` o `--games=20` → número / texto; `--save` → true. */
export function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const [k, inline] = a.slice(2).split('=');
    const value = inline ?? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true);
    out[k] = typeof value === 'string' && /^-?\d+$/.test(value) ? Number(value) : value;
  }
  return out;
}
