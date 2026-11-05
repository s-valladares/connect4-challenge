/** Persistencia SQLite (B03/B04, Juan): migraciones, transacción, idempotencia por (game_id, turn). */
import { describe, it, expect } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../../src/infrastructure/persistence/sqlite.js';
import { migrate, MIGRATIONS } from '../../src/infrastructure/persistence/migrations.js';
import { createGameRepository } from '../../src/infrastructure/persistence/game-repository.js';

describe('SQLite', () => {
  it('crea las 5 tablas del plan y las migraciones son idempotentes', () => {
    const db = openDatabase(':memory:');
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name);
    expect(tables).toEqual(expect.arrayContaining(['local_games', 'local_moves', 'training_runs', 'training_results', 'referee_observations']));
    migrate(db);
    expect(db.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get().n).toBe(MIGRATIONS.length);
  });

  it('archivo en disco con WAL; crea la carpeta si falta', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'c4-')), 'sub', 'local.db');
    const db = openDatabase(path);
    expect(db.pragma('journal_mode', { simple: true })).toBe('wal');
    db.close();
  });
});

describe('game-repository', () => {
  it('crea, guarda jugadas en transacción y recupera columnas en orden', () => {
    const repo = createGameRepository(openDatabase(':memory:'));
    const id = repo.createGame({ humanPlayer: 1 });
    expect(id).toMatch(/^lg_/);
    expect(repo.getGame(id)).toMatchObject({ id, humanPlayer: 1, status: 'playing', currentPlayer: 1 });
    repo.appendMoves(id, [{ turn: 1, player: 1, column: 3 }, { turn: 2, player: 2, column: 4 }], { status: 'playing', currentPlayer: 1, winner: null });
    expect(repo.getMoves(id)).toEqual([3, 4]);
    expect(repo.getGame('nada')).toBeNull();
  });

  it('turno repetido viola (game_id, turn) y NO guarda nada de esa transacción', () => {
    const repo = createGameRepository(openDatabase(':memory:'));
    const id = repo.createGame({ humanPlayer: 1 });
    repo.appendMoves(id, [{ turn: 1, player: 1, column: 3 }], { status: 'playing', currentPlayer: 2, winner: null });
    expect(() => repo.appendMoves(id, [{ turn: 2, player: 2, column: 0 }, { turn: 1, player: 1, column: 5 }], { status: 'won', currentPlayer: null, winner: 1 }))
      .toThrow(expect.objectContaining({ code: expect.stringMatching(/^SQLITE_CONSTRAINT/) }));
    expect(repo.getMoves(id)).toEqual([3]);
    expect(repo.getGame(id).status).toBe('playing');
  });

  it('gamesAwaitingBot lista partidas donde le toca al bot', () => {
    const repo = createGameRepository(openDatabase(':memory:'));
    const human = repo.createGame({ humanPlayer: 1 });
    const bot = repo.createGame({ humanPlayer: 2 });
    expect(repo.gamesAwaitingBot()).toEqual([bot]);
    expect(repo.gamesAwaitingBot()).not.toContain(human);
  });
});
