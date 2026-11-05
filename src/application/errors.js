/**
 * Errores de aplicación con código y HTTP del contrato docs/API_LOCAL.md.
 * Formato de respuesta: { ok: false, error: <code>, message }.
 * Owner: Juan (B05).
 */

export const AppErrorCodes = Object.freeze({
  VALIDATION: 'validation', // 422: cuerpo mal formado (first, column o turn con tipo inválido)
  ILLEGAL_MOVE: 'illegal_move', // 400: columna fuera de rango o llena
  NOT_FOUND: 'not_found', // 404: la partida no existe
  NOT_YOUR_TURN: 'not_your_turn', // 409: turno del bot, partida cerrada o turno ya procesado (doble click)
});

const STATUS = { validation: 422, illegal_move: 400, not_found: 404, not_your_turn: 409 };

export class AppError extends Error {
  /** @param {string} code uno de AppErrorCodes @param {string} message */
  constructor(code, message) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS[code] ?? 500;
  }
}
