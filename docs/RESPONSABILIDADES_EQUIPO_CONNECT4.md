# Connect4 — Responsabilidades del equipo

## Objetivo

Construir e integrar una aplicación de Cuatro en Línea 8×7 que permita jugar contra el bot desde React y competir automáticamente mediante el árbitro remoto. Todo el equipo trabaja en un **monorepo JavaScript**, con un motor de juego reutilizable e independiente de los transportes HTTP.

## Distribución de responsabilidades

| Integrante | Rol | Responsabilidad principal |
|---|---|---|
| **Salva** | Backend / Arquitectura | Arquitectura general, contratos compartidos, integración con el árbitro y Bot Worker. |
| **Jorge** | Backend / Algoritmos | Reglas de Cuatro en Línea, Game Engine, estrategias y optimización del algoritmo. |
| **Juan** | Full Stack / API | API HTTP, gestión de partidas locales, persistencia SQLite e integración con el motor. |
| **América** | Full Stack / Frontend | Aplicación React, tablero interactivo, experiencia de usuario e integración con la API. |
| **Alex** | QA / Testing | Mock del árbitro, pruebas automatizadas, escenarios de fallo y benchmarks. |

## Responsabilidades y entregables por integrante

### Salva — Arquitectura e integración con el árbitro

**Responsabilidades**
- Definir y mantener la estructura del monorepo, los límites entre módulos y los contratos compartidos.
- Acordar convenciones JavaScript, módulos ES, validación, errores, configuración y logging.
- Implementar el `bot-worker` que consulta al árbitro mediante `GET /api/next?wait=20` (long polling).
- Integrar la decisión del Game Engine y enviar cada jugada con `POST /api/move`.
- Gestionar autenticación Bearer, reconexiones, control de tiempo, respuestas erróneas y fallback a jugadas legales.
- Coordinar la integración general y revisar que API, worker y motor utilicen el mismo código de reglas y estrategias.

**Entregables**
- Estructura inicial del monorepo y contratos compartidos aprobados.
- `PLAN_BACKEND.md` coordinado con Jorge y Juan.
- Cliente HTTP del árbitro y worker ejecutable mediante `npm run bot`.
- Configuración documentada (`.env.example`), logs y estrategia de recuperación ante errores.
- Prueba de integración del worker contra el árbitro simulado.

**Necesita de**: contrato estable del Game Engine (Jorge) y mock de los endpoints oficiales (Alex). Puede avanzar inicialmente con una estrategia falsa que devuelva una columna legal.

### Jorge — Reglas y Game Engine

**Responsabilidades**
- Implementar el tablero 8×7, movimientos legales, caída de fichas, detección de victoria horizontal/vertical/diagonal y empate.
- Exponer funciones puras, probables y desacopladas de HTTP, React y SQLite.
- Implementar una estrategia básica de ganar, bloquear y priorizar columnas centrales.
- Implementar la estrategia de búsqueda Negamax/Minimax con poda Alpha-Beta, heurística, ordenamiento de movimientos e iterative deepening.
- Añadir optimizaciones medibles, como tablas de transposición, cuando mejoren las pruebas de rendimiento.
- Garantizar que toda estrategia produzca una columna válida dentro del presupuesto temporal o entregue una opción de respaldo.

**Entregables**
- Paquete `game-core` con reglas y pruebas.
- Paquete `game-engine` con interfaz de estrategias, estrategia básica y estrategia de búsqueda.
- Funciones centrales, según los contratos aprobados: `createBoard`, `getLegalMoves`, `applyMove`, `checkWinner`, `isDraw`, `getGameOutcome`, `evaluateBoard` y `chooseMove`.
- Pruebas de posiciones límite y métricas de decisiones del bot.

**Necesita de**: contrato compartido definido con Salva y casos de prueba preparados por Alex. No debe depender del servidor API ni del árbitro real.

### Juan — API HTTP y persistencia

**Responsabilidades**
- Implementar la API local con Fastify para que React pueda crear y jugar partidas.
- Definir handlers, servicios de aplicación, validaciones y respuestas HTTP consistentes.
- Integrar el mismo Game Engine utilizado por el worker del torneo.
- Gestionar el estado local de las partidas, perfiles básicos si se requieren, historial y resultados mediante SQLite.
- Diseñar recuperación de partidas locales ante recarga o cierre de la aplicación, sin confundir estos datos con el estado oficial del árbitro.
- Coordinar los contratos de los endpoints con América y las pruebas de integración con Alex.

**Entregables**
- API ejecutable mediante `npm run dev:api`.
- Endpoints locales acordados para crear partidas, consultar estado, ejecutar movimientos y revisar historial.
- Esquema SQLite, inicialización de la base y repositorios de persistencia.
- Pruebas de validación, estados y manejo de errores.

**Necesita de**: reglas y contrato del motor (Jorge) y contrato API/UI acordado con América. Puede usar respuestas simuladas mientras se desarrolla el motor.

### América — Aplicación React

**Responsabilidades**
- Diseñar la navegación y los componentes de la interfaz de juego.
- Implementar el tablero 8×7 con columnas seleccionables, fichas y animaciones.
- Permitir elegir quién comienza, reiniciar partidas y visualizar turno, estado, victoria y empate.
- Integrar la interfaz con los endpoints de Juan y manejar carga, errores y desconexiones.
- Hacer la experiencia responsive y accesible, incluyendo indicaciones claras de columnas disponibles.
- Preparar la documentación de uso con capturas reales de la interfaz.

**Entregables**
- `PLAN_FRONTEND.md` y aplicación React + Vite ejecutable mediante `npm run dev:web`.
- Componentes del tablero, controles y estados de partida.
- Integración funcional React → API → Game Engine → React.
- Pruebas de los flujos principales y manual de usuario.

