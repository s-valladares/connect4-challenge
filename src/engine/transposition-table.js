/**
 * Transposition table OPCIONAL (P2): caché de posiciones ya evaluadas.
 * Clave: serialización de tablero + jugador; guarda score, profundidad y bounds.
 * Tamaño limitado; medir hit-rate antes de activarla en liga.
 * Owner: Jorge (E04). No es camino crítico.
 */

export class TranspositionTable {
  /** @param {number} [maxEntries] */
  constructor(maxEntries = 1_000_000) {
    this.maxEntries = maxEntries;
    this.map = new Map();
    this.hits = 0;
    this.misses = 0;
  }

  /** TODO(E04): get/set con política de reemplazo y stats de hit-rate. */
}
