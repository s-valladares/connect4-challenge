/** Dimensiones para dibujar (la verdad del juego vive en la API). */
export const COLS = 8;
export const ROWS = 7;

/**
 * La API entrega board[0] = fila de ABAJO; para pintar de arriba hacia abajo
 * se invierte SIN mutar. Devuelve [{ row, cells }] con la fila 6 primero.
 */
export function displayRows(board) {
  return board.map((cells, row) => ({ row, cells })).reverse();
}

export function isWinningCell(winningCells, row, column) {
  return (winningCells ?? []).some(([r, c]) => r === row && c === column);
}

/** Fila de la última ficha de una columna (solo altura, sin reglas). */
export function topRow(board, column) {
  let row = -1;
  for (let r = 0; r < board.length; r++) if (board[r][column] !== 0) row = r;
  return row;
}
