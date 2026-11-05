/**
 * Error de reglas con código estable. La capa HTTP lo traduce a su respuesta
 * (docs/API_LOCAL.md); el dominio no conoce códigos HTTP.
 * Owner: Jorge (D02).
 */

export const RuleErrorCodes = Object.freeze({
  ILLEGAL_MOVE: 'illegal_move', // columna fuera de 0..7, no entera o llena
  INVALID_PLAYER: 'invalid_player', // jugador distinto de 1 o 2
  GAME_OVER: 'game_over', // la partida ya terminó
});

export class RuleError extends Error {
  /** @param {string} code uno de RuleErrorCodes @param {string} message */
  constructor(code, message) {
    super(message);
    this.name = 'RuleError';
    this.code = code;
  }
}
