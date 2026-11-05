/**
 * Raíz de la app. Owner: América (F01–F05). Ver PLAN_FRONTEND.md.
 *
 * Componentes previstos (crear en ./components y ./pages):
 *   GamePage, GameBoard, Column, Cell, GameControls,
 *   TurnIndicator, GameResult, ConnectionStatus, GameHistory (opcional)
 *
 * Reglas de oro:
 * - La FILA 0 del board es la INFERIOR: dibujar invertido (fila 6 arriba).
 * - El frontend NUNCA calcula jugadas: todo pasa por la API (src/api/client.js).
 * - Bloquear clicks mientras el bot "piensa" (no doble envío).
 * - No mostrar victoria antes de que el servidor la confirme.
 */

export default function App() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      <h1>Cuatro en Línea 8×7</h1>
      <p>TODO(F01, América): tablero interactivo. Contrato API en docs/API_LOCAL.md.</p>
    </main>
  );
}
