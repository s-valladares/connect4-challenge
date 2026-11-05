/**
 * Middleware de errores: traduce errores de dominio/aplicación a HTTP
 * consistente { ok: false, error, message } sin stack traces al cliente.
 * Owner: Juan (B05).
 */

/** @type {import('express').ErrorRequestHandler} */
export function errorHandler(err, req, res, next) {
  // TODO(B05): mapear illegal_move/not_found/validation → 400/404/422, resto 500.
  res.status(500).json({ ok: false, error: 'internal', message: 'TODO(B05)' });
}
