# Registro de uso de IA

> X03 (América) + todos. La exposición pide casos REALES: qué se pidió a la IA,
> qué devolvió mal, cómo se detectó y corrigió. Mínimo 2 con evidencia. No inventar.
> Las entradas 1–4 vienen de la versión de referencia construida con Claude Code antes del evento;
> cada integrante agrega las suyas del jueves con el mismo formato.

## Formato de entrada
- **Fecha/tarea:**
- **Herramienta y prompt (resumen):**
- **Qué devolvió:**
- **Error o riesgo detectado:**
- **Cómo se detectó (test/review/benchmark):**
- **Corrección aplicada (commit):**

## Entradas

### 1. Negamax a profundidad fija no veía la victoria en la raíz
- **Fecha/tarea:** 05/11 · E02 `negamax(params)` (Jorge).
- **Herramienta y prompt:** Claude Code: "llena el stub `negamax({ board, player, depth, alpha, beta, isTimeUp })` reutilizando el Searcher".
- **Qué devolvió:** un envoltorio que llamaba a `searchRoot` directamente.
- **Error detectado:** con una victoria disponible en una jugada, devolvía la columna 3 en vez de 2 o 6. Los nodos hijos no detectan que el padre ya ganó; en la estrategia eso lo tapaba `findImmediateWin`, pero el contrato público quedaba roto.
- **Cómo se detectó:** prueba `negamax a profundidad fija encuentra la victoria` (`tests/engine/engine.test.js`).
- **Corrección:** `searchRoot` revisa `winningSpots(cur) & possible()` antes de explorar.

### 2. La prueba del reloj asumía que se revisa en cada nodo
- **Fecha/tarea:** 04/11 · E03 iterative deepening.
- **Herramienta y prompt:** Claude Code: "prueba que la búsqueda respeta el presupuesto".
- **Qué devolvió:** una prueba con presupuesto de 1 ms que esperaba profundidad 0.
- **Error detectado:** el reloj se revisa cada 1.024 nodos (a propósito, por rendimiento); la profundidad 1 termina antes del primer chequeo. La prueba era incorrecta, no el código.
- **Cómo se detectó:** la prueba falló de forma reproducible; se leyó `checkClock`.
- **Corrección:** reloj inyectado que devuelve 0 y luego infinito; se verifica que devuelve la última profundidad completa.

### 3. `performance.now` perdía su `this`
- **Fecha/tarea:** 04/11 · A03 presupuesto del worker.
- **Herramienta y prompt:** Claude Code: "permite inyectar el reloj en las pruebas".
- **Qué devolvió:** `(now ?? performance.now)()`.
- **Error detectado:** `TypeError: Illegal invocation` en ejecución real (en pruebas siempre se inyectaba `now`).
- **Cómo se detectó:** ensayo del worker contra el mock.
- **Corrección:** `now ?? (() => performance.now())`.

### 4. Posiciones de benchmark imposibles
- **Fecha/tarea:** 04/11 · T02 benchmarks.
- **Herramienta y prompt:** Claude Code: "agrega posiciones de medio juego para medir profundidad".
- **Qué devolvió:** secuencias de jugadas escritas a mano.
- **Error detectado:** algunas ya tenían un ganador antes de la última jugada (no son posiciones reales).
- **Cómo se detectó:** `replayMoves` lanzó `game_over` al reconstruirlas.
- **Corrección:** se usan prefijos del patrón sin 4 en línea (`BENCHMARK_POSITIONS` en `src/training/arena.js`).

### 5. Las pruebas de la web dependían en silencio del motor (P1)
- **Fecha/tarea:** 05/11 · F01–F04, PR `feat/p4-web` (América).
- **Herramienta y prompt:** Claude Code: "arma mi rama P4 desde el anexo de mi rol sobre `main` y verifica que pase solo".
- **Qué devolvió:** el código de la web y `tests/web/web.test.jsx` tal como venían del anexo, que en la copia completa del
  repo (P1–P5) pasaban 13/13.
- **Error o riesgo detectado:** sobre `main` sin P1, 8 de 13 pruebas fallan. Los componentes no importan nada del motor,
  pero el helper `apiState()` de las pruebas arma los tableros con `replayMoves` de `src/domain/connect4/game-state.js`.
  La guía del rol decía que P4 "solo necesita P0 y P1", pero no que el CI del PR quedaría rojo hasta que entrara P1.
- **Cómo se detectó:** se corrió `npm test` en la rama limpia antes de abrir el PR, en vez de confiar en la corrida
  sobre la copia con todo integrado.
- **Corrección aplicada:** se mantuvo el helper (los tableros de prueba salen de las reglas reales, no de matrices
  escritas a mano) y el PR declara la dependencia: se mergea después de P1.

### 6. El mock del árbitro no respetaba el contrato de `GET /api/games`, y el árbitro real salió en 1.1.0
- **Fecha/tarea:** 05/11 · revisión de contratos antes de integrar (América, con apoyo de Claude Code).
- **Herramienta y prompt:** Claude Code: "contrasta lo que llevamos con el OpenAPI 1.0.1 y las bases".
- **Qué devolvió (la IA, en la versión de referencia del mock):** `GET /api/games` → `{ "games": [ ... ] }`.
- **Error o riesgo detectado:** el OpenAPI 1.0.1 define la respuesta como **arreglo plano** de `GameSummary`. Las pruebas del
  mock validaban la forma equivocada, así que pasaban. Además, el árbitro real (`https://ai-challenge.yompi.com`) sirve
  la versión **1.1.0**, no la 1.0.1: el único cambio es `PATCH /api/me` para renombrar al equipo; no afecta al bot.
