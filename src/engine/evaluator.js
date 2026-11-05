/**
 * Heurística: puntúa un estado no terminal desde el jugador que mueve.
 *   10 × (amenazas abiertas propias − del rival) + Σ peso(columna) × (fichas propias − del rival)
 * Una "amenaza abierta" es una casilla vacía que completaría 4 en línea.
 * Determinista e interpretable (se explica al jurado).
 *
 * SIN bonificación de paridad: la regla de filas impares del 7×6 (Allis)
 * empeoró el bot en 8×7 en simulación (5-1-14 contra esta versión).
 * Owner: Jorge (E01).
 */

import { W, COL_MASK, winningSpots, popcount, Position } from './bitboard.js';

/** Pesos de la heurística; candidatos a tuning en training/tuners.js (T03). */
export const WEIGHTS = Object.freeze({
  threat: 10,
  columns: Object.freeze([1, 2, 3, 4, 4, 3, 2, 1]),
});

/** Evalúa una Position (bitboard) desde el jugador que mueve. */
export function evaluatePosition(pos, weights = WEIGHTS) {
  const me = pos.cur;
  const opp = pos.cur ^ pos.mask;
  let score = weights.threat * (popcount(winningSpots(me, pos.mask)) - popcount(winningSpots(opp, pos.mask)));
  for (let c = 0; c < W; c++) {
    const w = weights.columns[c];
    // Las columnas de borde (peso 1) se omiten: aportan casi nada y ahorran trabajo por nodo.
    if (w > 1) score += w * (popcount(me & COL_MASK[c]) - popcount(opp & COL_MASK[c]));
  }
  return score;
}

/**
 * @param {import('../domain/connect4/types.js').Board} board
 * @param {import('../domain/connect4/types.js').Player} player
 * @returns {number} puntuación desde la perspectiva de `player` (positivo = bueno)
 */
export function evaluate(board, player) {
  return evaluatePosition(Position.fromBoard(board, player));
}

/** Alias con el nombre de RESPONSABILIDADES_EQUIPO_CONNECT4.md. */
export const evaluateBoard = evaluate;
