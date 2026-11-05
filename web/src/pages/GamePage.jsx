import { useLocalGame } from '../hooks/useLocalGame.js';
import { useConnection } from '../hooks/useConnection.js';
import { usePreferences } from '../hooks/usePreferences.js';
import GameControls from '../components/GameControls.jsx';
import TurnIndicator from '../components/TurnIndicator.jsx';
import GameBoard from '../components/GameBoard.jsx';
import GameResult from '../components/GameResult.jsx';
import ConnectionStatus from '../components/ConnectionStatus.jsx';
import GameHistory from '../components/GameHistory.jsx';
import { humanizeError } from '../utils/labels.js';
import { topRow } from '../utils/display-board.js';
import defaultApi from '../api/client.js';
import styles from '../styles/game.module.css';

/** Pantalla única: humano contra el bot (mismo engine del torneo, vía API local). */
export default function GamePage({ api = defaultApi }) {
  const g = useLocalGame(api);
  const conn = useConnection(api);
  const [prefs, setPrefs] = usePreferences();
  const start = () => g.createGame(prefs.first);
  const state = g.state;
  const lastColumn = state?.moves.at(-1);
  const lastMove = lastColumn === undefined ? null : { column: lastColumn, row: topRow(state.board, lastColumn) };
  const errorText = g.phase === 'uncertain' ? null : humanizeError(g.error);

  return (
    <div className={styles.layout}>
      <div className={styles.main}>
        <ConnectionStatus
          status={conn.status}
          uncertain={g.phase === 'uncertain'}
          onRefresh={g.refreshGame}
          onRetry={g.retryLastAction}
          onCheck={conn.check}
        />
        <GameControls first={prefs.first} onFirstChange={(first) => setPrefs({ first })} onNewGame={start} busy={g.isBusy} />
        <TurnIndicator state={state} pending={g.phase === 'submitting' || g.phase === 'creating'} />
        {errorText && <p className={styles.error} role="alert">{errorText}</p>}
        {g.phase === 'loading' && !state && <p className={styles.muted} aria-busy="true">Recuperando tu última partida…</p>}
        {state && <GameBoard state={state} lastMove={lastMove} canSelect={g.canSelectColumn} onColumnSelect={g.selectColumn} />}
        <GameResult state={state} onPlayAgain={start} />
      </div>
      <aside className={styles.side}>
        <GameHistory moves={state?.moves} youAre={state?.youAre} />
        <section className={styles.card}>
          <h2>Cómo jugar</h2>
          <p className={styles.muted}>Suelta fichas por turnos en las 8 columnas. Gana quien junte 4 seguidas en horizontal, vertical o diagonal. Tus fichas son amarillas; las del bot, coral.</p>
        </section>
      </aside>
    </div>
  );
}
