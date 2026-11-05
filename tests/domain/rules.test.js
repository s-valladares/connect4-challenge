/** Reglas (D01–D03, Jorge): gravedad, legalidad, 4 direcciones, empate, validación. */
import { describe, it, expect } from 'vitest';
import {
  createBoard, cloneBoard, validateBoard, isValidBoard, playerToMove, countPieces, serializeBoard, TOTAL_CELLS,
} from '../../src/domain/connect4/board.js';
import { getLegalMoves, getNextFreeRow, applyMove, isValidColumn } from '../../src/domain/connect4/rules.js';
import { checkWinner, isDraw, getOutcome, getGameOutcome } from '../../src/domain/connect4/outcome.js';
import { createGameState, playTurn, replayMoves } from '../../src/domain/connect4/game-state.js';
import { RuleError } from '../../src/domain/connect4/errors.js';
import { patternSequence, allCells } from '../fixtures/helpers.js';

describe('tablero', () => {
  it('cloneBoard copia en profundidad', () => {
    const b = createBoard();
    const c = cloneBoard(b);
    c[0][0] = 1;
    expect(b[0][0]).toBe(0);
  });

  it('validateBoard detecta dimensiones, valores, fichas flotando y conteos imposibles', () => {
    expect(isValidBoard(createBoard())).toBe(true);
    expect(isValidBoard([[0]])).toBe(false);
    const short = createBoard();
    short[2] = [0, 0];
    expect(validateBoard(short).errors[0]).toMatch(/columnas/);
    const floating = createBoard();
    floating[1][0] = 1;
    expect(validateBoard(floating).errors.join()).toMatch(/flotando/);
    const bad = createBoard();
    bad[0][0] = 7;
    expect(validateBoard(bad).errors.join()).toMatch(/Valor inválido/);
    const twos = createBoard();
    twos[0][0] = 2;
    expect(validateBoard(twos).errors.join()).toMatch(/Conteo imposible/);
  });

  it('playerToMove, countPieces y serializeBoard', () => {
    const s = replayMoves([3, 4, 3]);
    expect(countPieces(s.board)).toEqual({ p1: 2, p2: 1, total: 3 });
    expect(playerToMove(s.board)).toBe(2);
    expect(serializeBoard(s.board).split('/').slice(0, 2)).toEqual(['00012000', '00010000']);
  });
});

describe('movimientos', () => {
  it('la ficha cae a la fila libre más baja (fila 0 abajo)', () => {
    const s = replayMoves([3, 3, 3]);
    expect(s.board.map((r) => r[3])).toEqual([1, 2, 1, 0, 0, 0, 0]);
    expect(getNextFreeRow(s.board, 3)).toBe(3);
  });

  it('applyMove devuelve un tablero NUEVO y valida rango, jugador y columna llena', () => {
    const b = createBoard();
    const next = applyMove(b, 0, 1);
    expect(b[0][0]).toBe(0);
    expect(next[0][0]).toBe(1);
    expect(() => applyMove(b, 8, 1)).toThrow(expect.objectContaining({ code: 'illegal_move' }));
    expect(() => applyMove(b, 1.5, 1)).toThrow(RuleError);
    expect(() => applyMove(b, 0, 3)).toThrow(expect.objectContaining({ code: 'invalid_player' }));
    const full = replayMoves([0, 0, 0, 0, 0, 0, 0]).board;
    expect(getNextFreeRow(full, 0)).toBeNull();
    expect(() => applyMove(full, 0, 2)).toThrow(/llena/);
    expect(getLegalMoves(full)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(isValidColumn(7)).toBe(true);
    expect(isValidColumn(-1)).toBe(false);
  });
});

describe('victoria en las cuatro direcciones', () => {
  it.each([
    ['horizontal', [4, 4, 5, 5, 6, 6, 7], [[0, 4], [0, 5], [0, 6], [0, 7]]],
    ['vertical', [0, 1, 0, 1, 0, 1, 0], [[0, 0], [1, 0], [2, 0], [3, 0]]],
    ['diagonal ascendente', [0, 1, 1, 2, 2, 3, 2, 3, 3, 7, 3], [[0, 0], [1, 1], [2, 2], [3, 3]]],
    ['diagonal descendente', [7, 6, 6, 5, 5, 4, 5, 4, 4, 0, 4], [[0, 7], [1, 6], [2, 5], [3, 4]]],
  ])('%s', (_, moves, cells) => {
    const s = replayMoves(moves);
    expect(s.status).toBe('won');
    expect(s.winner).toBe(1);
    expect(s.winningCells).toEqual(cells);
    expect(checkWinner(s.board)).toEqual({ winner: 1, winningCells: cells });
  });

  it('gana también el jugador 2; 52 casillas del patrón siguen en juego', () => {
    expect(replayMoves([7, 0, 7, 1, 6, 2, 6, 3]).winner).toBe(2);
    expect(replayMoves(patternSequence(allCells()).slice(0, 52)).status).toBe('playing');
  });

  it('una línea de 5 devuelve 4 celdas y no hay falsos positivos', () => {
    expect(replayMoves([0, 0, 1, 1, 3, 3, 4, 4, 2]).winningCells).toHaveLength(4);
    expect(checkWinner(replayMoves([0, 1, 2, 3]).board)).toBeNull();
  });
});

describe('empate y estado', () => {
  it('56 casillas sin ganador = empate', () => {
    const s = replayMoves(patternSequence(allCells()));
    expect(s.moves).toHaveLength(TOTAL_CELLS);
    expect(s.status).toBe('draw');
    expect(isDraw(s.board)).toBe(true);
    expect(getOutcome(s.board)).toEqual({ status: 'draw', winner: null, winningCells: null });
  });

  it('getOutcome en juego y en victoria', () => {
    expect(getOutcome(createBoard())).toEqual({ status: 'playing', winner: null, winningCells: null });
    expect(getGameOutcome(replayMoves([0, 1, 0, 1, 0, 1, 0]).board).winner).toBe(1);
  });

  it('playTurn alterna, guarda columnas y no permite jugar tras terminar', () => {
    let s = createGameState();
    s = playTurn(s, 3);
    expect(s.currentPlayer).toBe(2);
    expect(s.moves).toEqual([3]);
    expect(createGameState(2).currentPlayer).toBe(2);
    const done = replayMoves([0, 1, 0, 1, 0, 1, 0]);
    expect(done.currentPlayer).toBeNull();
    expect(done.legalMoves).toEqual([]);
    expect(() => playTurn(done, 5)).toThrow(expect.objectContaining({ code: 'game_over' }));
  });
});
