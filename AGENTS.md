# AGENTS.md — REGLAS PARA IA Y DESARROLLADORES

## Principios
- JavaScript puro ESM y JSDoc; no TypeScript sin aprobación explícita.
- Planes backend/frontend se versionan ANTES de cualquier código.
- Modularidad por dominio, aplicación e infraestructura sin overengineering.
- Las reglas y la búsqueda NO importan HTTP, Express, SQLite, React ni variables de entorno.
- Un único Game Engine sirve al torneo y al juego humano; no duplicar lógica.
- No agregar AWS, microservicios, WebSocket oficial ni BD externa sin requisito comprobado.

## Invariantes
- Tablero: 7 filas × 8 columnas; `board[fila][columna]`; fila 0 inferior; columnas 0..7.
- `0` vacío, `1` jugador que abre, `2` el que responde.
- Una decisión de movimiento siempre es legal; validar contra `legalMoves` antes de POST.
- Nunca emitir un movimiento si `legalMoves` está vacío.
- Reservar margen respecto al deadline del árbitro; el engine recibe `timeBudgetMs` local.
- El worker no puede depender de consultas a SQLite ni IA remota para responder.
- Token exclusivamente en variables de entorno (`.env`), nunca commits/logs/UI.
- Solo una instancia worker por token.
- No usar los ejemplos inconsistentes del OpenAPI como fixtures válidas (confirmado por Edson: son ilustrativos).
- `GET /api/games` devuelve lista SIN board; la partida individual sí tiene board.
- En `Game.players`, utilizar `team_id` como identificador, no `id`.

## Estructura y ownership
```
src/domain/connect4/     reglas puras 8×7            → Jorge
src/engine/              estrategias y búsqueda       → Jorge
src/application/         orquestador y game service   → Salva / Juan
src/infrastructure/      árbitro HTTP, SQLite, API    → Salva / Juan
src/worker/              loop long polling npm run bot→ Salva
src/training/            self-play y benchmarks       → Alex / Jorge
src/observability/       logs y métricas              → Salva
web/                     React + Vite                 → América
tests/                   suite Vitest + mock árbitro  → Alex
scripts/                 practice, submission, health → Salva / Alex
docs/                    TECNICO, MANUAL, ADR, etc.   → todos
```
Contratos congelados: `src/engine/types.js` (`MoveContext`/`MoveDecision`) y
`docs/API_LOCAL.md` (API humana). Cambiarlos requiere acuerdo de los owners.

## Comandos
- `npm install` — instala raíz y `web/` (workspaces).
- `npm test` — suite única con cobertura (Vitest). Debe pasar antes de cada merge.
- `npm run bot` — worker contra el árbitro (usa `.env`).
- `npm run api` — API local de juego humano en `PORT`.
- `npm run dev:web` — frontend Vite con proxy `/api` → `localhost:3000`.
- `npm run practice|submit|health` — scripts del día del evento.

## Desarrollo
1. Cada tarea requiere aceptación y dependencia claras (ver tablero del sprint).
2. IA debe escribir tests para comportamiento crítico y evitar hardcoding de fixtures.
3. Cada PR ejecuta `npm test` y anota evidencia de integración.
4. Agentes de revisión buscan casos límite, carreras, bloqueo del event loop y timeouts.
5. Documentar toda decisión que cambie el plan y todo error corregido en `docs/AI_DECISIONS.md`.
6. No afirmar funcionalidades que solo existen como switches vacíos.
7. Mantener commits reales y comprensibles; no reescribir historia de planes.

## APIs
- Oficial: únicamente endpoints del OpenAPI 1.1.0 servido por el árbitro (`docs/arbitro-openapi.json`).
- Interna: JSON local independiente del árbitro; validación y errores consistentes.
- SSE solo para monitoreo visual si se implementa; NO reemplaza long polling oficial.
