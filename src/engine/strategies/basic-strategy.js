/**
 * BasicStrategy: (1) victoria inmediata, (2) bloqueo de victoria rival,
 * (3) preferencia central [3,4,2,5,1,6,0,7], (4) fallback legal.
 * Es el piso de seguridad del bot y el fallback de SearchStrategy.
 * Owner: Jorge (D04).
 */

export const CENTER_ORDER = [3, 4, 2, 5, 1, 6, 0, 7];

/** @type {import('../types.js').MoveStrategy} */
export const basicStrategy = {
  name: 'basic',
  /**
   * @param {import('../types.js').MoveContext} context
   * @returns {import('../types.js').MoveDecision}
   */
  chooseMove(context) {
    throw new Error('TODO(D04): implementar basicStrategy.chooseMove');
  },
};
