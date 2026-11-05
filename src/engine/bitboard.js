/**
 * Tablero en bits para la búsqueda. Técnica de Pascal Pons ("Solving Connect Four",
 * blog.gamesolver.org · github.com/PascalPons/connect4), adaptada de 7×6 a 8×7.
 *
 * 64 bits (por eso BigInt: no cabe en un number de JS): la columna c ocupa los
 * bits c*8 … c*8+6 (fila 0 abajo) y el bit c*8+7 es un CENTINELA siempre vacío
 * que evita alineaciones falsas entre columnas.
 * Una posición = `cur` (fichas del que mueve) + `mask` (todas las fichas).
 * Owner: Jorge (E02).
 */

import { ROWS, COLS } from '../domain/connect4/board.js';

export const W = COLS;
export const H = ROWS;
export const SIZE = W * H;
const H1 = BigInt(H + 1);

/** Del centro hacia afuera: 8 columnas => centro DOBLE (3 y 4). */
export const CENTER_ORDER = Object.freeze([3, 4, 2, 5, 1, 6, 0, 7]);

export const COL_MASK = [];
export const TOP_MASK = [];
export const BOTTOM = [];
let bottomMask = 0n;
for (let c = 0; c < W; c++) {
  const base = BigInt(c) * H1;
  BOTTOM.push(1n << base);
  TOP_MASK.push(1n << (base + BigInt(H - 1)));
  COL_MASK.push(((1n << BigInt(H)) - 1n) << base);
  bottomMask |= 1n << base;
}
export const BOTTOM_MASK = bottomMask;
export const BOARD_MASK = bottomMask * ((1n << BigInt(H)) - 1n);

const SHIFTS = [H1, H1 - 1n, H1 + 1n]; // horizontal y diagonales

function popcount32(v) {
  let n = v - ((v >>> 1) & 0x55555555);
  n = (n & 0x33333333) + ((n >>> 2) & 0x33333333);
  return (((n + (n >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

export function popcount(x) {
  return popcount32(Number(x & 0xffffffffn)) + popcount32(Number(x >> 32n));
}

/** Casillas vacías que completarían un 4 en línea para las fichas `p`. */
export function winningSpots(p, mask) {
  let r = (p << 1n) & (p << 2n) & (p << 3n); // vertical (solo hacia arriba)
  for (const s of SHIFTS) {
    let t = (p << s) & (p << (2n * s));
    r |= t & (p << (3n * s));
    r |= t & (p >> s);
    t = (p >> s) & (p >> (2n * s));
    r |= t & (p << s);
    r |= t & (p >> (3n * s));
  }
  return r & (BOARD_MASK ^ mask);
}

/** ¿Las fichas `p` ya tienen 4 en línea? */
export function hasFour(p) {
  for (const s of [1n, H1, H1 - 1n, H1 + 1n]) {
    const m = p & (p >> s);
    if (m & (m >> (2n * s))) return true;
  }
  return false;
}

export class Position {
  constructor(cur = 0n, mask = 0n, moves = 0) {
    this.cur = cur;
    this.mask = mask;
    this.moves = moves;
  }

  clone() {
    return new Position(this.cur, this.mask, this.moves);
  }

  canPlay(col) {
    return col >= 0 && col < W && (this.mask & TOP_MASK[col]) === 0n;
  }

  /** Jugar en `col`: sumar el bit de abajo "llena" el primer hueco; `^` cambia de jugador. */
  play(col) {
    this.cur ^= this.mask;
    this.mask |= this.mask + BOTTOM[col];
    this.moves += 1;
  }

  legalMoves() {
    const out = [];
    for (let c = 0; c < W; c++) if (this.canPlay(c)) out.push(c);
    return out;
  }

  /** Bitmask de las casillas donde se puede jugar ahora. */
  possible() {
    return (this.mask + BOTTOM_MASK) & BOARD_MASK;
  }

  canWinWith(col) {
    return (winningSpots(this.cur, this.mask) & this.possible() & COL_MASK[col]) !== 0n;
  }

  /** Clave única por posición (Pons): cur + mask. */
  key() {
    return this.cur + this.mask;
  }

  /** Desde board[fila][columna] con `player` como jugador que mueve. */
  static fromBoard(board, player) {
    let cur = 0n;
    let mask = 0n;
    let moves = 0;
    for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) {
        const v = board[r][c];
        if (!v) continue;
        const bit = 1n << (BigInt(r) + BigInt(c) * H1);
        mask |= bit;
        moves += 1;
        if (v === player) cur |= bit;
      }
    }
    return new Position(cur, mask, moves);
  }
}
