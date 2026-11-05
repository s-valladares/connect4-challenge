/**
 * Ciclo del torneo, testeable sin red: GET /api/next → validar → decidir →
 * POST /api/move UNA vez → clasificar → volver a escuchar.
 * main.js solo arma dependencias desde .env y llama a runWorker.
 * Owner: Salva (A04).
 *
 * Tabla de respuestas (PLAN_BACKEND):
 *   GET idle            → volver a llamar sin pausa
 *   GET turn            → decidir y POST
 *   POST 200            → accepted | won | draw
 *   POST 400 illegal/timeout → partida perdida (no debería pasar): log error
 *   POST 400 validation → log (no penaliza)
 *   POST 409            → ignorar (no penaliza)
 *   401                 → detener con mensaje claro (token mal configurado)
 *   Error de red en GET → backoff corto con jitter y reintento (ausencia 30 s = derrota)
 *   Error de red en POST→ NO repetir a ciegas: reconciliar con GET /api/games/{id}
 */

import { validateTurn } from '../infrastructure/referee/referee-validator.js';
import { RefereeError } from '../infrastructure/referee/referee-client.js';
import { decideTurn } from '../application/turn-orchestrator.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const noopLog = { debug() {}, info() {}, warn() {}, error() {} };

/** Respuesta 200 de POST /api/move → accepted | won | draw. */
export function classifyMoveResponse(body) {
  return body?.state === 'playing' ? 'accepted' : (body?.state ?? 'unknown');
}

/** RefereeError de POST /api/move → resultado para logs y métricas. */
export function classifyMoveError(err) {
  if (err.kind === 'http_400') {
    if (err.body?.error === 'illegal_move') return 'lost_illegal';
    if (err.body?.error === 'timeout') return 'lost_timeout';
    return 'validation';
  }
  if (err.kind === 'http_409') return 'conflict';
  if (err.kind === 'http_401') return 'unauthorized';
  if (err.kind === 'http_423') return 'frozen';
  return 'unknown';
}

/** Tras un POST sin respuesta: ¿el árbitro registró nuestra jugada? */
async function reconcile(client, turn, column, log) {
  try {
    const g = await client.getGame(turn.game_id);
    const ours = g?.moves?.find((m) => m.turn === turn.turn);
    if (ours && ours.column === column) {
      log.info('post_reconciled', { gameId: turn.game_id, turn: turn.turn });
      return 'accepted_reconciled';
    }
  } catch (e) {
    log.warn('reconcile_failed', { gameId: turn.game_id, error: e.message });
  }
  log.warn('post_unknown', { gameId: turn.game_id, note: '/api/next volverá a entregar el turno si sigue pendiente' });
  return 'unknown';
}

/**
 * Procesa una respuesta de GET /api/next. Devuelve un evento para logs y pruebas.
 * @throws {RefereeError} http_401 (fatal)
 */
export async function handleNext(payload, {
  client, log = noopLog, metrics, budgetMs = 1500, strategy = 'search', chooseMove, now = () => performance.now(),
}) {
  const receivedAt = now();
  if (payload?.status === 'idle') {
    metrics?.recordPoll('idle');
    return { kind: 'idle' };
  }
  metrics?.recordPoll('turn');
  const v = validateTurn(payload);
  if (!v.ok) {
    log.warn('turn_skipped', { gameId: payload?.game_id, reason: v.reason });
    return { kind: 'skipped', gameId: payload?.game_id, reason: v.reason };
  }
  const turn = v.turn;
  if (v.issues.length) log.warn('turn_inconsistent', { gameId: turn.game_id, turn: turn.turn, issues: v.issues });

  const { column, decision } = await decideTurn(turn, {
    chooseMove, now, budgetMs, receivedAt, legalMoves: v.safeMoves, strategy,
  });
  const postStart = now();
  let result;
  try {
    result = classifyMoveResponse(await client.postMove(turn.game_id, column));
  } catch (e) {
    if (!(e instanceof RefereeError)) throw e;
    if (e.kind === 'http_401') throw e;
    result = e.kind === 'network' ? await reconcile(client, turn, column, log) : classifyMoveError(e);
  }
  const event = {
    kind: 'moved', result, gameId: turn.game_id, turn: turn.turn, column,
    depth: decision.depthCompleted, decisionMs: decision.elapsedMs, fallback: Boolean(decision.fallbackUsed),
    postMs: Math.round(now() - postStart), totalMs: Math.round(now() - receivedAt),
  };
  metrics?.recordMove({ result, decisionMs: event.decisionMs, totalMs: event.totalMs, fallback: event.fallback });
  log[result.startsWith('lost') ? 'error' : 'info']('move_sent', event);
  return event;
}

/**
 * Escucha hasta que `signal` se aborte (o `maxEvents`, para pruebas).
 * @throws {RefereeError} http_401: token inválido, no tiene sentido seguir
 */
export async function runWorker({
  client, log = noopLog, metrics, signal, budgetMs = 1500, waitSec = 20, strategy = 'search', chooseMove,
  maxEvents = Infinity, backoffMs = 1000, random = Math.random,
}) {
  const events = [];
  let failures = 0;
  while (!signal?.aborted && events.length < maxEvents) {
    try {
      const payload = await client.getNext(waitSec);
      events.push(await handleNext(payload, { client, log, metrics, budgetMs, strategy, chooseMove }));
      failures = 0;
    } catch (e) {
      if (e.kind === 'http_401') throw e;
      failures += 1;
      const wait = Math.min(5000, backoffMs * failures) + Math.floor(random() * 250);
      metrics?.recordError(e.kind ?? 'unexpected');
      log.warn('poll_error', { error: e.message, kind: e.kind ?? 'unexpected', waitMs: wait });
      events.push({ kind: 'error', errorKind: e.kind ?? 'unexpected', message: e.message });
      await sleep(wait);
    }
  }
  return events;
}
