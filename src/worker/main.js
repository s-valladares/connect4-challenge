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
 * Owner: Salva (A04).
 */

import 'dotenv/config';

const ARBITRO_URL = process.env.ARBITRO_URL;
const TEAM_TOKEN = process.env.TEAM_TOKEN;

if (!ARBITRO_URL || !TEAM_TOKEN) {
  console.error('Faltan ARBITRO_URL o TEAM_TOKEN en el entorno (.env).');
  process.exit(1);
}

// TODO(A04): crear refereeClient, loop long polling con manejo de idle/turn,
// decideTurn, POST único y métricas. Ver cliente de referencia en las bases.
console.error('TODO(A04): worker no implementado aún.');
process.exit(1);
