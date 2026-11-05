/**
 * Estado de una partida: tablero + turno + historial de columnas jugadas.
 * Permite reconstruir un tablero desde `moves` (como entrega el árbitro).
 * Owner: Jorge (D01/D02), lo consume Juan en local-game-service.
 */

import { createBoard, TOTAL_CELLS } from './board.js';
import { applyMove, getLegalMoves, getNextFreeRow } from './rules.js';
import { findLineAt } from './outcome.js';
import { RuleError, RuleErrorCodes } from './errors.js';

/**
 * @typedef {Object} GameState
 * @property {import('./types.js').Board} board
 * @property {import('./types.js').Player|null} currentPlayer  null cuando la partida terminó.
 * @property {number[]} moves Columnas jugadas desde el inicio, en orden.
 * @property {'playing'|'won'|'draw'} status
 * @property {import('./types.js').Player|null} winner
 * @property {Array<[number, number]>|null} winningCells
 * @property {number[]} legalMoves Columnas jugables ([] si terminó). Campo adicional al plan.
 */

/**
 * @param {import('./types.js').Player} [firstPlayer]
 * @returns {GameState} partida nueva con tablero vacío
 */
export function createGameState(firstPlayer = 1) {
  return {
    board: createBoard(), currentPlayer: firstPlayer, moves: [], status: 'playing',
    winner: null, winningCells: null, legalMoves: [0, 1, 2, 3, 4, 5, 6, 7],
  };
}

/**
 * Jugada del jugador en turno. Devuelve un estado NUEVO.
 * @param {GameState} state
 * @param {number} column
 * @returns {GameState}
 * @throws {RuleError} game_over | illegal_move
 */
export function playTurn(state, column) {
  if (state.status !== 'playing') throw new RuleError(RuleErrorCodes.GAME_OVER, 'La partida ya terminó.');
  const player = state.currentPlayer;
  const board = applyMove(state.board, column, player);
  const row = getNextFreeRow(state.board, column);
  const moves = [...state.moves, column];
  const line = findLineAt(board, row, column);
  if (line) {
    return { board, currentPlayer: null, moves, status: 'won', winner: player, winningCells: line, legalMoves: [] };
  }
  if (moves.length === TOTAL_CELLS) {
    return { board, currentPlayer: null, moves, status: 'draw', winner: null, winningCells: null, legalMoves: [] };
  }
  return {
    board, currentPlayer: player === 1 ? 2 : 1, moves, status: 'playing',
    winner: null, winningCells: null, legalMoves: getLegalMoves(board),
  };
}

/**
 * Reconstruye el estado aplicando la secuencia de columnas desde tablero vacío.
 * Siempre abre el jugador 1 (regla del árbitro).
 * @param {number[]} moves
 * @returns {GameState}
 */
export function replayMoves(moves) {
  return moves.reduce((s, c) => playTurn(s, c), createGameState(1));
}
