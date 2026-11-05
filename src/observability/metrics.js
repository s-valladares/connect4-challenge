/**
 * Métricas en memoria del worker: último GET, último turno atendido,
 * duración de cálculo, resultados del POST, errores por tipo, uptime.
 * Se exponen por log periódico (snapshot) desde src/worker/main.js.
 * Owner: Salva (O01) / Alex (O03).
 */

/** @param {{ now?: () => number }} [options] */
export function createMetrics({ now = () => Date.now() } = {}) {
  const startedAt = now();
  const m = {
    polls: 0,
    idle: 0,
    turns: 0,
    lastPollAt: null,
    lastTurnAt: null,
    results: {},
    errors: {},
    maxDecisionMs: 0,
    maxTotalMs: 0,
    fallbacks: 0,
  };
  const bump = (bag, key) => { bag[key] = (bag[key] ?? 0) + 1; };
  return {
    recordPoll(kind) {
      m.polls += 1;
      m.lastPollAt = now();
      if (kind === 'idle') m.idle += 1;
    },
    recordMove({ result, decisionMs = 0, totalMs = 0, fallback = false }) {
      m.turns += 1;
      m.lastTurnAt = now();
      bump(m.results, result);
      m.maxDecisionMs = Math.max(m.maxDecisionMs, decisionMs);
      m.maxTotalMs = Math.max(m.maxTotalMs, totalMs);
      if (fallback) m.fallbacks += 1;
    },
    recordError(kind) {
      bump(m.errors, kind);
    },
    snapshot() {
      const t = now();
      return {
        ...m,
        results: { ...m.results },
        errors: { ...m.errors },
        uptimeSec: Math.round((t - startedAt) / 1000),
        sinceLastPollMs: m.lastPollAt === null ? null : t - m.lastPollAt,
      };
    },
  };
}
