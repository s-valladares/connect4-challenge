/**
 * Consulta la salud del árbitro y verifica el token (O03, R02).
 * Uso: npm run health
 * - GET /api/health (público): fase y hora del torneo.
 * - GET /api/me (Bearer): valida token y muestra turnos pendientes.
 */
import 'dotenv/config';

const base = process.env.ARBITRO_URL;

const health = await fetch(`${base}/api/health`);
console.log('health:', health.status, await health.json());

const me = await fetch(`${base}/api/me`, {
  headers: { Authorization: `Bearer ${process.env.TEAM_TOKEN}` },
});
console.log('me:', me.status, await me.json());
