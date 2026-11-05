# Architecture Decision Records

Decisiones congeladas en G0 (04–05/11/2026). Detalle completo en PLAN_BACKEND.md
y PLAN_MAESTRO del equipo. Cambiar una decisión = nueva entrada aquí + aviso al equipo.

| ID | Decisión | Razón corta |
|---|---|---|
| ADR-01 | JavaScript ESM + JSDoc, sin TypeScript | Velocidad y experiencia del equipo; validación en bordes |
| ADR-02 | Node local para API y worker (sin cloud) | Long polling persistente simple; cero despliegue |
| ADR-03 | Un único engine compartido, sin HTTP/BD dentro | Testeable puro; misma lógica torneo y web |
| ADR-04 | SQLite (better-sqlite3, WAL) para partidas humanas | Recuperación tras refresh sin servidor de BD |
| ADR-05 | Adapter árbitro solo HTTP/long polling (1.0.1) | Es el único contrato publicado; no hay WS de jugadas |
| ADR-06 | Express para la API local | Familiaridad del equipo y de las IAs de código |
| ADR-07 | Vitest como runner único con cobertura v8 | ESM nativo sin config, coherente con Vite |
| ADR-08 | Una sola instancia de worker por token | Evita carreras de GET/POST duplicado |
| ADR-09 | Motor determinista; IA remota bajo flag OFF | Deadline 3 s y reproducibilidad |
| ADR-10 | Monorepo simple: src/ (un paquete Node con 2 entry points) + web/ (workspace) | Estructura del plan commiteado; sin ceremonia de packages |
| ADR-11 | Pondering/entrenamiento fuera del camino crítico | No bloquear event loop del worker |
