/**
 * Logs estructurados (JSON por línea) SIN secretos: jamás loguear el token.
 * Campos típicos: ts, level, event, gameId, turn, column, elapsedMs, status.
 * No bloqueante: loguear nunca retrasa el POST de jugada.
 * Owner: Salva (O01).
 */

/**
 * @param {{ secrets?: string[], sink?: (line: string) => void, minLevel?: 'debug'|'info'|'warn'|'error' }} [options]
 */
export function createLogger({ secrets = [], sink = console.log, minLevel = 'info' } = {}) {
  const ORDER = { debug: 0, info: 1, warn: 2, error: 3 };
  const redact = (text) => secrets.filter(Boolean).reduce((t, s) => t.split(s).join('***'), text);
  const write = (level, event, fields = {}) => {
    if (ORDER[level] < ORDER[minLevel]) return;
    const entry = { ts: new Date().toISOString(), level, event, ...fields };
    sink(redact(JSON.stringify(entry)));
  };
  return {
    debug: (event, fields) => write('debug', event, fields),
    info: (event, fields) => write('info', event, fields),
    warn: (event, fields) => write('warn', event, fields),
    error: (event, fields) => write('error', event, fields),
  };
}

let defaultLogger = createLogger();

/** El worker lo llama al arrancar para registrar el token como secreto a ocultar. */
export function configureLogger(options) {
  defaultLogger = createLogger(options);
  return defaultLogger;
}

/**
 * @param {'debug'|'info'|'warn'|'error'} level
 * @param {string} event
 * @param {Object} [fields]
 */
export function log(level, event, fields = {}) {
  defaultLogger[level](event, fields);
}
