/**
 * Ordenación de movimientos para maximizar poda alfa-beta:
 * 1) la mejor jugada conocida (TT / iteración anterior), 2) las que más
 * amenazas propias crean, 3) del centro hacia afuera.
 * Owner: Jorge (E02).
 */

import { CENTER_ORDER } from './strategies/basic-strategy.js';
import { COL_MASK, winningSpots, popcount } from './bitboard.js';

/**
 * Versión sobre columnas (para quien no usa bitboard).
 * @param {number[]} legalMoves
 * @param {{ first?: number|null }} [hints] p. ej. mejor jugada de iteración anterior o TT
 * @returns {number[]} columnas ordenadas por prioridad de exploración
 */
export function orderMoves(legalMoves, hints = {}) {
  const base = CENTER_ORDER.filter((c) => legalMoves.includes(c));
  const first = hints.first;
  if (first === undefined || first === null || !base.includes(first)) return base;
  return [first, ...base.filter((c) => c !== first)];
}

/**
 * Versión sobre bitboard que usa negamax.
 * @param {import('./bitboard.js').Position} pos
 * @param {bigint} candidates bitmask de jugadas a considerar
 * @param {number|null} hint mejor jugada conocida (TT)
 */
export function orderPositionMoves(pos, candidates, hint = null) {
  const scored = [];
  CENTER_ORDER.forEach((c, i) => {
    const move = candidates & COL_MASK[c];
    if (!move) return;
    const threats = popcount(winningSpots(pos.cur | move, pos.mask | move));
    scored.push({ c, key: (c === hint ? 1000 : 0) + threats, i });
  });
  scored.sort((a, b) => b.key - a.key || a.i - b.i);
  return scored.map((s) => s.c);
}
