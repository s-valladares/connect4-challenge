/**
 * Validación defensiva del payload de turno (shape 1.0.1).
 * El árbitro es la autoridad: las validaciones protegen al worker de payloads
 * rotos, no lo corrigen. Regla de oro: NUNCA derivar una jugada ilegal.
 *
 * ok:false (fail duro)  → estructura inválida o sin movimientos coherentes: no jugar.
 * warnings (degradado)  → incoherencias no bloqueantes (se registran y se sigue).
 * legalMoves efectivos  → intersección entre legal_moves recibidas y las columnas
 *                         realmente no llenas según el board (defensa doble).
 * Owner: Salva (A02).
 */

import { ROWS, COLS } from '../../domain/connect4/board.js';

/**
 * @param {unknown} payload Respuesta cruda de GET /api/next con status "turn".
 * @returns {{ ok: true, turn: Object, legalMoves: number[], warnings: string[] }
 *         | { ok: false, reason: string }}
 */
export function validateTurn(payload) {
  const fail = (reason) => ({ ok: false, reason });
  const warnings = [];

  if (payload === null || typeof payload !== 'object') return fail('payload_no_es_objeto');
  const turn = /** @type {Record<string, any>} */ (payload);

  if (turn.status !== 'turn') return fail(`status_inesperado:${String(turn.status)}`);
  if (typeof turn.game_id !== 'string' || turn.game_id === '') return fail('game_id_invalido');
  if (turn.you !== 1 && turn.you !== 2) return fail('you_invalido');

  const { board } = turn;
  if (!Array.isArray(board) || board.length !== ROWS) return fail('board_filas_invalidas');
  for (const row of board) {
    if (!Array.isArray(row) || row.length !== COLS) return fail('board_columnas_invalidas');
    for (const cell of row) {
      if (cell !== 0 && cell !== 1 && cell !== 2) return fail('board_valores_invalidos');
    }
  }

  if (!Array.isArray(turn.legal_moves)) return fail('legal_moves_invalido');
  const received = [...new Set(turn.legal_moves)];
  for (const col of received) {
    if (!Number.isInteger(col) || col < 0 || col >= COLS) return fail('legal_moves_fuera_de_rango');
  }

  // Defensa doble: columnas legales según el board (fila superior vacía).
  const localLegal = [];
  for (let col = 0; col < COLS; col += 1) {
    if (board[ROWS - 1][col] === 0) localLegal.push(col);
  }
  const effective = localLegal.filter((col) => received.includes(col));

  if (
    received.length !== localLegal.length ||
    !received.every((col) => localLegal.includes(col))
  ) {
    warnings.push('legal_moves_discrepancia_con_board');
  }
  if (effective.length === 0) return fail('sin_movimientos_legales_coherentes');

  // Coherencias no bloqueantes: gravedad y paridad de fichas.
  for (let col = 0; col < COLS; col += 1) {
    for (let row = 1; row < ROWS; row += 1) {
      if (board[row][col] !== 0 && board[row - 1][col] === 0) {
        warnings.push('gravedad_incoherente');
        break;
      }
    }
    if (warnings.includes('gravedad_incoherente')) break;
  }
  let count1 = 0;
  let count2 = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell === 1) count1 += 1;
      else if (cell === 2) count2 += 1;
    }
  }
  if (count1 - count2 !== 0 && count1 - count2 !== 1) warnings.push('paridad_incoherente');

  // Cruces board↔moves↔you (el ejemplo ilustrativo del PDF falla justo aquí).
  if (Array.isArray(turn.moves) && turn.moves.length !== count1 + count2) {
    warnings.push('moves_incoherentes_con_board');
  }
  const expectedDiff = turn.you === 2 ? 1 : 0; // si nos toca como 2, el 1 ya jugó una más
  if (count1 - count2 !== expectedDiff) {
    warnings.push('you_incoherente_con_paridad');
  }

  if (!Number.isInteger(turn.deadline_ms) || turn.deadline_ms <= 0) {
    warnings.push('deadline_ms_ausente_o_invalido'); // el orquestador usará presupuesto conservador
  }
  if (typeof turn.served_at !== 'string' || Number.isNaN(Date.parse(turn.served_at))) {
    warnings.push('served_at_ausente_o_invalido');
  }

  return { ok: true, turn, legalMoves: effective, warnings };
}
