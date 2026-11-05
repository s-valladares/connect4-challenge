import Column from './Column.jsx';
import { COLS, displayRows } from '../utils/display-board.js';
import styles from '../styles/board.module.css';

/**
 * Tablero 8×7. Solo presentación: recibe el estado de la API y avisa la columna elegida.
 * La FILA 0 del board es la INFERIOR: se dibuja invertido (fila 6 arriba).
 */
export default function GameBoard({ state, lastMove = null, canSelect, onColumnSelect }) {
  const rows = displayRows(state.board);
  return (
    <div>
      <div className={styles.board} role="grid" aria-label="Tablero de 8 columnas por 7 filas">
        {Array.from({ length: COLS }, (_, c) => (
          <Column
            key={c}
            column={c}
            rows={rows}
            youAre={state.youAre}
            winningCells={state.winningCells}
            lastMove={lastMove}
            playable={canSelect(c)}
            full={state.status === 'playing' && !state.legalMoves.includes(c)}
            onSelect={onColumnSelect}
          />
        ))}
      </div>
      <div className={styles.labels} aria-hidden="true">
        {Array.from({ length: COLS }, (_, c) => <span key={c}>{c + 1}</span>)}
      </div>
    </div>
  );
}