**Necesita de**: contrato de endpoints y ejemplos JSON de Juan. Puede desarrollar primero con mocks propios.

### Alex — QA, mocks y benchmarking

**Responsabilidades**
- Construir un árbitro simulado compatible con el OpenAPI 1.0.1 para desarrollar sin depender del servicio remoto.
- Probar el ciclo completo `GET /api/next` → decisión → `POST /api/move`.
- Preparar pruebas de reglas, algoritmos, API y worker, con ejecución desde un único comando.
- Simular desconexiones, latencia, expiración de tiempo, token inválido, jugadas ilegales, partidas terminadas y respuestas inconsistentes.
- Medir desempeño del algoritmo con enfrentamientos automatizados contra estrategias básicas, aleatorias y versiones anteriores.
- Registrar defectos reproducibles, cobertura, estadísticas y evidencias de corrección.

**Entregables**
- Mock del árbitro y fixtures representativos del contrato oficial.
- Suite de pruebas ejecutable mediante `npm test`.
- Escenarios end-to-end, benchmarks e informe de cobertura.
- Checklist de integración final, incluyendo riesgo de timeout y continuidad del worker.

**Necesita de**: contrato inicial del cliente del árbitro (Salva), reglas (Jorge) y endpoints locales (Juan). Su mock debe estar disponible temprano, no al final del desarrollo.

## Orden de trabajo e integración

> El orden siguiente representa **dependencias técnicas**, no turnos de espera. Después de aprobar los contratos, todos pueden avanzar en paralelo.

1. **Arquitectura y contratos — Todos; coordinación de Salva.** Acordar estructura del monorepo, nombres, contratos del tablero, interfaz de estrategia, endpoints locales, errores y convenciones. Registrar los planes iniciales antes de implementar código.
2. **Reglas y bot básico — Jorge.** Entregar funciones del dominio y una estrategia mínima válida para desbloquear al resto.
3. **Mock del árbitro — Alex.** Entregar tempranamente `/api/next` y `/api/move` simulados, incluidos turnos, estados `idle` y errores. Esta entrega es crítica para evitar pérdidas automáticas por integración.
4. **Desarrollo paralelo — Salva, Juan y América.** Salva desarrolla worker con el mock; Juan implementa API/SQLite con el motor simulado; América desarrolla React contra respuestas acordadas.
5. **Primera integración funcional — Todos.** Validar `React → API → Game Engine → React` y `Árbitro simulado → Bot Worker → Game Engine → Árbitro simulado`.
6. **Algoritmo avanzado y medición — Jorge y Alex.** Incorporar búsqueda, controlar tiempos y comparar partidas/benchmarks con la estrategia básica.
7. **Pruebas de resiliencia — Alex y Salva.** Validar reconexión, disponibilidad del worker, errores HTTP, jugadas ilegales, timeouts y fallback. Revisar persistencia y recuperación de partidas locales con Juan.
8. **Integración con árbitro oficial — Salva y Alex, con apoyo de todos.** Verificar el contrato activo, credenciales, `/api/me`, prácticas, logs y entrega de movimientos antes de operar continuamente.
9. **Validación final — Todos.** Revisar pruebas, documentación, ejecución reproducible, integración de componentes y estado del repositorio.

## Flujos end-to-end que deben funcionar

### A. Humano contra bot

```text
React → API local → Reglas / Game Engine → API local → React
```

**Criterio de aceptación:** una persona puede iniciar una partida, hacer jugadas legales, ver las respuestas del bot y llegar correctamente a victoria o empate, sin utilizar el árbitro remoto.

### B. Torneo de bots

```text
Árbitro remoto → respuesta a GET /api/next → Bot Worker
Bot Worker → Game Engine → POST /api/move → Árbitro remoto
```

**Criterio de aceptación:** el worker permanece escuchando, procesa turnos, respeta el tiempo disponible y envía únicamente columnas legales, sin que nadie tenga que pulsar un botón en React.

### C. Pruebas automatizadas

```text
Mock árbitro ↔ Bot Worker ↔ Game Engine
                       +
                  API ↔ React
```

**Criterio de aceptación:** las integraciones pueden probarse sin internet ni árbitro oficial; los escenarios de errores producen resultados verificables y no comprometen las jugadas siguientes.

## Acuerdos técnicos del equipo

- **Un repositorio** para frontend, API, worker, paquetes compartidos, pruebas y documentación.
- **JavaScript puro** con módulos ES y JSDoc; no introducir TypeScript salvo decisión expresa del equipo.
- **Motor desacoplado:** ninguna función de reglas o algoritmo debe importar Fastify, React, SQLite o el cliente del árbitro.
- **Un solo motor compartido** para partidas humanas y torneo.
- **Pruebas tempranas:** toda nueva regla o cambio de comportamiento crítico requiere un caso de prueba.
- **Observabilidad:** registrar errores y decisiones relevantes sin exponer tokens, secretos ni datos innecesarios.
- **Seguridad operativa:** disponer de fallback legal y controlar el tiempo disponible antes de enviar movimientos.
- **Escalabilidad razonable:** diseñar límites reutilizables para futuros juegos y estrategias, sin implementar infraestructura que aún no es necesaria.

## Condición de finalización del equipo

El trabajo está listo para integración cuando el Game Engine pueda usarse sin HTTP, React pueda jugar contra el backend, el worker pueda participar contra el mock del árbitro, las pruebas pasen desde un solo comando y el equipo pueda ejecutar y diagnosticar cada proceso independientemente.
