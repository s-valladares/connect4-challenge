/**
 * MockReferee (Q03, Alex): emula el árbitro OpenAPI 1.0.1 SIN red real.
 * Debe poder simular:
 * - GET /api/next: idle, turn (con wait/long polling simulado), secuencias
 *   de turnos para una partida completa.
 * - POST /api/move: accepted playing/won/draw, 400 illegal_move, 400 timeout,
 *   400 validation, 401, 409 not_your_turn/unknown_game, cortes de conexión.
 * Implementación sugerida: objeto con la misma interfaz que referee-client
 * (inyección de dependencias) o servidor http local efímero para E2E (Q05).
 *
 * Las fixtures provienen de tests/fixtures (coherentes, ver su README).
 */

export function createMockReferee(script = []) {
  throw new Error('TODO(Q03): implementar createMockReferee');
}