- **Cómo se detectó:** lectura del esquema en el OpenAPI frente al código del mock, y `diff` del `/api/openapi.json` servido
  por el árbitro contra el archivo 1.0.1.
- **Corrección:** parche para `tests/referee/mock-referee-server.js` y su prueba (arreglo plano + `Array.isArray`), con
  128/128 pruebas en verde en la copia integrada. Aplicado en el PR de P5 (`feat/p5-mock-training`) junto con
  `docs/arbitro-openapi.json` 1.1.0.

> Entradas 7–10: casos reales de la integración del jueves (07:00–08:00). Cada uno está en un módulo distinto; su
> responsable lo revisa y lo completa con su propio prompt si lo tiene.

### 7. Una prueba del orquestador dependía de que el motor siguiera sin implementar
- **Fecha/tarea:** 05/11 · A03 `turn-orchestrator` (Salva) al integrar P1 (Jorge).
- **Herramienta y prompt:** prueba del scaffold armado con IA, titulada "cae al fallback si el engine lanza (estado actual:
  stubs TODO)".
- **Qué devolvió:** una prueba que **no inyectaba** un motor roto; confiaba en que el stub `TODO` de `engine-service` lanzara.
- **Error o riesgo detectado:** en cuanto entró el motor real, la prueba falló (62/63), aunque el código estaba bien. Probaba
  el estado del repo, no el comportamiento.
- **Cómo se detectó:** se corrió `npm test` con P1 aplicado sobre `main` antes de abrir el PR.
- **Corrección aplicada:** la prueba inyecta `chooseMove` que lanza (`'engine roto'`); entró con el PR #4 → 63/63.

### 8. La API dependía de una función del logger que todavía no existía en `main`
- **Fecha/tarea:** 05/11 · B05 API local (Juan), PR #3.
- **Herramienta y prompt:** Claude Code (sesión de América): "revisa qué falta para mergear el PR #3".
- **Qué devolvió:** la prueba `error inesperado → 500 sin stack trace` usaba `configureLogger`, que solo existía en el
  logger de la versión de referencia; el logger escrito a mano en `main` solo exportaba `log()`.
- **Error o riesgo detectado:** el PR #3 fallaba 1/97 sobre `main`. Las guías por rol se generaron con IA asumiendo que
  todas las piezas venían del mismo repositorio de referencia; al mezclar código escrito a mano con código de los anexos,
  las piezas no encajaban.
- **Cómo se detectó:** merge de prueba de P3 sobre `main` y `npm test`.
- **Corrección aplicada:** el PR #6 (worker de referencia) trajo el logger con `createLogger`/`configureLogger` y redacción
  del token; P3 se actualizó con `main` → 105/105 y se mergeó.

### 9. Las pruebas de integración del anexo de QA importaban un worker que no estaba en el repo
- **Fecha/tarea:** 05/11 · Q05 pruebas de integración y mock (Edgar), P5.
- **Herramienta y prompt:** código del anexo de QA, generado con IA junto con la guía del rol.
- **Qué devolvió:** `tests/integration/worker-referee.test.js` y `tests/referee/mock-referee.test.js` importan
  `src/worker/run-worker.js` y `tests/fixtures/turns.js`, que pertenecen al worker de referencia (P2).
- **Error o riesgo detectado:** mientras `main` tenía el primer worker escrito a mano, esas pruebas no cargaban, y el
  README ya prometía `npm run mock`, `npm run train` y `npm run benchmark`, que en `main` eran stubs.
- **Cómo se detectó:** se aplicó el anexo de QA sobre `main` en una copia aparte y se corrió `npm test`.
- **Corrección aplicada:** con el worker de referencia en `main` (#6), P5 entra limpio: 128/128, `npm run mock`,
  `train` y `benchmark` funcionan; `docs/BENCHMARKS.md` se regeneró con una corrida real.

### 10. Al pasar a la versión 1.1.0 del contrato, la IA actualizó la prueba pero no el mock en memoria
- **Fecha/tarea:** 05/11 · P5, ajuste al OpenAPI 1.1.0 (América con Claude Code).
- **Herramienta y prompt:** Claude Code: "aplica el contrato 1.1.0 al mock y sus pruebas".
- **Qué devolvió:** un reemplazo de texto que cambió **las dos** aserciones `version === '1.0.1'` a `'1.1.0'`, pero
  `tests/referee/mock-referee.js` (mock en memoria) seguía devolviendo `'1.0.1'`.
- **Error o riesgo detectado:** 1/128 en rojo. El cambio era mecánico y la IA no revisó de dónde salía cada valor.
- **Cómo se detectó:** se corrió la suite completa antes del commit, no solo el archivo editado.
- **Corrección aplicada:** el mock en memoria devuelve `'1.1.0'` → 128/128.

### 11. (pendiente — cada integrante agrega el suyo con el mismo formato)
