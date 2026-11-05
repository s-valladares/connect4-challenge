/**
 * Registra la entrega oficial (R04): URL del repo + hash del commit final.
 * Uso: npm run submit -- <repo_url> [commit]
 * Si no se pasa commit, usa el HEAD actual (git rev-parse HEAD).
 * DEBE ejecutarse antes de las 09:45; el último registro es el que vale.
 */
import 'dotenv/config';
import { execSync } from 'node:child_process';

const repoUrl = process.argv[2];
const commit = process.argv[3] ?? execSync('git rev-parse HEAD').toString().trim();

if (!repoUrl) {
  console.error('Uso: npm run submit -- <repo_url> [commit]');
  process.exit(1);
}

const res = await fetch(`${process.env.ARBITRO_URL}/api/me/submission`, {
  method: 'PUT',
  headers: {
    Authorization: `Bearer ${process.env.TEAM_TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ repo_url: repoUrl, commit }),
});

console.log(res.status, await res.json());
