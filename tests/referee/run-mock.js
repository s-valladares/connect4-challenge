/**
 * `npm run mock` — árbitro falso por HTTP para ensayar sin internet (Q05, Alex).
 * En otra terminal: ARBITRO_URL=http://localhost:4100 TEAM_TOKEN=token-dev npm run bot
 * Variables: MOCK_PORT (4100), MOCK_TOKEN (token-dev), MOCK_MOVE_LATENCY_MS (0),
 *            MOCK_LEAGUE_GAMES (0), MOCK_PHASE (practice | frozen).
 */
import { createRefereeMockServer } from './mock-referee-server.js';

const env = process.env;
const token = env.MOCK_TOKEN ?? 'token-dev';
const mock = createRefereeMockServer({
  token,
  moveLatencyMs: Number(env.MOCK_MOVE_LATENCY_MS ?? 0),
  scheduleLeague: Number(env.MOCK_LEAGUE_GAMES ?? 0),
  phase: env.MOCK_PHASE ?? 'practice',
});
const url = await mock.listen(Number(env.MOCK_PORT ?? 4100));
console.log(`Árbitro mock en ${url} (token: ${token}, fase: ${mock.state.phase}).`);
console.log(`Latencia de POST: ${mock.state.chaos.moveLatencyMs} ms · partidas de liga programadas: ${env.MOCK_LEAGUE_GAMES ?? 0}.`);
console.log(`Crear práctica: curl -X POST ${url}/api/practice -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -d '{"opponent":"casa-basico","first":1}'`);

// Resumen cada 10 s para ver el "torneo" avanzar.
setInterval(() => {
  const all = [...mock.games.values()];
  const done = all.filter((g) => g.result);
  const won = done.filter((g) => g.result.winner === g.teamSide).length;
  if (all.length) console.log(`[mock] partidas: ${all.length} · terminadas: ${done.length} · ganadas por el equipo: ${won}`);
}, 10_000).unref();
