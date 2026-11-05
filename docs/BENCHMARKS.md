# Benchmarks

> T02 (Alex). SOLO resultados reales y reproducibles (semilla + comando).
> Si un número no salió de una corrida, no va aquí ni en la exposición.

Generado el 2026-11-05T13:51:15.125Z · Node 20.20.0 · darwin/arm64.

## Matriz
Cada fila: 20 partidas alternando quién abre, 2 primeras jugadas al azar (semilla 42), 50 ms por jugada. Tiempos y profundidad = de la estrategia de la izquierda.

| Enfrentamiento | Partidas | Seed | V/E/D | Ilegales | p50 ms | p95 ms | Prof. media |
|---|---|---|---|---|---|---|---|
| search vs basic | 20 | 42 | 20/0/0 | 0 | 51 | 53 | 7.7 |
| search vs random | 20 | 42 | 20/0/0 | 0 | 51 | 53 | 6.6 |
| basic vs random | 20 | 42 | 20/0/0 | 0 | 0 | 0 | 0.3 |

## Engine en posiciones fijas
searchStrategy con 1500 ms (presupuesto del torneo, SEARCH_BUDGET_MS), 3 repeticiones, TT nueva en cada una.

| Posición | Jugadas previas | p50 ms | p95 ms | máx ms | Profundidad mín. | Nodos/s |
|---|---|---|---|---|---|---|
| apertura | 0 | 1502 | 1503 | 1503 | 12 | 350.423 |
| apertura-2 | 2 | 1503 | 1505 | 1505 | 13 | 359.047 |
| medio-tactico | 12 | 0 | 0 | 0 | 0 | 0 |
| medio-2 | 22 | 1502 | 1502 | 1502 | 23 | 391.643 |
| casi-final | 40 | 6 | 7 | 7 | 16 | 480.632 |

## Comando
```bash
npm run benchmark -- --games 20 --seed 42 --budget 50 --position-budget 1500
```

## Observaciones
- Profundidad 0 = victoria inmediata o única jugada (no hace falta buscar).
- Tiempo bajo con profundidad alta = la búsqueda encontró un resultado forzado y se detuvo.
- Ilegales debe ser 0 siempre: es requisito, no métrica.
