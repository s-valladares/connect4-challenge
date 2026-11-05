/**
 * Logs estructurados (JSON por línea) SIN secretos: jamás loguear el token.
 * Campos típicos: ts, level, event, gameId, turn, column, elapsedMs, status.
 * No bloqueante: loguear nunca retrasa el POST de jugada.
 * Owner: Salva (O01).
 */

/**
 * @param {'debug'|'info'|'warn'|'error'} level
 * @param {string} event
 * @param {Object} [fields]
 */
export function log(level, event, fields = {}) {
  // Implementación mínima utilizable desde ya; extender en O01.
  const entry = { ts: new Date().toISOString(), level, event, ...fields };
  console.log(JSON.stringify(entry));
}
