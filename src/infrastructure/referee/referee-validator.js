/**
 * Validación defensiva del payload de turno (shape 1.0.1):
 * board 7×8 con valores 0/1/2, you ∈ {1,2}, legal_moves ⊆ 0..7 coherentes
 * con columnas no llenas, deadline_ms y served_at presentes.
 * NO asumir que los ejemplos del OpenAPI son coherentes (son ilustrativos).
 * Ante discrepancia board vs legal_moves: registrar y reconciliar; nunca
 * publicar columna ilegal. El árbitro es la autoridad.
 * Owner: Salva (A02).
 */

/**
 * @param {unknown} payload Respuesta cruda de GET /api/next
 * @returns {{ ok: true, turn: Object } | { ok: false, reason: string }}
 */
export function validateTurn(payload) {
  throw new Error('TODO(A02): implementar validateTurn');
}
