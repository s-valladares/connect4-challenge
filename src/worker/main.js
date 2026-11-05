/**
 * Worker del torneo — entry point de `npm run bot`.
 * Loop persistente de long polling (UNA sola instancia por token):
 * GET /api/next → idle: re-poll | turn: validar → decidir → POST único.
 * Errores de red en GET: backoff corto y reintento. El POST jamás se
 * duplica a ciegas (pudo haber llegado); 409 se trata como turno consumido.
 * Owner: Salva (A04).
 */

import 'dotenv/config';
import { createRefereeClient } from '../infrastructure/referee/referee-client.js';
import { validateTurn } from '../infrastructure/referee/referee-validator.js';
import { decideTurn } from '../application/turn-orchestrator.js';
import { log } from '../observability/logger.js';

const { ARBITRO_URL, TEAM_TOKEN } = process.env;
if (!ARBITRO_URL || !TEAM_TOKEN) {
  console.error('Faltan ARBITRO_URL o TEAM_TOKEN en el entorno (.env).');
  process.exit(1);
}

const WAIT_SECONDS = 20;
const NETWORK_BACKOFF_MS = 1000;
const AUTH_BACKOFF_MS = 5000;
const maxBudgetMs = Number(process.env.SEARCH_BUDGET_MS) || 1500;

const client = createRefereeClient({ baseUrl: ARBITRO_URL, token: TEAM_TOKEN });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

process.on('SIGINT', () => {
  log('info', 'worker_detenido');
  process.exit(0);
});

/** Procesa un payload de turno ya recibido. Exportado para tests E2E (Q05). */
export async function handleTurn(payload) {
  const validated = validateTurn(payload);
  if (!validated.ok) {
    // Nunca enviar una jugada derivada de un payload inválido.
    log('error', 'turno_invalido_no_se_juega', {
      reason: validated.reason,
      gameId: payload?.game_id ?? null,
    });
    return null;
  }
  if (validated.warnings.length > 0) {
    log('warn', 'turno_con_warnings', {
      gameId: validated.turn.game_id,
      warnings: validated.warnings,
    });
  }

  const { column, decision } = await decideTurn(validated, { maxBudgetMs });
  const post = await client.postMove(validated.turn.game_id, column);

  const level = post.kind === 'success' ? 'info' : post.kind === 'conflict' ? 'warn' : 'error';
  log(level, 'jugada_enviada', {
    gameId: validated.turn.game_id,
    turn: validated.turn.turn,
    column,
    strategy: decision.strategy,
    fallbackUsed: decision.fallbackUsed,
    depthCompleted: decision.depthCompleted,
    elapsedMs: decision.elapsedMs,
    postKind: post.kind,
    httpStatus: post.status,
    state: post.data?.state ?? post.data?.error ?? null,
  });
  return post;
}

log('info', 'worker_iniciado', { arbitro: ARBITRO_URL, maxBudgetMs }); // nunca loguear el token

while (true) {
  const next = await client.getNext(WAIT_SECONDS);

  if (next.kind === 'auth') {
    log('error', 'token_invalido_revisar_env', { httpStatus: next.status });
    await sleep(AUTH_BACKOFF_MS);
    continue;
  }
  if (next.kind !== 'success') {
    log('warn', 'get_next_fallo', { kind: next.kind, httpStatus: next.status });
    await sleep(NETWORK_BACKOFF_MS);
    continue;
  }
  if (next.data?.status !== 'turn') continue; // idle → volver a escuchar ya

  await handleTurn(next.data);
}
