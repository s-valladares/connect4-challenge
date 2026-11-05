/**
 * Detección de resultado: victoria en 4 direcciones (horizontal, vertical,
 * ambas diagonales) y empate (56 casillas llenas sin ganador).
 * Owner: Jorge (D03).
 */

import { ROWS, COLS, CONNECT } from './board.js';
import { getLegalMoves } from './rules.js';

/**
 * @typedef {Object} Outcome
 * @property {'playing'|'won'|'draw'} status
 * @property {import('./types.js').Player|null} winner
 * @property {Array<[number, number]>|null} winningCells Celdas [fila, columna] de la línea de 4.
 */

const DIRECTIONS = [[0, 1], [1, 0], [1, 1], [1, -1]]; // horizontal, vertical, diagonal ↗, diagonal ↘

/**
 * Si la ficha en (row, column) forma 4 en línea, devuelve 4 celdas [fila, columna]
 * ordenadas; si no, null. Una línea de 5 devuelve sus 4 primeras celdas.
 */
export function findLineAt(board, row, column) {
  const player = board[row][column];
  if (!player) return null;
  for (const [dr, dc] of DIRECTIONS) {
    const line = [[row, column]];
    for (const sign of [1, -1]) {
      let r = row + sign * dr;
      let c = column + sign * dc;
      while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === player) {
        line.push([r, c]);
        r += sign * dr;
        c += sign * dc;
      }
    }
    if (line.length >= CONNECT) {
      line.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      return line.slice(0, CONNECT);
    }
  }
  return null;
}

/** @returns {{ winner: 1|2, winningCells: Array<[number, number]> } | null} */
export function checkWinner(board) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cells = findLineAt(board, r, c);
      if (cells) return { winner: board[r][c], winningCells: cells };
    }
  }
  return null;
}

/** Tablero lleno y sin ganador. */
export function isDraw(board) {
  return getLegalMoves(board).length === 0 && checkWinner(board) === null;
}

/**
 * @param {import('./types.js').Board} board
 * @returns {Outcome}
 */
export function getOutcome(board) {
  const win = checkWinner(board);
  if (win) return { status: 'won', winner: win.winner, winningCells: win.winningCells };
  if (isDraw(board)) return { status: 'draw', winner: null, winningCells: null };
  return { status: 'playing', winner: null, winningCells: null };
}

/** Alias con el nombre de RESPONSABILIDADES_EQUIPO_CONNECT4.md. */
export const getGameOutcome = getOutcome;
