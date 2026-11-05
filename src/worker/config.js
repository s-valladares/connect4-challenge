/**
 * Configuración del worker desde variables de entorno (.env, ver .env.example).
 * El token nunca va en el repo ni en los logs.
 * Owner: Salva (A04).
 */

const int = (v, d) => (v === undefined || v === '' ? d : Number.parseInt(v, 10));

export function loadConfig(env = process.env) {
  return {
    arbitroUrl: env.ARBITRO_URL ?? '',
    teamToken: env.TEAM_TOKEN ?? '',
    budgetMs: int(env.SEARCH_BUDGET_MS, 1500), // presupuesto LOCAL de búsqueda (deadline oficial 3000 ms)
    waitSec: int(env.POLL_WAIT_SEC, 20), // long polling: wait=20 (máximo del árbitro: 25)
    strategy: env.BOT_STRATEGY ?? 'search',
  };
}
