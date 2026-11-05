import styles from '../styles/board.module.css';

/** Una casilla: vacía, tuya o del bot; resaltada si es parte de la línea ganadora o la última jugada. */
export default function Cell({ value, owner, isWinning = false, isLast = false }) {
  const cls = [styles.cell, value ? styles[owner] : '', isWinning ? styles.win : '', isLast ? styles.last : '']
    .filter(Boolean).join(' ');
  const label = value ? `Ficha ${owner === 'human' ? 'tuya' : 'del bot'}${isWinning ? ' (línea ganadora)' : ''}` : 'Vacía';
  return <span className={cls} role="gridcell" aria-label={label} />;
}
