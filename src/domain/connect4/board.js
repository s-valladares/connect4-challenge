/**
 * Tablero 8×7: creación, clonación, validación y serialización.
 * Dominio puro: sin HTTP, BD, React ni process.env.
 * Owner: Jorge (D01).
 */

export const ROWS = 7;
export const COLS = 8;
export const TOTAL_CELLS = ROWS * COLS; // 56
export const CONNECT = 4;

/** @returns {import('./types.js').Board} Tablero vacío 7×8 (fila 0 abajo). */
export function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

/** Copia profunda: ninguna función del dominio muta el tablero recibido. */
export function cloneBoard(board) {
  return board.map((row) => [...row]);
}

/** @returns {{ p1: number, p2: number, total: number }} */
export function countPieces(board) {
  let p1 = 0;
  let p2 = 0;
  for (const row of board) {
    for (const v of row) {
      if (v === 1) p1 += 1;
      else if (v === 2) p2 += 1;
    }
  }
  return { p1, p2, total: p1 + p2 };
}

/**
 * Dimensiones 7×8, valores 0/1/2, gravedad (sin fichas flotando) y conteo
 * plausible (el jugador 1 tiene igual o una ficha más que el 2).
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateBoard(board) {
  if (!Array.isArray(board) || board.length !== ROWS) {
    return { valid: false, errors: [`El tablero debe tener ${ROWS} filas.`] };
  }
  const errors = [];
  for (let r = 0; r < ROWS; r++) {
    if (!Array.isArray(board[r]) || board[r].length !== COLS) {
      return { valid: false, errors: [`La fila ${r} debe tener ${COLS} columnas.`] };
    }
    for (let c = 0; c < COLS; c++) {
      const v = board[r][c];
      if (v !== 0 && v !== 1 && v !== 2) errors.push(`Valor inválido ${v} en [${r},${c}].`);
      if (r > 0 && v !== 0 && board[r - 1][c] === 0) errors.push(`Ficha flotando en [${r},${c}].`);
    }
  }
  const { p1, p2 } = countPieces(board);
  if (p1 - p2 !== 0 && p1 - p2 !== 1) errors.push(`Conteo imposible: jugador 1 = ${p1}, jugador 2 = ${p2}.`);
  return { valid: errors.length === 0, errors };
}

/** @returns {boolean} true si el tablero es posible en una partida real. */
export function isValidBoard(board) {
  return validateBoard(board).valid;
}

/** Jugador al que le toca según el conteo de fichas (siempre abre el 1). */
export function playerToMove(board) {
  const { p1, p2 } = countPieces(board);
  return p1 === p2 ? 1 : 2;
}

/** Texto compacto para logs: filas de abajo hacia arriba separadas por "/". */
export function serializeBoard(board) {
  return board.map((row) => row.join('')).join('/');
}
