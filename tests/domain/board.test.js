import { describe, it, expect } from 'vitest';
import { ROWS, COLS, TOTAL_CELLS, createBoard } from '../../src/domain/connect4/board.js';

// Smoke test inicial: deja la suite verde desde el primer commit.
// TODO(Q02, Alex): reemplazar/ampliar con pruebas reales de reglas y resultado.
describe('board (D01)', () => {
  it('es 7 filas × 8 columnas = 56 casillas', () => {
    expect(ROWS).toBe(7);
    expect(COLS).toBe(8);
    expect(TOTAL_CELLS).toBe(56);
  });

  it('createBoard devuelve tablero vacío 7×8', () => {
    const board = createBoard();
    expect(board).toHaveLength(ROWS);
    for (const row of board) {
      expect(row).toHaveLength(COLS);
      expect(row.every((cell) => cell === 0)).toBe(true);
    }
  });

  it('createBoard no comparte referencias entre filas', () => {
    const board = createBoard();
    board[0][0] = 1;
    expect(board[1][0]).toBe(0);
  });
});
