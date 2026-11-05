import styles from '../styles/game.module.css';

/** Elegir quién empieza y crear partida (también sirve para reiniciar). */
export default function GameControls({ first, onFirstChange, onNewGame, busy }) {
  return (
    <section className={styles.controls} aria-label="Nueva partida">
      <fieldset>
        <legend>¿Quién empieza?</legend>
        <label><input type="radio" name="first" checked={first === 'human'} onChange={() => onFirstChange('human')} /> Yo</label>
        <label><input type="radio" name="first" checked={first === 'bot'} onChange={() => onFirstChange('bot')} /> El bot</label>
      </fieldset>
      <button type="button" className={styles.primary} onClick={onNewGame} disabled={busy}>Nueva partida</button>
    </section>
  );
}
