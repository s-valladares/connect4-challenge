/**
 * Utilidades de pruebas. Todo tablero se genera con replayMoves() desde tablero
 * vacío (regla de tests/fixtures/README.md): gravedad y paridad reales.
 * Owner: Jorge (lo usan también Salva, Juan y Alex).
 */
import { ROWS, COLS } from '../../src/domain/connect4/board.js';
import { replayMoves } from '../../src/domain/connect4/game-state.js';

/** Patrón sin ningún 4 en línea: columnas A A B B A A B B con colores alternos. */
export const patternValue = (r, c) => ((r + ((c >> 1) & 1)) % 2 === 0 ? 1 : 2);

/** Secuencia legal y alternada que llena `cells` con el patrón (búsqueda en profundidad). */
export function patternSequence(cells) {
  const target = new Map(cells.map(([r, c]) => [`${r},${c}`, patternValue(r, c)]));
  const h = new Array(COLS).fill(0);
  const seq = [];
  const dfs = (p) => {
    if (seq.length === target.size) return true;
    for (let c = 0; c < COLS; c++) {
      if (target.get(`${h[c]},${c}`) === p) {
        h[c] += 1;
        seq.push(c);
        if (dfs(3 - p)) return true;
        h[c] -= 1;
        seq.pop();
      }
    }
    return false;
  };
  if (!dfs(1)) throw new Error('Sin secuencia');
  return seq;
}

/** Todas las celdas [fila, columna] de las primeras `columns` columnas. */
export function allCells(columns = COLS) {
  const out = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < columns; c++) out.push([r, c]);
  return out;
}

/** MoveContext coherente a partir de jugadas. */
export function contextFrom(moves, extra = {}) {
  const s = replayMoves(moves);
  return { board: s.board, player: s.currentPlayer, legalMoves: s.legalMoves, timeBudgetMs: 200, ...extra };
}

/** Generador pseudoaleatorio reproducible (mulberry32). */
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
