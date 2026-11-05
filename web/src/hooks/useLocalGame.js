import { useCallback, useEffect, useRef, useState } from 'react';
import defaultApi from '../api/client.js';

const LAST_GAME = 'c4.lastGameId';
const store = {
  get: () => { try { return localStorage.getItem(LAST_GAME); } catch { return null; } },
  set: (id) => { try { localStorage.setItem(LAST_GAME, id); } catch { /* sin almacenamiento */ } },
  clear: () => { try { localStorage.removeItem(LAST_GAME); } catch { /* sin almacenamiento */ } },
};

/**
 * Estado de la partida local. La API es la autoridad: el tablero solo cambia
 * con su respuesta (sin jugadas optimistas, sin victoria antes de que el
 * servidor la confirme). Cada jugada lleva su número de `turn`: un reintento o
 * doble click del mismo turno recibe 409 y nunca se aplica dos veces.
 * phase: idle | loading | creating | submitting | ready | uncertain
 */
export function useLocalGame(api = defaultApi) {
  const [game, setGame] = useState(null); // { gameId, state }
  const [phase, setPhase] = useState('idle');
  const [error, setError] = useState(null);
  const [lastBotMove, setLastBotMove] = useState(null);
  const pending = useRef(null);
  const inFlight = useRef(false);

  const loadGame = useCallback(async (gameId) => {
    setPhase('loading');
    try {
      const r = await api.getGame(gameId);
      setGame({ gameId: r.gameId, state: r.state });
      setError(null);
    } catch (e) {
      if (e.code === 'not_found') store.clear();
      setError(e.code === 'not_found' ? null : e);
    } finally {
      setPhase('ready');
    }
  }, [api]);

  useEffect(() => {
    const id = store.get();
    if (id) loadGame(id);
  }, [loadGame]);

  const createGame = useCallback(async (first) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPhase('creating');
    setError(null);
    try {
      const r = await api.createGame({ first });
      store.set(r.gameId);
      setGame({ gameId: r.gameId, state: r.state });
      setLastBotMove(r.botMove);
    } catch (e) {
      setError(e);
    } finally {
      inFlight.current = false;
      setPhase('ready');
    }
  }, [api]);

  const canSelectColumn = useCallback((column) => {
    const s = game?.state;
    return Boolean(s) && s.status === 'playing' && s.currentPlayer === s.youAre
      && s.legalMoves.includes(column) && !inFlight.current && phase !== 'submitting';
  }, [game, phase]);

  const send = useCallback(async (action) => {
    inFlight.current = true;
    setPhase('submitting');
    setError(null);
    try {
      const r = await api.playMove(action.gameId, action.column, { turn: action.turn });
      setGame({ gameId: action.gameId, state: r.state });
      setLastBotMove(r.botMove);
      pending.current = null;
      setPhase('ready');
    } catch (e) {
      setError(e);
      if (e.code === 'network') {
        // Sin respuesta: no sabemos si se aplicó → estado incierto; se reconcilia con GET.
        setPhase('uncertain');
      } else {
        pending.current = null;
        setPhase('ready');
        if (e.code === 'not_your_turn') {
          inFlight.current = false;
          await loadGame(action.gameId);
        }
      }
    } finally {
      inFlight.current = false;
    }
  }, [api, loadGame]);

  const selectColumn = useCallback((column) => {
    if (!canSelectColumn(column)) return;
    inFlight.current = true; // bloquea el doble click antes del siguiente render
    pending.current = { gameId: game.gameId, column, turn: game.state.moves.length + 1 };
    send(pending.current);
  }, [canSelectColumn, game, send]);

  const refreshGame = useCallback(() => {
    pending.current = null;
    return game && loadGame(game.gameId);
  }, [game, loadGame]);

  const retryLastAction = useCallback(() => pending.current && send(pending.current), [send]);

  return {
    game, state: game?.state ?? null, phase, error, lastBotMove,
    isBusy: phase === 'creating' || phase === 'submitting' || phase === 'loading',
    createGame, selectColumn, canSelectColumn, refreshGame, retryLastAction,
  };
}
