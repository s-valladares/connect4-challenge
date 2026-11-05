/**
 * Bots de la casa imitados. casa-basico "gana y bloquea 4 inmediatos" (OpenAPI);
 * lo que hace sin nada inmediato (aquí: azar) es SUPUESTO: confirmar el jueves.
 * Owner: Alex (Q03).
 */
import { applyMove, getNextFreeRow } from '../../src/domain/connect4/rules.js';
import { findLineAt } from '../../src/domain/connect4/outcome.js';

export const HOUSE_BOTS = Object.freeze(['casa-aleatorio', 'casa-basico']);

/** Columnas con las que `player` gana ya sobre `state`. */
export function immediateWins(state, player) {
  return state.legalMoves.filter((c) => {
    const row = getNextFreeRow(state.board, c);
    return findLineAt(applyMove(state.board, c, player), row, c) !== null;
  });
}

export function houseMove(name, state, random = Math.random) {
  const pick = () => state.legalMoves[Math.floor(random() * state.legalMoves.length)];
  if (name === 'casa-aleatorio') return pick();
  const me = state.currentPlayer;
  return immediateWins(state, me)[0] ?? immediateWins(state, me === 1 ? 2 : 1)[0] ?? pick();
}
