/**
 * Raíz de la app. Owner: América (F01–F05). Ver PLAN_FRONTEND.md.
 *
 * Componentes (./components y ./pages):
 *   GamePage, GameBoard, Column, Cell, GameControls,
 *   TurnIndicator, GameResult, ConnectionStatus, GameHistory
 *
 * Reglas de oro:
 * - La FILA 0 del board es la INFERIOR: dibujar invertido (fila 6 arriba).
 * - El frontend NUNCA calcula jugadas: todo pasa por la API (src/api/client.js).
 * - Bloquear clicks mientras el bot "piensa" (no doble envío).
 * - No mostrar victoria antes de que el servidor la confirme.
 */

import GamePage from './pages/GamePage.jsx';
import styles from './styles/game.module.css';

export default function App({ api }) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Challenge IA · Equipo 5</p>
        <h1 className={styles.title}>Cuatro en Línea <span>8×7</span></h1>
      </header>
      <main>
        <GamePage api={api} />
      </main>
    </div>
  );
}
