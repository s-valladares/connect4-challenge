/**
 * Validación defensiva del payload de turno (shape 1.0.1):
 * board 7×8 con valores 0/1/2, you ∈ {1,2}, legal_moves ⊆ 0..7 coherentes
 * con columnas no llenas, deadline_ms y served_at presentes.
 * NO asumir que los ejemplos del OpenAPI son coherentes (son ilustrativos).
 * Ante discrepancia board vs legal_moves: registrar y reconciliar; nunca
 * publicar columna ilegal. El árbitro es la autoridad.
 * Owner: Salva (A02).
 */

import { validateBoard, playerToMove } from '../../domain/connect4/board.js';
import { getLegalMoves, isValidColumn } from '../../domain/connect4/rules.js';
import { replayMoves } from '../../domain/connect4/game-state.js';

const REQUIRED = ['game_id', 'you', 'board', 'moves', 'legal_moves', 'deadline_ms', 'served_at'];

/**
 * - ok:false (fatal) → no se puede jugar: no es turno, faltan campos, you inválido, legal_moves vacío.
 * - ok:true → se juega. `issues` lista inconsistencias (para log) y `safeMoves`
 *   son las columnas de legal_moves libres en el board (si no queda ninguna, legal_moves).
 * @param {unknown} payload Respuesta cruda de GET /api/next
 * @returns {{ ok: true, turn: Object, issues: string[], safeMoves: number[] } | { ok: false, reason: string }}
 */
export function validateTurn(payload) {
  if (!payload || payload.status !== 'turn') return { ok: false, reason: 'No es un turno.' };
  const missing = REQUIRED.filter((k) => !(k in payload));
  if (missing.length) return { ok: false, reason: `Faltan campos: ${missing.join(', ')}.` };
  if (payload.you !== 1 && payload.you !== 2) return { ok: false, reason: `you inválido: ${payload.you}.` };
  if (!Array.isArray(payload.legal_moves) || payload.legal_moves.length === 0) {
    return { ok: false, reason: 'legal_moves vacío: no se emite jugada.' };
  }
  const legal = payload.legal_moves.filter(isValidColumn);
  if (legal.length === 0) return { ok: false, reason: 'legal_moves sin columnas válidas (0..7).' };

  const issues = [];
  if (legal.length !== payload.legal_moves.length) issues.push('legal_moves trae columnas fuera de 0..7 (ignoradas).');
  const v = validateBoard(payload.board);
  if (!v.valid) return { ok: true, turn: payload, issues: [...issues, ...v.errors], safeMoves: legal };

  const free = getLegalMoves(payload.board);
  const full = legal.filter((c) => !free.includes(c));
  if (full.length) issues.push(`legal_moves incluye columnas llenas según el tablero: ${full.join(',')}`);
  const toMove = playerToMove(payload.board);
  if (toMove !== payload.you) issues.push(`Por el conteo de fichas le toca al jugador ${toMove}, pero you=${payload.you}.`);
  try {
    const rebuilt = replayMoves(payload.moves);
    if (JSON.stringify(rebuilt.board) !== JSON.stringify(payload.board)) issues.push('El tablero no coincide con moves.');
  } catch (e) {
    issues.push(`moves no es una secuencia válida: ${e.message}`);
  }
  const safe = legal.filter((c) => free.includes(c));
  return { ok: true, turn: payload, issues, safeMoves: safe.length ? safe : legal };
}
