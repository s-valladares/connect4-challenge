# Documentación técnica

> Entregable oficial (X01). Describe la ARQUITECTURA FINAL real, no la planeada. Las desviaciones del plan están
> explicadas en la sección 5, y el uso de IA en [`AI_DECISIONS.md`](AI_DECISIONS.md).

## 1. Arquitectura final

```text
                ┌──────────────── src/engine ─────────────────────────┐
                │ engine-service.chooseMove(MoveContext) → MoveDecision │  ← ÚNICO punto de entrada
                │ strategies/{basic,search} · negamax · bitboard ·      │
                │ evaluator · move-ordering · tactics · transposition   │
                └───────────▲────────────────────────────▲─────────────┘
                            │                            │
      src/application/turn-orchestrator         src/application/local-game-service
      (decideTurn: presupuesto + fallback)      (partida humana, mismo engine)
                            ▲                            ▲
      src/worker/run-worker (ciclo)             src/infrastructure/http (Express)
      src/infrastructure/referee (HTTP)         src/infrastructure/persistence (SQLite)
                            ▲                            ▲
                  Árbitro oficial                   web/ (React + Vite, proxy /api)

   src/domain/connect4: reglas puras (sin HTTP, BD, React ni variables de entorno). Las usan todos.
```

| Proceso | Comando | Entrada | Qué hace |
|---|---|---|---|
| Bot del torneo | `npm run bot` | `src/worker/main.js` | Long polling `GET /api/next?wait=20` → `decideTurn` → `POST /api/move` |
| API local | `npm run api` | `src/infrastructure/http/server.js` | `/api/local-games` para la web, SQLite en `DB_PATH` |
| Web | `npm run dev:web` | `web/` (Vite) | React; proxy `/api` → `localhost:3000` |

El bot y la API son procesos distintos, pero llaman al **mismo** `chooseMove` con el **mismo** presupuesto
(`SEARCH_BUDGET_MS`), como piden las bases: el algoritmo del torneo y el de la app son el mismo código. El worker no
usa SQLite ni IA remota para responder.

| Capa | Carpeta | Responsable |
|---|---|---|
| Reglas | `src/domain/connect4/` | Jorge |
| Algoritmo | `src/engine/` | Jorge |
| Cliente del árbitro + worker | `src/infrastructure/referee/`, `src/application/turn-orchestrator.js`, `src/worker/` | Salva |
| API local + SQLite | `src/application/local-game-service.js`, `src/infrastructure/{http,persistence}/` | Juan |
| Web | `web/` | América |
| Pruebas y mock | `tests/` | Edgar |

## 2. Algoritmo

### 2.1 Tablero en bits (`src/engine/bitboard.js`)
Técnica de Pascal Pons adaptada de 7×6 a 8×7. Cada columna ocupa 8 bits: 7 filas + **1 bit centinela** siempre vacío,
que evita que 3 fichas arriba de una columna + 1 abajo de la siguiente parezcan una vertical. 8 × 8 = 64 bits → `BigInt`.
Una posición = `cur` (fichas del que mueve) + `mask` (todas las fichas). La matriz `board[fila][columna]` del árbitro
se convierte con `Position.fromBoard` y las reglas puras de `src/domain` siguen trabajando sobre la matriz.

| Operación | Fórmula |
|---|---|
| Jugar en `c` | `cur ^= mask; mask \|= mask + bottom(c)` |
| ¿4 en línea? | `m = p & (p >> s); m & (m >> 2s)` con `s` = 1 (vertical), 8 (horizontal), 7 y 9 (diagonales) |
| Casillas que ganan | `winningSpots(p, mask)` |

### 2.2 Búsqueda (`src/engine/negamax.js`)
Negamax con poda alfa-beta. En cada nodo, antes de buscar:
1. ¿Gano en una jugada? → `WIN_SCORE − jugadas` (prefiere ganar antes y perder después).
2. **Filtro de jugadas perdedoras** (`tactics.js`): si el rival tiene una amenaza inmediata, solo se considera
   bloquearla; si tiene dos, la posición está perdida; nunca se juega justo debajo de una casilla ganadora del rival.
3. A profundidad 0 → heurística.

Orden de exploración (`move-ordering.js`): jugada guardada en la tabla de transposición → jugadas que crean más amenazas
→ centro hacia afuera `3, 4, 2, 5, 1, 6, 0, 7` (con 8 columnas el centro es doble).

Tabla de transposición (`transposition-table.js`): `Map` con clave `cur + mask` que guarda profundidad, valor, tipo de
cota (`EXACT/LOWER/UPPER`) y mejor jugada. Se vacía al llegar a 1.000.000 de entradas. Hay una sola instancia por
proceso, así que lo calculado en una jugada se reaprovecha en la siguiente.

