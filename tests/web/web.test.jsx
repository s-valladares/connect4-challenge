// @vitest-environment jsdom
/** Frontend (F01–F04, América): render, interacción, estados asíncronos, errores y recuperación. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { replayMoves } from '../../src/domain/connect4/game-state.js';
import App from '../../web/src/App.jsx';
import GameBoard from '../../web/src/components/GameBoard.jsx';
import { displayRows, isWinningCell, topRow } from '../../web/src/utils/display-board.js';
import { formatStatus, humanizeError, playerLabel } from '../../web/src/utils/labels.js';
import { createApiClient, ApiError } from '../../web/src/api/client.js';

/** `state` exactamente como lo devuelve la API (docs/API_LOCAL.md), a partir de jugadas. */
function apiState(moves, youAre = 1) {
  const s = replayMoves(moves);
  return {
    board: s.board, currentPlayer: s.currentPlayer, youAre, status: s.status,
    winner: s.winner, winningCells: s.winningCells, legalMoves: s.legalMoves, moves: s.moves,
  };
}

function fakeApi(overrides = {}) {
  return {
    createGame: vi.fn(async ({ first }) => ({ ok: true, gameId: 'lg_t', state: apiState(first === 'bot' ? [3] : [], first === 'bot' ? 2 : 1), botMove: first === 'bot' ? { column: 3 } : null })),
    getGame: vi.fn(async () => ({ ok: true, gameId: 'lg_t', state: apiState([3, 4]) })),
    playMove: vi.fn(async (_id, column) => ({ ok: true, playerMove: { column }, botMove: { column: 3 }, state: apiState([column, 3]) })),
    checkHealth: vi.fn(async () => ({ ok: true })),
    ...overrides,
  };
}

const startGame = async (api) => {
  render(<App api={api} />);
  fireEvent.click(screen.getByRole('button', { name: 'Nueva partida' }));
  await screen.findByText('Tu turno: elige una columna.');
};

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('utilidades y cliente', () => {
  it('displayRows invierte sin mutar: la fila 0 queda al final (abajo)', () => {
    const b = replayMoves([3]).board;
    const rows = displayRows(b);
    expect(rows[6].row).toBe(0);
    expect(b[0][3]).toBe(1);
    expect(isWinningCell([[0, 3]], 0, 3)).toBe(true);
    expect(isWinningCell(null, 0, 3)).toBe(false);
    expect(topRow(replayMoves([3, 3]).board, 3)).toBe(1);
    expect(topRow(b, 0)).toBe(-1);
  });

  it('mensajes de estado y de error para personas', () => {
    const s = apiState([]);
    expect(formatStatus(null).text).toMatch(/Nueva partida/);
    expect(formatStatus(s).tone).toBe('turn');
    expect(formatStatus(s, { pending: true }).tone).toBe('thinking');
    expect(formatStatus({ ...s, status: 'won', winner: 1 }).tone).toBe('success');
    expect(formatStatus({ ...s, status: 'won', winner: 2 }).tone).toBe('danger');
    expect(formatStatus({ ...s, status: 'draw' }).text).toMatch(/Empate/);
    expect(humanizeError({ code: 'illegal_move' })).toMatch(/llena/);
    expect(humanizeError({ code: 'raro' })).toMatch(/inesperado/);
    expect(humanizeError(null)).toBeNull();
    expect([playerLabel(1, 1), playerLabel(2, 1)]).toEqual(['Tú', 'Bot']);
  });

  it('client.js: rutas del contrato, errores de la API y de red normalizados', async () => {
    const calls = [];
    const ok = async (url, init) => { calls.push({ url, body: init.body && JSON.parse(init.body) }); return { ok: true, status: 200, json: async () => ({ ok: true }) }; };
    const c = createApiClient({ fetchImpl: ok });
    await c.createGame({ first: 'bot' });
    await c.getGame('lg 1');
    await c.playMove('lg_1', 4, { turn: 3 });
    await c.checkHealth();
    expect(calls.map((x) => x.url)).toEqual(['/api/local-games', '/api/local-games/lg%201', '/api/local-games/lg_1/moves', '/api/health']);
    expect(calls[0].body).toEqual({ first: 'bot' });
    expect(calls[2].body).toEqual({ column: 4, turn: 3 });
    const apiErr = createApiClient({ fetchImpl: async () => ({ ok: false, status: 409, json: async () => ({ ok: false, error: 'not_your_turn', message: 'x' }) }) });
    await expect(apiErr.getGame('a')).rejects.toMatchObject({ status: 409, code: 'not_your_turn' });
    const down = createApiClient({ fetchImpl: async () => { throw new Error('ECONNREFUSED'); } });
    await expect(down.getGame('a')).rejects.toBeInstanceOf(ApiError);
    await expect(down.getGame('a')).rejects.toMatchObject({ code: 'network' });
    const noJson = createApiClient({ fetchImpl: async () => ({ ok: false, status: 502, json: async () => { throw new Error(); } }) });
    await expect(noJson.checkHealth()).rejects.toMatchObject({ code: 'internal' });
  });
});

