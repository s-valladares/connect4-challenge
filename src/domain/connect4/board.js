/**
 * Tablero 8×7: creación, clonación y serialización.
 * Dominio puro: sin HTTP, BD, React ni process.env.
 * Owner: Jorge (D01).
 */

export const ROWS = 7;
export const COLS = 8;
export const TOTAL_CELLS = ROWS * COLS; // 56

/** @returns {import('./types.js').Board} Tablero vacío 7×8 (fila 0 abajo). */
export function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

/**
 * TODO(D01, Jorge):
 * - cloneBoard(board) sin mutar el original
 * - isValidBoard(board): dimensiones 7×8, valores 0/1/2, gravedad coherente
 * - serializeBoard(board) para logs y transposition table
 */
