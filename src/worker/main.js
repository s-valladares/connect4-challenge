/**
 * Worker del torneo — entry point de `npm run bot`.
 * Loop persistente de long polling (UNA sola instancia por token):
 *   while (true):
 *     1. GET /api/next?wait=20 (referee-client)
 *     2. idle → volver a llamar; turn → validar payload (referee-validator)
 *     3. decideTurn(turn) → columna legal (turn-orchestrator + engine)
 *     4. POST /api/move UNA vez; clasificar 200/400/401/409
 *     5. log de métricas (no bloqueante) y volver a escuchar
 * Errores de red: backoff corto y reintento del GET; el POST nunca se
 * duplica a ciegas (pudo haber llegado). 401 → alerta de token.
 * La lógica vive en run-worker.js (probada); aquí solo se arma desde .env.
 * Owner: Salva (A04).
 */

import 'dotenv/config';
import { loadConfig } from './config.js';
import { acquireWorkerLock } from './singleton-lock.js';
import { runWorker } from './run-worker.js';
import { createRefereeClient } from '../infrastructure/referee/referee-client.js';
import { configureLogger } from '../observability/logger.js';
import { createMetrics } from '../observability/metrics.js';

const cfg = loadConfig();

if (!cfg.arbitroUrl || !cfg.teamToken) {
  console.error('Faltan ARBITRO_URL o TEAM_TOKEN en el entorno (.env).');
  process.exit(1);
}

const log = configureLogger({ secrets: [cfg.teamToken] });
let lock;
try {
  lock = acquireWorkerLock(cfg.teamToken);
} catch (e) {
  log.error('worker_already_running', { error: e.message });
  process.exit(1);
}

const controller = new AbortController();
const stop = (code = 0) => {
  controller.abort();
  lock.release();
  process.exit(code);
};
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

const client = createRefereeClient({ baseUrl: cfg.arbitroUrl, token: cfg.teamToken });
try {
  const me = await client.getMe();
  log.info('team_verified', { team: me.team?.name, phase: me.phase, pending: me.pending_turns?.length ?? 0 });
} catch (e) {
  log.error('team_check_failed', { kind: e.kind, status: e.status, error: e.message, hint: e.kind === 'http_401' ? 'Revisa TEAM_TOKEN en .env' : 'Revisa ARBITRO_URL y la red' });
  stop(1);
}

const spec = await client.getOpenApi().catch(() => null);
const version = spec?.info?.version;
if (version && version !== '1.0.1') log.warn('openapi_version_changed', { version, action: 'revisar referee-client.js' });

const metrics = createMetrics();
setInterval(() => log.info('metrics', metrics.snapshot()), 60_000).unref();

log.info('worker_listening', { arbitro: cfg.arbitroUrl, strategy: cfg.strategy, budgetMs: cfg.budgetMs, waitSec: cfg.waitSec });
try {
  await runWorker({
    client, log, metrics, signal: controller.signal, budgetMs: cfg.budgetMs, waitSec: cfg.waitSec, strategy: cfg.strategy,
  });
} catch (e) {
  log.error('worker_stopped', { kind: e.kind, error: e.message, hint: e.kind === 'http_401' ? 'Revisa TEAM_TOKEN en .env' : undefined });
  stop(1);
}
