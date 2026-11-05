# API local de juego humano — CONTRATO (B01)

> Owners: Juan (backend) + América (frontend). Congelar ANTES de implementar
> B02/F02. Cambios posteriores se anotan aquí con fecha.
> Esta API es nuestra (no la prescribe el árbitro) y NO participa del torneo.

Base: `http://localhost:3000` (el dev server de Vite hace proxy de `/api`).
Formato de error uniforme: `{ "ok": false, "error": "<código>", "message": "..." }`.

## POST /api/local-games
Crea una partida humano vs bot.
```jsonc
// request
{ "first": "human" }          // "human" | "bot": quién abre
// 201 response
{
  "ok": true,
  "gameId": "lg_abc123",
  "state": {
    "board": [[0,0,0,0,0,0,0,0], "… 7 filas, fila 0 abajo"],
    "currentPlayer": 1,
    "youAre": 1,              // número del humano en esta partida
    "status": "playing",      // playing | won | draw
    "winner": null,
    "winningCells": null,
    "legalMoves": [0,1,2,3,4,5,6,7],
    "moves": []
  },
  "botMove": null             // si el bot abre: { column, decision } y state ya lo refleja
}
```

## GET /api/local-games/:id
Estado completo para recuperación tras refresh. `200 { ok, gameId, state }`,
`404 { ok:false, error:"not_found" }`.

## POST /api/local-games/:id/moves
Jugada humana; el servidor valida, aplica, y si la partida sigue responde
también la jugada del bot (mismo engine del torneo).
```jsonc
// request
{ "column": 3 }
// 200 response
{
  "ok": true,
  "playerMove": { "column": 3 },
  "botMove": { "column": 4 },  // null si la jugada humana cerró la partida
  "state": { "…igual que arriba, ya con ambas jugadas" }
}
// 400: { ok:false, error:"illegal_move" }  columna llena/fuera de rango
// 409: { ok:false, error:"not_your_turn" } p. ej. doble click / partida cerrada
```

## GET /api/health
`200 { "ok": true }` — para ConnectionStatus del frontend.

## Decisiones de contrato
- El frontend NUNCA calcula reglas: `legalMoves`, `status` y `winningCells` siempre vienen del servidor.
- Doble click: el servidor es idempotente por turno; el segundo intento recibe 409.
- `winningCells` usa [fila, columna] con fila 0 abajo (igual que el árbitro).
