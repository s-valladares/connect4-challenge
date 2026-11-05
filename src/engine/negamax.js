/**
 * Negamax con poda alfa-beta sobre bitboard + iterative deepening por tiempo.
 * Técnicas de Pons: filtro de jugadas perdedoras, orden por amenazas, clave cur+mask.
 * No conoce HTTP ni deadlines absolutos: recibe un presupuesto o un checker.
 * El reloj se revisa de forma cooperativa cada 1.024 nodos (JS es de un solo hilo).
 * Owner: Jorge (E02).
 */

import { SIZE, COL_MASK, CENTER_ORDER, Position, winningSpots } from './bitboard.js';
import { evaluatePosition } from './evaluator.js';
import { orderPositionMoves } from './move-ordering.js';
import { TranspositionTable, EXACT, LOWER, UPPER } from './transposition-table.js';

export const WIN_SCORE = 100_000;
const INF = 10 * WIN_SCORE;
const TIME_CHECK_EVERY = 1024;

class Timeout extends Error {}

/** ¿El puntaje es una victoria/derrota forzada (no una estimación heurística)? */
export function isForced(score) {
  return Math.abs(score) >= WIN_SCORE - SIZE;
}

/** Jugadas que no regalan victoria inmediata al rival (bitmask). 0n = todas pierden. */
export function nonLosingMoves(pos) {
  let possible = pos.possible();
  const oppWin = winningSpots(pos.cur ^ pos.mask, pos.mask);
  const forced = possible & oppWin;
  if (forced) {
    if (forced & (forced - 1n)) return 0n; // dos amenazas: perdida
    possible = forced; // una amenaza: solo bloquear
  }
  return possible & ~(oppWin >> 1n); // nunca jugar justo debajo de su casilla ganadora
}

export class Searcher {
  constructor({ maxDepth = SIZE, now = () => performance.now(), tt = new TranspositionTable() } = {}) {
    this.maxDepth = maxDepth;
    this.now = now;
    this.tt = tt;
    this.nodes = 0;
    this.isTimeUp = () => false;
  }

  checkClock() {
    this.nodes += 1;
    if (this.nodes % TIME_CHECK_EVERY === 0 && this.isTimeUp()) throw new Timeout();
  }

  terminal(pos, depth) {
    if (pos.moves >= SIZE) return { score: 0 };
    if (winningSpots(pos.cur, pos.mask) & pos.possible()) return { score: WIN_SCORE - pos.moves };
    const candidates = nonLosingMoves(pos);
    if (!candidates) return { score: -(WIN_SCORE - pos.moves - 1) };
    if (pos.moves >= SIZE - 2) return { score: 0 };
    if (depth === 0) return { score: evaluatePosition(pos) };
    return { candidates };
  }

  probe(key, depth, alpha, beta) {
    const entry = this.tt.get(key);
    if (!entry) return { alpha, beta, move: null };
    const out = { alpha, beta, move: entry.move };
    if (entry.depth < depth) return out;
    if (entry.flag === EXACT) return { ...out, cut: entry.value };
    if (entry.flag === LOWER) out.alpha = Math.max(alpha, entry.value);
    if (entry.flag === UPPER) out.beta = Math.min(beta, entry.value);
    if (out.alpha >= out.beta) out.cut = entry.value;
    return out;
  }

  store(key, depth, best, move, alpha0, beta) {
    let flag = EXACT;
    if (best <= alpha0) flag = UPPER;
    else if (best >= beta) flag = LOWER;
    this.tt.set(key, { depth, flag, value: best, move });
  }

