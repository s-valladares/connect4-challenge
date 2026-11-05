import Cell from './Cell.jsx';
import { isWinningCell } from '../utils/display-board.js';
import styles from '../styles/board.module.css';

/**
 * Una columna = un <button> (mouse, toque y teclado). `rows` ya viene invertido
 * (fila 6 arriba, fila 0 abajo). Deshabilitada si no se puede jugar.
 */
export default function Column({ column, rows, youAre, winningCells, lastMove, playable, full, onSelect }) {
  const owner = (v) => (v === youAre ? 'human' : 'bot');
  return (
    <button
      type="button"
      className={`${styles.column} ${playable ? styles.playable : ''} ${full ? styles.full : ''}`}
      disabled={!playable}
      onClick={() => onSelect(column)}
      aria-label={`Jugar en columna ${column + 1}${full ? ' (llena)' : ''}`}
      data-col={column}
    >
      {rows.map(({ row, cells }) => (
        <Cell
          key={row}
          value={cells[column]}
          owner={owner(cells[column])}
          isWinning={isWinningCell(winningCells, row, column)}
          isLast={lastMove?.column === column && lastMove?.row === row}
        />
      ))}
    </button>
  );
}
