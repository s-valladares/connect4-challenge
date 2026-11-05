/** LocalGameService (B02, Juan): mismo engine, validación, turnos, idempotencia y recuperación. */
import { describe, it, expect, vi } from 'vitest';
import { openDatabase } from '../../src/infrastructure/persistence/sqlite.js';
import { createGameRepository } from '../../src/infrastructure/persistence/game-repository.js';
import { createLocalGameService } from '../../src/application/local-game-service.js';
import { chooseMove } from '../../src/engine/engine-service.js';

const setup = (opts = {}) => {
  const repo = createGameRepository(openDatabase(':memory:'));
  return { repo, svc: createLocalGameService({ gameRepository: repo, botBudgetMs: 30, ...opts }) };
};

describe('crear y consultar', () => {
  it('abre el humano: tablero vacío, youAre 1, sin botMove', async () => {
    const { svc } = setup();
    const r = await svc.createGame({ first: 'human' });
    expect(r).toMatchObject({ ok: true, botMove: null, state: { youAre: 1, currentPlayer: 1, status: 'playing', moves: [], winningCells: null } });
    expect(r.state.legalMoves).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect((await svc.getGame(r.gameId)).state.board).toHaveLength(7);
  });

  it('abre el bot: ya jugó y state lo refleja', async () => {
    const { svc } = setup();
    const r = await svc.createGame({ first: 'bot' });
    expect(r.state).toMatchObject({ youAre: 2, currentPlayer: 2 });
    expect(r.state.moves).toEqual([r.botMove.column]);
    expect(r.botMove.decision.strategy).toBe('search');
  });

  it('validación de first y partida inexistente', async () => {
    const { svc } = setup();
    await expect(svc.createGame({ first: 'yo' })).rejects.toMatchObject({ code: 'validation', status: 422 });
    await expect(svc.createGame()).rejects.toMatchObject({ code: 'validation' });
    await expect(svc.getGame('nada')).rejects.toMatchObject({ code: 'not_found', status: 404 });
  });
});

describe('jugar', () => {
  it('jugada humana → responde el bot con el MISMO engine del torneo', async () => {
    const spy = vi.fn(chooseMove);
    const { svc } = setup({ chooseMove: spy });
    const { gameId } = await svc.createGame({ first: 'human' });
    const r = await svc.playMove(gameId, 3, { turn: 1 });
    expect(r).toMatchObject({ ok: true, playerMove: { column: 3 } });
    expect(r.state.moves).toEqual([3, r.botMove.column]);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ player: 2, timeBudgetMs: 30 }), 'search');
  });

  it('errores: tipo inválido (422), fuera de rango o llena (400), turno del bot o cerrada (409)', async () => {
    const { svc, repo } = setup({ chooseMove: () => ({ column: 0 }) });
    const { gameId } = await svc.createGame({ first: 'human' });
    await expect(svc.playMove(gameId, '3')).rejects.toMatchObject({ code: 'validation' });
    await expect(svc.playMove(gameId, 3, { turn: 'x' })).rejects.toMatchObject({ code: 'validation' });
    await expect(svc.playMove(gameId, 8)).rejects.toMatchObject({ code: 'illegal_move', status: 400 });
    // El bot falso siempre juega 0: humano y bot alternan en la columna 0 (sin 4 seguidas)
    // hasta 6 fichas; luego el humano juega 1 y el bot pone la 7.ª: columna 0 llena.
    for (let i = 0; i < 3; i++) await svc.playMove(gameId, 0);
    await svc.playMove(gameId, 1); // 7ª ficha en col 0 la pone el bot
    expect(repo.getMoves(gameId).filter((c) => c === 0)).toHaveLength(7);
    await expect(svc.playMove(gameId, 0)).rejects.toThrow(/llena/);
    const botTurn = repo.createGame({ humanPlayer: 2 });
    await expect(svc.playMove(botTurn, 3)).rejects.toMatchObject({ code: 'not_your_turn', status: 409 });
  });

  it('doble click: el mismo turno dos veces → 409 y no se aplica dos veces', async () => {
    const { svc, repo } = setup();
    const { gameId } = await svc.createGame({ first: 'human' });
    await svc.playMove(gameId, 3, { turn: 1 });
    await expect(svc.playMove(gameId, 3, { turn: 1 })).rejects.toMatchObject({ code: 'not_your_turn' });
    expect(repo.getMoves(gameId)).toHaveLength(2);
  });

  it('carrera en la BD (PK game_id+turn) se traduce a 409; otros errores se propagan', async () => {
    const base = createGameRepository(openDatabase(':memory:'));
    const id = base.createGame({ humanPlayer: 1 });
    const clash = { ...base, appendMoves: () => { throw Object.assign(new Error('UNIQUE'), { code: 'SQLITE_CONSTRAINT_PRIMARYKEY' }); } };
    await expect(createLocalGameService({ gameRepository: clash, botBudgetMs: 10 }).playMove(id, 3)).rejects.toMatchObject({ code: 'not_your_turn' });
    const broken = { ...base, appendMoves: () => { throw new Error('disco lleno'); } };
    await expect(createLocalGameService({ gameRepository: broken, botBudgetMs: 10 }).playMove(id, 3)).rejects.toThrow('disco lleno');
  });

  it('partida terminada: winningCells del servidor y 409 al seguir jugando', async () => {
    const { svc } = setup({ chooseMove: () => ({ column: 7 }) });
    const { gameId } = await svc.createGame({ first: 'human' });
    let r;
    for (let i = 0; i < 4; i++) r = await svc.playMove(gameId, 0);
    expect(r.state).toMatchObject({ status: 'won', winner: 1, currentPlayer: null, legalMoves: [] });
    expect(r.state.winningCells).toHaveLength(4);
    expect(r.botMove).toBeNull();
    await expect(svc.playMove(gameId, 1)).rejects.toMatchObject({ code: 'not_your_turn' });
  });
});

describe('recuperación', () => {
  it('resumePendingBots juega el turno pendiente del bot (API caída a media partida)', async () => {
    const { svc, repo } = setup();
    const id = repo.createGame({ humanPlayer: 2 }); // creada sin jugada del bot
    expect(await svc.resumePendingBots()).toEqual([id]);
    expect(repo.getMoves(id)).toHaveLength(1);
    expect(await svc.resumePendingBots()).toEqual([]);
  });
});
