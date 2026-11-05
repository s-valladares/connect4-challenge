/**
 * Utilidades tácticas sobre board[fila][columna]: ganar ya, bloquear ya y
 * respaldo legal determinista. Las usan basic-strategy, search-strategy,
 * engine-service y el turn-orchestrator.
 * Owner: Jorge (D04).
 */

import { CENTER_ORDER, Position, COL_MASK, winningSpots } from './bitboard.js';

/** Preferencia centro→afuera filtrada por legalidad. Nunca devuelve ilegal. */
export function getSafeFallback(legalMoves) {
  return CENTER_ORDER.find((c) => legalMoves.includes(c)) ?? legalMoves[0];
}

/** Columnas de `legalMoves` con las que `player` gana en esta jugada. */
export function findImmediateWin(board, player, legalMoves) {
  const pos = Position.fromBoard(board, player);
  return legalMoves.filter((c) => pos.canWinWith(c));
}

/** Columnas donde el RIVAL ganaría en su próxima jugada (hay que bloquearlas). */
export function findImmediateBlock(board, player, legalMoves) {
  const pos = Position.fromBoard(board, player);
  const oppWins = winningSpots(pos.cur ^ pos.mask, pos.mask) & pos.possible();
  return legalMoves.filter((c) => (oppWins & COL_MASK[c]) !== 0n);
}
