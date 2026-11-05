/**
 * Self-play local reproducible — entry point de `npm run train`.
 * Enfrenta estrategias (random/basic/search) N partidas con seed,
 * alternando quién abre; registra win/loss/draw, tiempos y profundidades.
 * Proceso SEPARADO del worker: no compite por CPU durante la liga.
 *
 *   npm run train -- --games 20 --seed 7 --a search --b basic --budget 50 [--save]
 * Sin --a/--b corre la matriz: search-basic, search-random, basic-random.
 * --save guarda corrida y resultados en SQLite (DB_PATH) vía training-repository.
 * Owner: Alex (T01).
 */

import 'dotenv/config';
import { runMatchup, parseArgs } from './arena.js';

const args = parseArgs(process.argv.slice(2));
const opts = { games: args.games ?? 10, seed: args.seed ?? 7, budgetMs: args.budget ?? 50 };
const pairs = args.a && args.b ? [[args.a, args.b]] : [['search', 'basic'], ['search', 'random'], ['basic', 'random']];

let save = null;
if (args.save) {
  const { openDatabase } = await import('../infrastructure/persistence/sqlite.js');
  const { createTrainingRepository } = await import('../infrastructure/persistence/training-repository.js');
  const repo = createTrainingRepository(openDatabase(process.env.DB_PATH ?? './data/local.db'));
  const runId = repo.startRun({ config: { pairs, ...opts }, seed: opts.seed, games: opts.games * pairs.length });
  save = { repo, runId };
}

const rows = pairs.map(([a, b]) => runMatchup(a, b, {
  ...opts,
  onGame: save && ((g) => save.repo.saveResult(save.runId, {
    gameIndex: g.index, firstStrategy: g.first, secondStrategy: g.second, winner: g.winner, plies: g.plies,
    illegal: g.illegal, maxMs: Math.max(0, ...g.times.flat()),
  })),
}));
console.table(rows);
if (save) {
  save.repo.finishRun(save.runId, rows);
  console.log(`Guardado en training_runs id=${save.runId}`);
}
if (rows.some((r) => r.illegal > 0)) {
  console.error('ATENCIÓN: hubo jugadas ilegales.');
  process.exitCode = 1;
}
