/**
 * Benchmarks entre estrategias — entry point de `npm run benchmark`.
 * Matriz: search vs basic, search vs random, basic vs random + tiempo y
 * profundidad del engine en posiciones fijas con el presupuesto del torneo.
 * Resultados REALES y repetibles → docs/BENCHMARKS.md (no inventar métricas).
 *
 *   npm run benchmark -- --games 20 --seed 42 --budget 50 --position-budget 1500
 * Owner: Alex (T02).
 */

import { writeFileSync } from 'node:fs';
import { runMatchup, runSearchBenchmark, parseArgs } from './arena.js';

const args = parseArgs(process.argv.slice(2));
const games = args.games ?? 20;
const seed = args.seed ?? 42;
const budgetMs = args.budget ?? 50;
const positionBudget = args['position-budget'] ?? 1500;

const matrix = [['search', 'basic'], ['search', 'random'], ['basic', 'random']]
  .map(([a, b]) => runMatchup(a, b, { games, seed, budgetMs }));
console.table(matrix);
const positions = runSearchBenchmark({ budgetMs: positionBudget, repeats: 3 });
console.table(positions);

const cmd = `npm run benchmark -- --games ${games} --seed ${seed} --budget ${budgetMs} --position-budget ${positionBudget}`;
const md = [
  '# Benchmarks',
  '',
  '> T02 (Alex). SOLO resultados reales y reproducibles (semilla + comando).',
  '> Si un número no salió de una corrida, no va aquí ni en la exposición.',
  '',
  `Generado el ${new Date().toISOString()} · Node ${process.versions.node} · ${process.platform}/${process.arch}.`,
  '',
  '## Matriz',
  `Cada fila: ${games} partidas alternando quién abre, 2 primeras jugadas al azar (semilla ${seed}), ${budgetMs} ms por jugada. Tiempos y profundidad = de la estrategia de la izquierda.`,
  '',
  '| Enfrentamiento | Partidas | Seed | V/E/D | Ilegales | p50 ms | p95 ms | Prof. media |',
  '|---|---|---|---|---|---|---|---|',
  ...matrix.map((r) => `| ${r.a} vs ${r.b} | ${r.games} | ${seed} | ${r.winsA}/${r.draws}/${r.winsB} | ${r.illegal} | ${r.p50Ms} | ${r.p95Ms} | ${r.avgDepth} |`),
  '',
  '## Engine en posiciones fijas',
  `searchStrategy con ${positionBudget} ms (presupuesto del torneo, SEARCH_BUDGET_MS), 3 repeticiones, TT nueva en cada una.`,
  '',
  '| Posición | Jugadas previas | p50 ms | p95 ms | máx ms | Profundidad mín. | Nodos/s |',
  '|---|---|---|---|---|---|---|',
  ...positions.map((r) => `| ${r.name} | ${r.plies} | ${r.p50} | ${r.p95} | ${r.max} | ${r.depth} | ${r.nodesPerSec.toLocaleString('es')} |`),
  '',
  '## Comando',
  '```bash',
  cmd,
  '```',
  '',
  '## Observaciones',
  '- Profundidad 0 = victoria inmediata o única jugada (no hace falta buscar).',
  '- Tiempo bajo con profundidad alta = la búsqueda encontró un resultado forzado y se detuvo.',
  '- Ilegales debe ser 0 siempre: es requisito, no métrica.',
].join('\n');
writeFileSync(new URL('../../docs/BENCHMARKS.md', import.meta.url), `${md}\n`);
console.log('docs/BENCHMARKS.md actualizado.');
