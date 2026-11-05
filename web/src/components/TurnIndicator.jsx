import { formatStatus } from '../utils/labels.js';
import styles from '../styles/game.module.css';

/** Turno / pensando / victoria / empate. Anuncia los cambios a lectores de pantalla. */
export default function TurnIndicator({ state, pending = false }) {
  const { text, tone } = formatStatus(state, { pending });
  const live = tone === 'success' || tone === 'danger' ? 'assertive' : 'polite';
  return <p className={`${styles.status} ${styles[tone]}`} role="status" aria-live={live}>{text}</p>;
}
