/** Textos para personas. No calcula reglas: solo interpreta el estado que manda la API. */

export function formatStatus(state, { pending = false } = {}) {
  if (!state) return { text: 'Elige quién empieza y pulsa «Nueva partida».', tone: 'neutral' };
  if (state.status === 'won') {
    return state.winner === state.youAre
      ? { text: '¡Ganaste! Conectaste cuatro.', tone: 'success' }
      : { text: 'Ganó el bot. La línea ganadora está resaltada.', tone: 'danger' };
  }
  if (state.status === 'draw') return { text: 'Empate: el tablero se llenó sin ganador.', tone: 'neutral' };
  if (pending || state.currentPlayer !== state.youAre) return { text: 'El bot está pensando…', tone: 'thinking' };
  return { text: 'Tu turno: elige una columna.', tone: 'turn' };
}

export const playerLabel = (player, youAre) => (player === youAre ? 'Tú' : 'Bot');

const MESSAGES = {
  illegal_move: 'Esa columna está llena o no existe. Elige otra.',
  not_your_turn: 'Esa jugada ya no corresponde: actualizamos la partida.',
  not_found: 'No encontramos esa partida. Empieza una nueva.',
  validation: 'La jugada no es válida.',
  network: 'No podemos conectar con el juego. ¿Está corriendo la API (npm run api)?',
};

/** Traduce errores de la API a mensajes para personas (sin detalles técnicos). */
export function humanizeError(error) {
  if (!error) return null;
  return MESSAGES[error.code] ?? 'Ocurrió un error inesperado. Intenta de nuevo.';
}
