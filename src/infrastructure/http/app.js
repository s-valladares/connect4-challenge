/**
 * Construye la app Express SIN escuchar en un puerto (las pruebas la levantan
 * en un puerto efímero). server.js la arranca con la configuración de .env.
 * Owner: Juan (B02).
 */

import express from 'express';
import { createRoutes } from './routes.js';
import { errorHandler } from './error-handler.js';

/** @param {{ localGameService: ReturnType<import('../../application/local-game-service.js').createLocalGameService> }} deps */
export function createApp({ localGameService }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '10kb' }));
  app.use(createRoutes({ localGameService }));
  app.use((req, res) => res.status(404).json({ ok: false, error: 'not_found', message: `Ruta desconocida: ${req.method} ${req.path}` }));
  app.use(errorHandler);
  return app;
}