### 2.3 Heurística (`src/engine/evaluator.js`)
```text
puntaje = 10 × (amenazas abiertas propias − del rival) + Σ peso(columna) × (fichas propias − del rival)
pesos por columna = 1, 2, 3, 4, 4, 3, 2, 1   (las de borde, peso 1, se omiten por rendimiento)
```
Una amenaza abierta es una casilla vacía que completaría 4 en línea. Es determinista y se puede explicar con un tablero
en la mano. **No hay bonificación de paridad**: la regla de filas impares de Allis (pensada para 7×6) empeoró al bot en
8×7 en la simulación previa de Jorge (5 victorias, 1 empate y 14 derrotas contra la versión sin paridad).

### 2.4 Manejo del tiempo
- El árbitro da **3.000 ms desde `served_at`**. No restamos relojes de máquinas distintas, porque el reloj local puede
  estar desfasado: medimos desde que **recibimos** el turno y reservamos **1.000 ms** para red y POST
  (`computeBudget` en `src/application/turn-orchestrator.js`).
- Presupuesto = `min(SEARCH_BUDGET_MS = 1500, 3000 − 1000 − ya usado)`, mínimo 50 ms.
- **Iterative deepening**: profundidad 1, 2, 3…; se guarda la mejor jugada de cada profundidad **completa**. El reloj se
  revisa cada 1.024 nodos y, si se acaba, devuelve la última profundidad completa. Si encuentra un resultado forzado,
  se detiene antes.
- **Fallback legal en tres capas**: `searchStrategy` cae a `basicStrategy` (ganar, bloquear, centro);
  `engine-service` atrapa excepciones y columnas ilegales; `decideTurn` vuelve a verificar `column ∈ legal_moves` justo
  antes del POST.

## 3. Protocolo con el árbitro (`src/worker/run-worker.js`)

| Respuesta | Acción |
|---|---|
| `GET /api/next` → `idle` | Volver a preguntar de inmediato |
| `GET /api/next` → `turn` | `validateTurn` → `decideTurn` → **un solo** `POST /api/move` |
| `POST` 200 | `accepted` / `won` / `draw` |
| `POST` 400 `illegal_move` / `timeout` | Partida perdida (no debería pasar): log de error |
| `POST` 400 `validation` | Log; no penaliza |
| `POST` 409 | Ignorar; no penaliza |
| 401 | Detener con mensaje claro: el token está mal configurado |
| Error de red en GET | Backoff de 1 a 5 s con jitter (si un turno espera 30 s sin recogerse, se pierde) |
| Error de red en POST | **No** repetir a ciegas (el árbitro pudo haberla procesado): reconciliar con `GET /api/games/{id}` |

Turnos inconsistentes (`referee-validator.js`): el árbitro es la autoridad. Se juega solo en columnas de `legal_moves`
que además estén libres en el `board`. El ejemplo de turno del OpenAPI/PDF es inconsistente (8 jugadas, 6 fichas), por
eso no se usa como fixture válida.

Una sola instancia por token: `src/worker/singleton-lock.js` crea un archivo de bloqueo con el PID; del token solo se
guarda un hash. Los logs ocultan el token (`createLogger({ secrets })`).

**Contrato servido el día del evento.** El árbitro (`https://ai-challenge.yompi.com`) publica el OpenAPI **1.1.0**, no la
1.0.1 de las bases. Se comparó campo por campo: el único cambio es `PATCH /api/me` (renombrar al equipo). El bot no
necesitó cambios.

## 4. Pruebas y cobertura

