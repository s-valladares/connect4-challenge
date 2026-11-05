/**
 * Métricas en memoria del worker: último GET, último turno atendido,
 * duración de cálculo, códigos HTTP del POST, errores por tipo, uptime.
 * Expuestas por logs periódicos y/o GET /api/diagnostics local (O03/O04).
 * Owner: Salva (O01) / Alex (O03).
 */

// TODO(O01): contador/gauge simples en un objeto exportado + snapshot().
