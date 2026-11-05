/**
 * Árbitro de DESARROLLO local — herramienta de Salva para probar el worker
 * end-to-end sin red ni árbitro real. NO es el MockReferee de la suite (Q03,
 * Edgar): esto es un servidor http de juguete que juega partidas contra un
 * bot de la casa aleatorio y las imprime en consola.
 *
 * Uso (dos terminales):
 *   1) npm run dev:referee
 *   2) ARBITRO_URL=http://localhost:4100 TEAM_TOKEN=dev npm run bot
 */
import { createServer } from 'node:http';

const PORT = Number(process.env.DEV_REFEREE_PORT) || 4100;
const ROWS = 7;
const COLS = 8;
const DEADLINE_MS = 3000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let game;

function legalMoves(board) {
  const out = [];
  for (let c = 0; c < COLS; c += 1) if (board[ROWS - 1][c] === 0) out.push(c);
  return out;
}

function applyMove(board, column, player) {
  const row = board.findIndex((r) => r[column] === 0);
  board[row][column] = player;
}

function winCells(board, player) {
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      if (board[r][c] !== player) continue;
      for (const [dr, dc] of dirs) {
        const cells = [[r, c]];
        for (let k = 1; k < 4; k += 1) {
          const nr = r + dr * k;
          const nc = c + dc * k;
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || board[nr][nc] !== player) break;
          cells.push([nr, nc]);
        }
        if (cells.length === 4) return cells;
      }
    }
  }
  return null;
}

function printBoard(board) {
  for (let r = ROWS - 1; r >= 0; r -= 1) {
    console.log(' ', board[r].map((v) => (v === 0 ? '·' : v === 1 ? 'X' : 'O')).join(' '));
  }
  console.log('  0 1 2 3 4 5 6 7');
}

function houseMoveIfItsTurn() {
  const house = 3 - game.you;
  while (game.status === 'playing' && game.next === house) {
    const legal = legalMoves(game.board);
    const column = legal[Math.floor(Math.random() * legal.length)];
    applyMove(game.board, column, house);
    game.moves.push(column);
    console.log(`\n[casa] juega columna ${column}`);
    finishIfOver(house);
    game.next = game.next === 1 ? 2 : 1;
  }
}

function finishIfOver(player) {
  const cells = winCells(game.board, player);
  if (cells) {
    game.status = 'finished';
    game.winner = player;
    printBoard(game.board);
    console.log(`\n🏁 Gana jugador ${player} (${player === game.you ? 'TU BOT' : 'la casa'}). Nueva partida en 2s...\n`);
    setTimeout(newGame, 2000);
  } else if (legalMoves(game.board).length === 0) {
    game.status = 'finished';
    game.winner = null;
    printBoard(game.board);
    console.log('\n🏁 Empate (56 fichas). Nueva partida en 2s...\n');
    setTimeout(newGame, 2000);
  }
}

function newGame() {
  game = {
    id: `g_dev_${Math.random().toString(36).slice(2, 8)}`,
    board: Array.from({ length: ROWS }, () => Array(COLS).fill(0)),
    moves: [],
    you: Math.random() < 0.5 ? 1 : 2,
    next: 1,
    status: 'playing',
    winner: null,
    servedAt: null,
  };
  console.log(`\n=== Partida ${game.id}: tu bot es jugador ${game.you} (${game.you === 1 ? 'X abre' : 'O responde'}) ===`);
  houseMoveIfItsTurn();
}

const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};

async function readBody(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return null;
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (!req.headers.authorization?.startsWith('Bearer ')) {
    return json(res, 401, { ok: false, error: 'unauthorized', message: 'Token ausente.' });
  }

  if (req.method === 'GET' && url.pathname === '/api/next') {
    const wait = Math.min(Number(url.searchParams.get('wait')) || 20, 25);
    const deadline = Date.now() + wait * 1000;
    while (Date.now() < deadline) {
      if (game.status === 'playing' && game.next === game.you) {
        game.servedAt = Date.now();
        return json(res, 200, {
          status: 'turn',
          game_id: game.id,
          match_id: null,
          kind: 'practice',
          you: game.you,
          opponent: 'casa-dev',
          turn: game.moves.length + 1,
          board: game.board,
          moves: game.moves,
          last_move: game.moves.length
            ? { by: game.next === 1 ? 2 : 1, column: game.moves[game.moves.length - 1] }
            : null,
          legal_moves: legalMoves(game.board),
          deadline_ms: DEADLINE_MS,
          served_at: new Date(game.servedAt).toISOString(),
        });
      }
      await sleep(100);
    }
    return json(res, 200, { status: 'idle' });
  }

  if (req.method === 'POST' && url.pathname === '/api/move') {
    const body = await readBody(req);
    if (!body) return json(res, 400, { ok: false, error: 'validation', message: 'JSON inválido.' });
    if (body.game_id !== game.id) return json(res, 409, { ok: false, error: 'unknown_game', message: `La partida ${body.game_id} no existe.` });
    if (game.status !== 'playing' || game.next !== game.you) {
      return json(res, 409, { ok: false, error: 'not_your_turn', message: 'No hay turno pendiente.' });
    }
    const elapsed = Date.now() - (game.servedAt ?? Date.now());
    if (elapsed > DEADLINE_MS + 500) {
      game.status = 'finished';
      console.log(`\n⏱️  TIMEOUT: la jugada llegó ${elapsed - DEADLINE_MS} ms tarde. Nueva partida en 2s...`);
      setTimeout(newGame, 2000);
      return json(res, 400, { ok: false, error: 'timeout', message: `La jugada llegó ${elapsed - DEADLINE_MS} ms después del límite.` });
    }
    const { column } = body;
    if (!Number.isInteger(column) || column < 0 || column >= COLS || game.board[ROWS - 1][column] !== 0) {
      game.status = 'finished';
      console.log(`\n🚫 ILEGAL: columna ${column}. Nueva partida en 2s...`);
      setTimeout(newGame, 2000);
      return json(res, 400, { ok: false, error: 'illegal_move', message: `Columna ${column} ilegal.` });
    }

    applyMove(game.board, column, game.you);
    game.moves.push(column);
    console.log(`\n[tu bot] juega columna ${column} (${elapsed} ms desde served_at)`);
    printBoard(game.board);
    finishIfOver(game.you);

    if (game.status === 'finished' && game.winner === game.you) {
      return json(res, 200, { ok: true, state: 'won', turn: game.moves.length, winning_cells: winCells(game.board, game.you) });
    }
    if (game.status === 'finished' && game.winner === null) {
      return json(res, 200, { ok: true, state: 'draw', turn: game.moves.length });
    }
    game.next = game.next === 1 ? 2 : 1;
    houseMoveIfItsTurn();
    return json(res, 200, { ok: true, state: 'playing', turn: game.moves.length + 1 });
  }

  if (req.method === 'GET' && url.pathname === '/api/health') {
    return json(res, 200, { ok: true, phase: 'practice', time: new Date().toISOString() });
  }

  return json(res, 404, { ok: false, error: 'not_found', message: req.url });
});

newGame();
server.listen(PORT, () => {
  console.log(`Árbitro de desarrollo en http://localhost:${PORT}`);
  console.log(`Arranca tu bot con:\n  ARBITRO_URL=http://localhost:${PORT} TEAM_TOKEN=dev npm run bot\n`);
});
