/**
 * LocalGameService: partidas humano vs bot usando EL MISMO engine del torneo.
 * Crea partida, aplica jugada humana validada, responde con jugada del bot,
 * persiste en SQLite (idempotencia por (game_id, turn)) y permite recuperar
 * estado tras refresh. Contrato HTTP en docs/API_LOCAL.md.
 * Owner: Juan (B02).
 */

import { replayMoves, playTurn } from '../domain/connect4/game-state.js';
import { isValidColumn } from '../domain/connect4/rules.js';
import { chooseMove as engineChooseMove } from '../engine/engine-service.js';
import { AppError, AppErrorCodes } from './errors.js';

const isUniqueViolation = (e) => typeof e?.code === 'string' && e.code.startsWith('SQLITE_CONSTRAINT');

/**
 * @param {Object} deps { gameRepository, chooseMove, botBudgetMs, strategy }
 * @returns {{
 *   createGame: (opts: { first: 'human'|'bot' }) => Promise<Object>,
 *   getGame: (gameId: string) => Promise<Object|null>,
 *   playMove: (gameId: string, column: number, opts?: { turn?: number }) => Promise<Object>,
 *   resumePendingBots: () => Promise<string[]>,
 * }}
 */
export function createLocalGameService({
  gameRepository, chooseMove = engineChooseMove, botBudgetMs = 1500, strategy = 'search',
}) {
  const repo = gameRepository;

  function load(gameId) {
    const game = repo.getGame(gameId);
    if (!game) throw new AppError(AppErrorCodes.NOT_FOUND, `La partida ${gameId} no existe.`);
    return { game, state: replayMoves(repo.getMoves(gameId)) };
  }

  /** Forma `state` de docs/API_LOCAL.md. */
  function view(game, state) {
    return {
      board: state.board,
      currentPlayer: state.currentPlayer,
      youAre: game.humanPlayer,
      status: state.status,
      winner: state.winner,
      winningCells: state.winningCells,
      legalMoves: state.legalMoves,
      moves: state.moves,
    };
  }

  /** Jugada del bot sobre `state` con el engine compartido. */
  function botTurn(state) {
    const decision = chooseMove(
      { board: state.board, player: state.currentPlayer, legalMoves: state.legalMoves, timeBudgetMs: botBudgetMs },
      strategy,
    );
    return { next: playTurn(state, decision.column), botMove: { column: decision.column, decision } };
  }

  function persist(gameId, newMoves, state) {
    try {
      repo.appendMoves(gameId, newMoves, { status: state.status, currentPlayer: state.currentPlayer, winner: state.winner });
    } catch (e) {
      if (isUniqueViolation(e)) throw new AppError(AppErrorCodes.NOT_YOUR_TURN, 'Ese turno ya se registró.');
      throw e;
    }
  }

  /** Si le toca al bot, juega y persiste. Devuelve botMove o null. */
  function playBotIfPending(gameId) {
    const { game, state } = load(gameId);
    if (state.status !== 'playing' || state.currentPlayer === game.humanPlayer) return null;
    const { next, botMove } = botTurn(state);
    persist(gameId, [{ turn: next.moves.length, player: state.currentPlayer, column: botMove.column }], next);
    return botMove;
  }

  return {
    async createGame({ first } = {}) {
      if (first !== 'human' && first !== 'bot') {
        throw new AppError(AppErrorCodes.VALIDATION, 'first debe ser "human" o "bot".');
      }
      const gameId = repo.createGame({ humanPlayer: first === 'human' ? 1 : 2 });
      const botMove = playBotIfPending(gameId); // si abre el bot, ya jugó
      const { game, state } = load(gameId);
      return { ok: true, gameId, state: view(game, state), botMove };
    },

    async getGame(gameId) {
      const { game, state } = load(gameId);
      return { ok: true, gameId, state: view(game, state) };
    },

    /**
     * Jugada humana + respuesta del bot. `turn` (opcional) = número de turno que
     * el cliente cree estar jugando: si ya se procesó (doble click) → 409.
     */
    async playMove(gameId, column, { turn } = {}) {
      if (!Number.isInteger(column)) throw new AppError(AppErrorCodes.VALIDATION, 'column debe ser un entero.');
      if (turn !== undefined && !Number.isInteger(turn)) throw new AppError(AppErrorCodes.VALIDATION, 'turn debe ser un entero.');
      const { game, state } = load(gameId);
      if (state.status !== 'playing') throw new AppError(AppErrorCodes.NOT_YOUR_TURN, 'La partida ya terminó.');
      if (state.currentPlayer !== game.humanPlayer) throw new AppError(AppErrorCodes.NOT_YOUR_TURN, 'Espera la jugada del bot.');
      if (turn !== undefined && turn !== state.moves.length + 1) {
        throw new AppError(AppErrorCodes.NOT_YOUR_TURN, 'Esa jugada ya se procesó (turno desactualizado).');
      }
      if (!isValidColumn(column)) throw new AppError(AppErrorCodes.ILLEGAL_MOVE, `La columna ${column} no existe (0 a 7).`);
      if (!state.legalMoves.includes(column)) throw new AppError(AppErrorCodes.ILLEGAL_MOVE, `La columna ${column} está llena.`);

      let next = playTurn(state, column);
      const newMoves = [{ turn: next.moves.length, player: game.humanPlayer, column }];
      let botMove = null;
      if (next.status === 'playing') {
        const bot = botTurn(next);
        next = bot.next;
        botMove = bot.botMove;
        newMoves.push({ turn: next.moves.length, player: 3 - game.humanPlayer, column: botMove.column });
      }
      persist(gameId, newMoves, next);
      return { ok: true, playerMove: { column }, botMove, state: view(game, next) };
    },

    /** Al arrancar la API: reanuda partidas que quedaron esperando al bot. */
    async resumePendingBots() {
      return repo.gamesAwaitingBot().filter((id) => playBotIfPending(id) !== null);
    },
  };
}