`npm test` corre todas las suites con cobertura V8: **10 archivos, 105 pruebas**, todas en verde (incluye la API local
del PR #3). El CI de GitHub corre `npm test` y `npm run build:web` en cada PR y en cada push a `main`.

| Carpeta | Sentencias | Ramas | Funciones | Líneas |
|---|---|---|---|---|
| src/domain/connect4 (reglas) | 96.4 | 98.9 | 95.0 | 96.3 |
| src/engine (algoritmo) | 92.0 | 95.0 | 88.6 | 92.0 |
| src/engine/strategies | 100 | 100 | 100 | 100 |
| src/application | 100 | 98.1 | 93.8 | 100 |
| src/infrastructure/http | 100 | 95.5 | 100 | 100 |
| src/infrastructure/persistence | 93.9 | 95.7 | 90.0 | 93.9 |
| src/infrastructure/referee | 100 | 98.1 | 100 | 100 |
| src/worker | 98.9 | 96.0 | 87.5 | 98.9 |
| web/src (todas) | 98.6–100 | 83.3–100 | 87.5–100 | 98.6–100 |
| **Total** | **96.9** | **96.2** | **93.3** | **96.9** |

Las bases piden ≥ 70 % en reglas y algoritmo: se cumple con margen. Fuera de cobertura (solo leen `.env` y llaman
módulos probados): `src/worker/main.js`, `src/infrastructure/http/server.js` y `web/src/main.jsx`.

Qué cubren las pruebas, según lo que piden las bases:
- **Reglas** (`tests/domain/`): caída de fichas, jugadas legales, las cuatro direcciones de victoria y empate.
- **Algoritmo** (`tests/engine/`): nunca devuelve una jugada ilegal (80 tableros aleatorios reproducibles), respeta el
  presupuesto (1.500 ms → responde en menos de 2.000 ms con profundidad ≥ 8), gana si puede y bloquea, tableros límite.
- **Cliente del árbitro** (`tests/referee/`, `tests/worker/`): interpreta `turn`/`idle`, construye el POST y clasifica
  400/401/409 y errores de red, con el árbitro simulado.
- **API y web** (`tests/infrastructure/`, `tests/application/`, `tests/web/`): contrato HTTP, doble clic, recuperación
  tras recargar y estados de la interfaz.

**Ensayo del worker por HTTP** (05/11, contra el árbitro simulado de la versión de referencia, 4 partidas de liga + 2
prácticas contra `casa-basico`): 35 jugadas en 45 s, 0 fallbacks, 0 errores, profundidad 11–17 por jugada.

## 5. Decisiones y desviaciones del plan

| Fecha | Qué cambió | Por qué | Evidencia |
|---|---|---|---|
| 05/11 | **Express** en vez de Fastify (PLAN_BACKEND ADR-03) | Familiaridad del equipo y de las IAs de código (`docs/ADR.md` ADR-06). Sin CORS porque Vite hace proxy | `src/infrastructure/http/` |
| 05/11 | Estructura `src/` por capas + `web/` (el plan hablaba de `apps/` y `packages/`) | Un paquete Node con dos entry points, sin ceremonia de workspaces (ADR-10) | `AGENTS.md` §Estructura |
| 05/11 | Se agregaron `bitboard.js` y `tactics.js` a `src/engine/` | Buscar sobre matrices copiaba el tablero en cada nodo; con bits se llega a profundidad 11–17 en 1,5 s | `tests/engine/engine.test.js` |
| 05/11 | Heurística = amenazas + peso por columna (no ventanas 500/60/10), sin paridad | Probado en la simulación previa; la paridad de 7×6 empeoró al bot | `src/engine/evaluator.js` |
| 05/11 | `negamax()` revisa victoria inmediata en la raíz | La prueba de profundidad fija falló: los hijos no detectan que el padre ya ganó | `AI_DECISIONS.md` #1 |
| 05/11 | El presupuesto se mide desde que se recibe el turno, no restando `served_at` | Evita depender de que el reloj de la laptop coincida con el del árbitro | `turn-orchestrator.js` |
| 05/11 | Worker separado en `run-worker.js`, `config.js` y `singleton-lock.js` | `main.js` solo arma dependencias; el ciclo se prueba sin red | `tests/worker/` |
| 05/11 | Logger con `createLogger`/`configureLogger` y redacción de secretos | La API necesita capturar logs en pruebas y el worker debe ocultar el token | `src/observability/logger.js` |
| 05/11 | API local: `turn` opcional en `POST /moves`; 422 `validation` | Sin número de turno, un doble clic no se distingue de una jugada nueva | `docs/API_LOCAL.md` §Cambios |
| 05/11 | Web de una sola pantalla: sin router (`/history`, `/about`), sin selector de dificultad ni vista de torneo | El contrato no tiene listado de partidas; la app debe usar el mismo algoritmo del torneo; la vista de torneo era opcional (P2) | `web/src/pages/GamePage.jsx` |
| 05/11 | La web numera columnas 1–8 (la API usa 0–7) | Para personas; el manual lo aclara | `docs/MANUAL.md` |
| 05/11 | Contrato del árbitro 1.1.0 en vez de 1.0.1 | Es el que sirve el árbitro real; solo agrega `PATCH /api/me` | Sección 3 |
| — | Sin pondering, sin asesor por LLM, sin SSE de telemetría (ADR-10/11 del plan) | Eran opcionales (P2) y fuera del camino crítico; no hay flags que finjan tenerlos | `.env.example` |

**Pendientes al congelar** (no se presentan como funcionalidad): `src/training/{self-play,benchmark,tuners}.js` y
`src/worker/supervisor.js` siguen como stubs; `npm run mock` depende del árbitro simulado que entrega QA (P5).

## 6. Fuentes
- Pascal Pons, *Solving Connect Four*: http://blog.gamesolver.org · https://github.com/PascalPons/connect4
- John Tromp, *Connect Four Playground* (8×7 = gana el primer jugador): https://tromp.github.io/c4/c4.html
- Christophe Steininger, *c4* (solver de tableros grandes): https://github.com/ChristopheSteininger/c4
- Victor Allis, *A Knowledge-based Approach of Connect-Four*: https://tromp.github.io/c4/connect4_thesis.pdf
