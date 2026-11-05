/**
 * Rutas de la API local (contrato en docs/API_LOCAL.md):
 *   POST /api/local-games            crear partida { first: 'human'|'bot' }
 *   GET  /api/local-games/:id        estado + moves (recuperación tras refresh)
 *   POST /api/local-games/:id/moves  jugada humana → respuesta con jugada del bot
 *   GET  /api/health                 { ok: true }
 * Owner: Juan (B01/B02). Congelar contrato con América antes de implementar.
 */

import { Router } from 'express';

/** Express 4 no captura errores de funciones async: los pasamos a next(). */
const handle = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

/**
 * @param {Object} deps { localGameService }
 * @returns {import('express').Router}
 */
export function createRoutes({ localGameService }) {
  const router = Router();

  router.get('/api/health', (req, res) => res.json({ ok: true }));

  router.post('/api/local-games', handle(async (req, res) => {
    res.status(201).json(await localGameService.createGame({ first: req.body?.first }));
  }));

  router.get('/api/local-games/:id', handle(async (req, res) => {
    res.json(await localGameService.getGame(req.params.id));
  }));

  router.post('/api/local-games/:id/moves', handle(async (req, res) => {
    const { column, turn } = req.body ?? {};
    res.json(await localGameService.playMove(req.params.id, column, { turn }));
  }));

  return router;
}
