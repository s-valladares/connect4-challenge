/**
 * Transposition table: caché de posiciones ya evaluadas.
 * Clave: cur + mask del bitboard (única por posición, Pons). Guarda
 * { depth, flag, value, move }; flag indica si el valor es exacto o una cota.
 * Tamaño limitado: al llenarse se vacía (simple y predecible).
 * Owner: Jorge (E04). Medido en docs/BENCHMARKS.md.
 */

import { Position } from './bitboard.js';

export const EXACT = 0;
export const LOWER = 1;
export const UPPER = 2;

export class TranspositionTable {
  /** @param {number} [maxEntries] */
  constructor(maxEntries = 1_000_000) {
    this.maxEntries = maxEntries;
    this.map = new Map();
    this.hits = 0;
    this.misses = 0;
  }

  get(key) {
    const entry = this.map.get(key);
    if (entry) this.hits += 1;
    else this.misses += 1;
    return entry;
  }

  set(key, entry) {
    if (this.map.size >= this.maxEntries) this.map.clear();
    this.map.set(key, entry);
  }

  get size() {
    return this.map.size;
  }

  clear() {
    this.map.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /** @returns {{ size: number, hits: number, misses: number, hitRate: number }} */
  stats() {
    const total = this.hits + this.misses;
    return { size: this.size, hits: this.hits, misses: this.misses, hitRate: total ? this.hits / total : 0 };
  }
}

/** Firma estable de un tablero con el jugador al turno (para logs y pruebas). */
export function positionKey(board, player) {
  return `${Position.fromBoard(board, player).key().toString(36)}:${player}`;
}
