import { describe, it, expect } from 'vitest';
import { validateTurn } from '../../src/infrastructure/referee/referee-validator.js';
import { ROWS, COLS, createBoard } from '../../src/domain/connect4/board.js';

/** Tablero coherente aplicando gravedad real (fila 0 abajo), alternando 1/2. */
function boardFromMoves(columns) {
  const board = createBoard();
  let player = 1;
  for (const col of columns) {
    const row = board.findIndex((r) => r[col] === 0);
    board[row][col] = player;
    player = player === 1 ? 2 : 1;
  }
  return board;
}

function turnPayload(overrides = {}) {
  const moves = [3, 2, 3, 2, 4];
  return {
    status: 'turn',
    game_id: 'g_test',
    match_id: 'm_1',
    kind: 'league',
    you: 2,
    opponent: 'Rival',
    turn: moves.length + 1,
    board: boardFromMoves(moves),
    moves,
    last_move: { by: 1, column: 4 },
    legal_moves: [0, 1, 2, 3, 4, 5, 6, 7],
    deadline_ms: 3000,
    served_at: '2026-11-05T15:04:05.123Z',
    ...overrides,
  };
}

describe('referee-validator (A02)', () => {
  it('acepta un turno coherente sin warnings', () => {
    const result = validateTurn(turnPayload());
    expect(result.ok).toBe(true);
    expect(result.legalMoves).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(result.warnings).toEqual([]);
  });

  it('rechaza payloads que no son turno', () => {
    expect(validateTurn(null).ok).toBe(false);
    expect(validateTurn({ status: 'idle' }).ok).toBe(false);
    expect(validateTurn(turnPayload({ game_id: '' })).ok).toBe(false);
    expect(validateTurn(turnPayload({ you: 3 })).ok).toBe(false);
  });

  it('rechaza boards con dimensiones o valores inválidos', () => {
    expect(validateTurn(turnPayload({ board: [] })).reason).toBe('board_filas_invalidas');

    const shortRow = turnPayload();
    shortRow.board[2] = shortRow.board[2].slice(0, COLS - 1);
    expect(validateTurn(shortRow).reason).toBe('board_columnas_invalidas');

    const badCell = turnPayload();
    badCell.board[0][0] = 9;
    expect(validateTurn(badCell).reason).toBe('board_valores_invalidos');
  });

  it('rechaza legal_moves fuera de rango o no-array', () => {
    expect(validateTurn(turnPayload({ legal_moves: 'todas' })).reason).toBe('legal_moves_invalido');
    expect(validateTurn(turnPayload({ legal_moves: [0, 8] })).reason).toBe('legal_moves_fuera_de_rango');
  });

  it('usa la intersección cuando legal_moves no coincide con el board', () => {
    // Columna 0 llena de verdad: el árbitro la reporta legal por error.
    const payload = turnPayload();
    for (let row = 0; row < ROWS; row += 1) payload.board[row][0] = row % 2 === 0 ? 1 : 2;
    payload.legal_moves = [0, 1, 2, 3, 4, 5, 6, 7];

    const result = validateTurn(payload);
    expect(result.ok).toBe(true);
    expect(result.legalMoves).not.toContain(0); // jamás jugar columna llena
    expect(result.warnings).toContain('legal_moves_discrepancia_con_board');
  });

  it('falla duro si no queda ningún movimiento coherente', () => {
    const payload = turnPayload({ legal_moves: [5] });
    for (let row = 0; row < ROWS; row += 1) payload.board[row][5] = row % 2 === 0 ? 1 : 2;
    expect(validateTurn(payload).reason).toBe('sin_movimientos_legales_coherentes');
  });

  it('marca warnings de gravedad y paridad sin bloquear', () => {
    const floating = turnPayload();
    floating.board[3][6] = 1; // ficha flotante (fila 0,1,2 de col 6 vacías)
    const r1 = validateTurn(floating);
    expect(r1.ok).toBe(true);
    expect(r1.warnings).toContain('gravedad_incoherente');

    const parity = turnPayload();
    parity.board[0][7] = 2; // dos fichas extra del jugador 2
    parity.board[1][7] = 2;
    const r2 = validateTurn(parity);
    expect(r2.ok).toBe(true);
    expect(r2.warnings).toContain('paridad_incoherente');
  });

  it('degrada con warning si faltan deadline_ms o served_at', () => {
    const result = validateTurn(turnPayload({ deadline_ms: undefined, served_at: 'no-fecha' }));
    expect(result.ok).toBe(true);
    expect(result.warnings).toContain('deadline_ms_ausente_o_invalido');
    expect(result.warnings).toContain('served_at_ausente_o_invalido');
  });

  it('NO valida con la fixture ilustrativa inconsistente del PDF (regla Q01)', () => {
    // El ejemplo del OpenAPI trae board/moves/turn incoherentes: aquí solo
    // verificamos que nuestra validación de paridad lo detectaría como warning.
    const pdfExample = turnPayload({
      board: [
        [0, 0, 1, 2, 1, 0, 0, 0],
        [0, 0, 2, 1, 0, 0, 0, 0],
        [0, 0, 0, 2, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0],
      ],
    });
    const result = validateTurn(pdfExample);
    expect(result.ok).toBe(true); // estructura válida: se juega con defensa doble
    expect(result.warnings.length).toBeGreaterThan(0); // pero queda registrado
  });
});
