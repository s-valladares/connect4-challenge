import styles from '../styles/game.module.css';

/** Botón para volver a jugar cuando la partida terminó (solo tras confirmación del servidor). */
export default function GameResult({ state, onPlayAgain }) {
  if (!state || state.status === 'playing') return null;
  return (
    <div className={styles.result}>
      <button type="button" className={styles.primary} onClick={onPlayAgain}>Jugar otra vez</button>
    </div>
  );
}
