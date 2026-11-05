/**
 * LocalGameService: partidas humano vs bot usando EL MISMO engine del torneo.
 * Crea partida, aplica jugada humana validada, responde con jugada del bot,
 * persiste en SQLite (idempotencia por (game_id, turn)) y permite recuperar
 * estado tras refresh. Contrato HTTP en docs/API_LOCAL.md.
 * Owner: Juan (B02).
 */

/**
 * @param {Object} deps { gameRepository, chooseMove }
 * @returns {{
 *   createGame: (opts: { first: 'human'|'bot' }) => Promise<Object>,
 *   getGame: (gameId: string) => Promise<Object|null>,
 *   playMove: (gameId: string, column: number) => Promise<Object>,
 * }}
 */
export function createLocalGameService(deps) {
  throw new Error('TODO(B02): implementar createLocalGameService');
}