describe('GameBoard', () => {
  it('8 columnas × 7 filas, fila 0 abajo, línea ganadora marcada, columnas deshabilitadas', () => {
    const s = apiState([0, 1, 0, 1, 0, 1, 0]);
    render(<GameBoard state={s} canSelect={() => false} onColumnSelect={vi.fn()} />);
    const cols = screen.getAllByRole('button');
    expect(cols).toHaveLength(8);
    const cells = within(cols[0]).getAllByRole('gridcell');
    expect(cells).toHaveLength(7);
    expect(cells[6]).toHaveAccessibleName('Ficha tuya (línea ganadora)'); // abajo
    expect(cells[0]).toHaveAccessibleName('Vacía'); // arriba
    expect(cols[0]).toBeDisabled();
  });
});

describe('GamePage', () => {
  it('crea partida, juega una columna con su turno y muestra la respuesta del bot', async () => {
    const api = fakeApi();
    await startGame(api);
    fireEvent.click(screen.getByRole('button', { name: 'Jugar en columna 5' }));
    await waitFor(() => expect(api.playMove).toHaveBeenCalledWith('lg_t', 4, { turn: 1 }));
    await waitFor(() => expect(screen.getAllByRole('listitem').at(-1)).toHaveTextContent('Bot → columna 4'));
    expect(localStorage.getItem('c4.lastGameId')).toBe('lg_t');
    expect(screen.getByText('Conectado')).toBeInTheDocument();
  });

  it('doble clic = una sola petición; "pensando" mientras responde', async () => {
    let release;
    const api = fakeApi({ playMove: vi.fn(() => new Promise((r) => { release = () => r({ ok: true, botMove: { column: 3 }, state: apiState([2, 3]) }); })) });
    await startGame(api);
    const col = screen.getByRole('button', { name: 'Jugar en columna 3' });
    fireEvent.click(col);
    fireEvent.click(col);
    expect(api.playMove).toHaveBeenCalledTimes(1);
    expect(screen.getByText('El bot está pensando…')).toBeInTheDocument();
    release();
    await screen.findByText('Tu turno: elige una columna.');
  });

  it('sin conexión al enviar: banner y reintento con el MISMO turno', async () => {
    const api = fakeApi({ playMove: vi.fn(async () => { throw new ApiError(0, 'network', 'x'); }) });
    await startGame(api);
    fireEvent.click(screen.getByRole('button', { name: 'Jugar en columna 4' }));
    await screen.findByText(/Perdimos la conexión/);
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(api.playMove).toHaveBeenCalledTimes(2));
    expect(api.playMove.mock.calls[1]).toEqual(api.playMove.mock.calls[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Ver estado actual' }));
    await waitFor(() => expect(api.getGame).toHaveBeenCalled());
  });

  it('409 not_your_turn: recarga el estado del servidor', async () => {
    const api = fakeApi({ playMove: vi.fn(async () => { throw new ApiError(409, 'not_your_turn', 'x'); }) });
    await startGame(api);
    fireEvent.click(screen.getByRole('button', { name: 'Jugar en columna 1' }));
    await waitFor(() => expect(api.getGame).toHaveBeenCalledWith('lg_t'));
  });

  it('error de la API se muestra en lenguaje humano', async () => {
    const api = fakeApi({ createGame: vi.fn(async () => { throw new ApiError(500, 'internal', 'x'); }) });
    render(<App api={api} />);
    fireEvent.click(screen.getByRole('button', { name: 'Nueva partida' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/inesperado/);
  });

  it('recupera la última partida al recargar y muestra el resultado confirmado por el servidor', async () => {
    localStorage.setItem('c4.lastGameId', 'lg_t');
    const api = fakeApi({ getGame: vi.fn(async () => ({ ok: true, gameId: 'lg_t', state: apiState([0, 1, 0, 1, 0, 1, 0]) })) });
    render(<App api={api} />);
    await screen.findByText('¡Ganaste! Conectaste cuatro.');
    expect(api.getGame).toHaveBeenCalledWith('lg_t');
    expect(screen.getByRole('button', { name: 'Jugar otra vez' })).toBeInTheDocument();
  });

  it('partida guardada que ya no existe: se olvida sin mostrar error', async () => {
    localStorage.setItem('c4.lastGameId', 'viejo');
    const api = fakeApi({ getGame: vi.fn(async () => { throw new ApiError(404, 'not_found', 'x'); }) });
    render(<App api={api} />);
    await waitFor(() => expect(localStorage.getItem('c4.lastGameId')).toBeNull());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('elegir que abra el bot se envía a la API y se recuerda', async () => {
    const api = fakeApi();
    render(<App api={api} />);
    fireEvent.click(screen.getByLabelText('El bot'));
    fireEvent.click(screen.getByRole('button', { name: 'Nueva partida' }));
    await waitFor(() => expect(api.createGame).toHaveBeenCalledWith({ first: 'bot' }));
    expect(JSON.parse(localStorage.getItem('c4.preferences'))).toEqual({ first: 'bot' });
  });

  it('API caída: indicador "Sin conexión" y reintento de conexión', async () => {
    const api = fakeApi({ checkHealth: vi.fn(async () => { throw new ApiError(0, 'network', 'x'); }) });
    render(<App api={api} />);
    await screen.findByText(/Sin conexión con la API/);
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar conexión' }));
    await waitFor(() => expect(api.checkHealth).toHaveBeenCalledTimes(2));
  });
});
