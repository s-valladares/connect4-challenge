# Fixtures — REGLA CRÍTICA (Q01, Alex)

**NO copiar el ejemplo de turno del OpenAPI/PDF como fixture válida.** Edson
confirmó (04/11) que ese ejemplo es ilustrativo y sus datos (board/moves/turn/you)
son inconsistentes entre sí.

Toda fixture de tablero debe:
1. Generarse aplicando movimientos desde tablero vacío (gravedad real).
2. Respetar paridad de fichas: count(1) == count(2) o count(1) == count(2) + 1.
3. Tener `legal_moves` coherentes con las columnas no llenas del board.

Generador recomendado: `replayMoves()` de `src/domain/connect4/game-state.js`.
