/**
 * Servidor Express de la API local (juego humano). Entry point: npm run api.
 * Monta routes.js + error-handler.js (vía app.js). Puerto de env PORT (default 3000).
 * Mantener este archivo delgado: la lógica vive en application/, no aquí.
 * Owner: Juan (B02).
 */

import 'dotenv/config';
import { openDatabase } from '../persistence/sqlite.js';
import { createGameRepository } from '../persistence/game-repository.js';
import { createLocalGameService } from '../../application/local-game-service.js';
import { createApp } from './app.js';
import { log } from '../../observability/logger.js';

const port = Number(process.env.PORT ?? 3000);
const db = openDatabase(process.env.DB_PATH ?? './data/local.db');
const localGameService = createLocalGameService({
  gameRepository: createGameRepository(db),
  botBudgetMs: Number(process.env.SEARCH_BUDGET_MS ?? 1500), // mismo presupuesto que el torneo
});

const resumed = await localGameService.resumePendingBots();
createApp({ localGameService }).listen(port, '127.0.0.1', () => {
  log('info', 'api_listening', { url: `http://localhost:${port}`, resumed });
});
