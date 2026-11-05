# Cuatro en Línea 8×7 — Equipo 5

Bot autónomo para el torneo (cliente HTTP del árbitro) + aplicación web para jugar
contra el mismo engine. Ver `PLAN_BACKEND.md`, `PLAN_FRONTEND.md` y `AGENTS.md`.

## Requisitos
- Node.js >= 20.19 (probado con 24.x)

## Instalación
```bash
npm install          # instala backend y web/ (workspaces)
cp .env.example .env # completar ARBITRO_URL y TEAM_TOKEN el día del evento
```

## Comandos
| Comando | Qué hace |
|---|---|
| `npm test` | **Comando único de pruebas** con cobertura (Vitest) |
| `npm run bot` | Worker del torneo: long polling al árbitro y envío de jugadas |
| `npm run api` | API local para el juego humano (`PORT`, default 3000) |
| `npm run dev:web` | Frontend React/Vite (proxy `/api` → `localhost:3000`) |
| `npm run train` | Self-play local reproducible |
| `npm run benchmark` | Benchmarks entre estrategias |
| `npm run practice` | Crea partida de práctica contra bot de la casa |
| `npm run submit` | Registra repo + commit en el árbitro (`PUT /api/me/submission`) |
| `npm run health` | Consulta `GET /api/health` del árbitro |

Para evitar que la Mac se suspenda durante la liga:
```bash
./scripts/prevent-sleep-macos.sh npm run bot
```

## Variables de entorno
Ver `.env.example`. El token del equipo **nunca** se commitea.

## Estructura
```
src/domain/connect4/   reglas puras del juego (sin HTTP/BD)
src/engine/            estrategias: básica y búsqueda negamax con deadline
src/application/       turn-orchestrator (torneo) y local-game-service (humano)
src/infrastructure/    cliente del árbitro, SQLite, API HTTP local
src/worker/            proceso persistente npm run bot
src/training/          self-play, benchmark, tuning
web/                   React + Vite (juego humano)
tests/                 suite Vitest: domain, engine, referee (mock), application, integration
scripts/               practice, submission, health-check, prevent-sleep
docs/                  TECNICO.md, MANUAL.md, ADR.md, API_LOCAL.md, etc.
```

<!-- TODO(X02, Juan): completar con capturas, troubleshooting y guía paso a paso. -->
