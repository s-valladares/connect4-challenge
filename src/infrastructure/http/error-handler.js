/**
 * Middleware de errores: traduce errores de dominio/aplicación a HTTP
 * consistente { ok: false, error, message } sin stack traces al cliente.
 * Owner: Juan (B05).
 */

import { AppError } from '../../application/errors.js';
import { RuleError } from '../../domain/connect4/errors.js';
import { log } from '../../observability/logger.js';

const body = (error, message) => ({ ok: false, error, message });

/** @type {import('express').ErrorRequestHandler} */
// eslint-disable-next-line no-unused-vars -- Express reconoce el handler de errores por sus 4 parámetros.
export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) return res.status(err.status).json(body(err.code, err.message));
  if (err instanceof RuleError) {
    return err.code === 'game_over'
      ? res.status(409).json(body('not_your_turn', err.message))
      : res.status(400).json(body('illegal_move', err.message));
  }
  if (err?.type === 'entity.parse.failed' || err?.type === 'entity.too.large') {
    return res.status(422).json(body('validation', 'El cuerpo debe ser JSON válido y pequeño.'));
  }
  log('error', 'api_unexpected_error', { method: req.method, path: req.path, error: err?.message });
  return res.status(500).json(body('internal', 'Error inesperado.'));
}
