/**
 * Flujo A (Q04, Alex): cliente de la web (web/src/api/client.js) → API Express →
 * engine → respuesta. Mismo contrato docs/API_LOCAL.md de punta a punta, sin mocks.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { openDatabase } from '../../src/infrastructure/persistence/sqlite.js';
import { createGameRepository } from '../../src/infrastructure/persistence/game-repository.js';
import { createLocalGameService } from '../../src/application/local-game-service.js';
import { createApp } from '../../src/infrastructure/http/app.js';
import { createApiClient } from '../../web/src/api/client.js';

let server;
let api;
beforeAll(async () => {
  const svc = createLocalGameService({ gameRepository: createGameRepository(openDatabase(':memory:')), botBudgetMs: 20 });
  server = createApp({ localGameService: svc }).listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  api = createApiClient({ baseUrl: `http://127.0.0.1:${server.address().port}/api` });
});
afterAll(() => new Promise((r) => server.close(r)));

describe('React → API → Game Engine → React', () => {
  it('una partida completa humano vs bot llega a victoria o empate confirmada por el servidor', async () => {
    expect(await api.checkHealth()).toEqual({ ok: true });
    let { gameId, state } = await api.createGame({ first: 'human' });
    while (state.status === 'playing') {
      const column = state.legalMoves[0]; // "humano" ingenuo: primera columna libre
      ({ state } = await api.playMove(gameId, column, { turn: state.moves.length + 1 }));
    }
    expect(['won', 'draw']).toContain(state.status);
    if (state.status === 'won') expect(state.winningCells).toHaveLength(4);
    expect((await api.getGame(gameId)).state).toEqual(state);
    await expect(api.playMove(gameId, 0, { turn: state.moves.length + 1 })).rejects.toMatchObject({ code: 'not_your_turn' });
  });

  it('el bot abre y los errores llegan normalizados al cliente', async () => {
    const { gameId, state, botMove } = await api.createGame({ first: 'bot' });
    expect(state.moves).toEqual([botMove.column]);
    await expect(api.playMove(gameId, 12, { turn: 2 })).rejects.toMatchObject({ status: 400, code: 'illegal_move' });
    await expect(api.getGame('lg_nada')).rejects.toMatchObject({ status: 404, code: 'not_found' });
  });
});
