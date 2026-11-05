/**
 * Reglas puras: jugadas legales, gravedad y aplicación de movimiento.
 * El estado de origen NUNCA se muta; applyMove devuelve un tablero nuevo.
 * Owner: Jorge (D02).
 */

import { ROWS, COLS, cloneBoard } from './board.js';
import { RuleError, RuleErrorCodes } from './errors.js';

/**
 * Columnas no llenas, de 0 a 7.
 * @param {import('./types.js').Board} board
 * @returns {number[]}
 */
export function getLegalMoves(board) {
  const legal = [];
  for (let c = 0; c < COLS; c++) if (board[ROWS - 1][c] === 0) legal.push(c);
  return legal;
}

/** Fila libre más baja de la columna, o null si está llena. */
export function getNextFreeRow(board, column) {
  for (let r = 0; r < ROWS; r++) if (board[r][column] === 0) return r;
  return null;
}

/** Entero entre 0 y 7. */
export function isValidColumn(column) {
  return Number.isInteger(column) && column >= 0 && column < COLS;
}

/**
 * Aplica un movimiento: la ficha cae a la fila vacía más baja de la columna.
 * @param {import('./types.js').Board} board
 * @param {number} column 0..7, debe ser legal
 * @param {import('./types.js').Player} player
 * @returns {import('./types.js').Board} tablero NUEVO (no muta el original)
 * @throws {RuleError} illegal_move (fuera de rango o llena) | invalid_player
 */
export function applyMove(board, column, player) {
  if (!isValidColumn(column)) {
    throw new RuleError(RuleErrorCodes.ILLEGAL_MOVE, `La columna ${column} está fuera de rango (0 a ${COLS - 1}).`);
  }
  if (player !== 1 && player !== 2) {
    throw new RuleError(RuleErrorCodes.INVALID_PLAYER, `Jugador inválido: ${player}.`);
  }
  const row = getNextFreeRow(board, column);
  if (row === null) throw new RuleError(RuleErrorCodes.ILLEGAL_MOVE, `La columna ${column} está llena.`);
  const next = cloneBoard(board);
  next[row][column] = player;
  return next;
}
