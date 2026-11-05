import { playerLabel } from '../utils/labels.js';
import styles from '../styles/game.module.css';

/** Jugadas de la partida en curso. Siempre abre el jugador 1: el turno n lo juega 1 si n es impar. */
export default function GameHistory({ moves = [], youAre = 1 }) {
  return (
    <section className={styles.card} aria-label="Historial de jugadas">
      <h2>Historial</h2>
      {moves.length === 0 ? <p className={styles.muted}>Todavía no hay jugadas.</p> : (
        <ol className={styles.history}>
          {moves.map((column, i) => {
            const player = i % 2 === 0 ? 1 : 2;
            return (
              <li key={i}>
                <b className={player === youAre ? styles.humanText : styles.botText}>{playerLabel(player, youAre)}</b> → columna {column + 1}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