  /** Puntaje desde el jugador que mueve. */
  negamax(pos, depth, alpha0, beta0) {
    this.checkClock();
    const t = this.terminal(pos, depth);
    if (t.score !== undefined) return t.score;
    const key = pos.key();
    const tt = this.probe(key, depth, alpha0, beta0);
    if (tt.cut !== undefined) return tt.cut;
    let { alpha } = tt;
    const { beta } = tt;
    let best = -INF;
    let bestMove = null;
    for (const c of orderPositionMoves(pos, t.candidates, tt.move)) {
      const child = pos.clone();
      child.play(c);
      const v = -this.negamax(child, depth - 1, -beta, -alpha);
      if (v > best) {
        best = v;
        bestMove = c;
      }
      alpha = Math.max(alpha, v);
      if (alpha >= beta) break;
    }
    this.store(key, depth, best, bestMove, alpha0, beta);
    return best;
  }

  searchRoot(pos, depth, alphaStart = -INF, beta = INF) {
    // Victoria inmediata en la raíz: los hijos no detectan que el padre ya ganó.
    const wins = winningSpots(pos.cur, pos.mask) & pos.possible();
    if (wins) return { move: CENTER_ORDER.find((c) => wins & COL_MASK[c]), score: WIN_SCORE - pos.moves };
    const candidates = nonLosingMoves(pos) || pos.possible();
    const entry = this.tt.get(pos.key());
    let alpha = alphaStart;
    let best = -INF;
    let bestMove = null;
    for (const c of orderPositionMoves(pos, candidates, entry ? entry.move : null)) {
      const child = pos.clone();
      child.play(c);
      const v = -this.negamax(child, depth - 1, -beta, -alpha);
      if (v > best) {
        best = v;
        bestMove = c;
      }
      alpha = Math.max(alpha, v);
      if (alpha >= beta) break;
    }
    this.tt.set(pos.key(), { depth, flag: EXACT, value: best, move: bestMove });
    return { move: bestMove, score: best };
  }

  /**
   * Iterative deepening: profundidad 1, 2, 3… hasta agotar `budgetMs`.
   * Devuelve la mejor jugada de la última profundidad COMPLETA.
   */
  search(pos, budgetMs) {
    const start = this.now();
    const deadline = start + budgetMs;
    this.isTimeUp = () => this.now() > deadline;
    this.nodes = 0;
    const fallbackMask = nonLosingMoves(pos) || pos.possible();
    let column = CENTER_ORDER.find((c) => fallbackMask & COL_MASK[c]);
    let score = null;
    let depthCompleted = 0;
    try {
      const limit = Math.min(this.maxDepth, SIZE - pos.moves);
      for (let depth = 1; depth <= limit; depth++) {
        const r = this.searchRoot(pos, depth);
        column = r.move;
        score = r.score;
        depthCompleted = depth;
        if (isForced(score)) break; // victoria/derrota forzada: no hace falta buscar más
      }
    } catch (err) {
      if (!(err instanceof Timeout)) throw err;
    }
    return { column, score, depthCompleted, nodesVisited: this.nodes, elapsedMs: Math.round(this.now() - start) };
  }
}

/**
 * Búsqueda a profundidad FIJA sobre board[fila][columna] (contrato del plan).
 * Si `isTimeUp` corta antes de terminar: column = null y timedOut = true.
 * @param {Object} params
 * @param {import('../domain/connect4/types.js').Board} params.board
 * @param {import('../domain/connect4/types.js').Player} params.player
 * @param {number} params.depth
 * @param {number} [params.alpha]
 * @param {number} [params.beta]
 * @param {() => boolean} [params.isTimeUp]  Checker del presupuesto (iterative deepening).
 * @returns {{ score: number|null, column: number|null, nodes: number, timedOut: boolean }}
 */
export function negamax({ board, player, depth, alpha = -INF, beta = INF, isTimeUp = () => false }) {
  const searcher = new Searcher();
  searcher.isTimeUp = isTimeUp;
  try {
    const r = searcher.searchRoot(Position.fromBoard(board, player), Math.max(1, depth), alpha, beta);
    return { score: r.score, column: r.move, nodes: searcher.nodes, timedOut: false };
  } catch (err) {
    if (!(err instanceof Timeout)) throw err;
    return { score: null, column: null, nodes: searcher.nodes, timedOut: true };
  }
}
