/**
 * Árbitro mock POR HTTP con estado (Q05, Alex). Contrato docs/arbitro-openapi.json v1.0.1.
 *   Bot:     GET /api/next (long polling), POST /api/move
 *   Equipo:  POST /api/practice, GET /api/me, PUT /api/me/submission
 *   Público: GET /api/games, /api/games/{id}, /api/standings, /api/state, /api/health, /api/openapi.json
 * Reglas: 3.000 ms desde served_at; derrota por illegal_move / timeout / absent (30 s);
 * 409 sin penalizar; 423 tras congelamiento. Caos: latencia del POST y "POST dudoso".
 */
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { createGameState, playTurn } from '../../src/domain/connect4/game-state.js';
import { isValidColumn } from '../../src/domain/connect4/rules.js';
import { houseMove, HOUSE_BOTS } from './house-bots.js';

const REPO_RE = /^https?:\/\/(github\.com|bitbucket\.org)\/.+/;
const COMMIT_RE = /^[0-9a-fA-F]{7,40}$/;
const err = (error, message) => ({ ok: false, error, message });
const OPENAPI_URL = new URL('../../docs/arbitro-openapi.json', import.meta.url);

function send(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(data) });
  res.end(data);
}

async function readJson(req) {
  let text = '';
  for await (const chunk of req) text += chunk;
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw Object.assign(new Error('JSON inválido.'), { badJson: true });
  }
}

export function createRefereeMockServer({
  token = 'token-dev', teamName = 'Equipo 5', deadlineMs = 3000, absentMs = 30_000,
  phase = 'practice', now = () => Date.now(), random = Math.random,
  moveLatencyMs = 0, scheduleLeague = 0,
} = {}) {
  const team = { id: 'equipo-5', name: teamName };
  const games = new Map();
  const waiters = new Set();
  const state = { phase, submission: null, chaos: { dropNextMoveResponse: false, moveLatencyMs } };
  let seq = 0;
  const iso = (ms) => new Date(ms).toISOString();

  const notify = () => { for (const w of [...waiters]) w.check(); };
  const finish = (g, result) => { g.result = result; g.finishedAt = now(); };
  const isPending = (g) => !g.result && g.state.currentPlayer === g.teamSide;

  function checkAbsent(g) {
    if (isPending(g) && g.servedAt === null && now() - g.availableSince > absentMs) {
      finish(g, { winner: 3 - g.teamSide, reason: 'absent', forfeited_by: g.teamSide, waited_ms: now() - g.availableSince });
    }
  }

  function oldestPending() {
    let oldest = null;
    for (const g of games.values()) {
      checkAbsent(g);
      if (isPending(g) && (!oldest || g.availableSince < oldest.availableSince)) oldest = g;
    }
    return oldest;
  }

  function settle(g) {
    if (g.state.status === 'won') finish(g, { winner: g.state.winner, reason: 'connect4', winning_cells: g.state.winningCells });
    else if (g.state.status === 'draw') finish(g, { winner: null, reason: 'draw' });
  }

  function playHouse(g) {
    while (!g.result && g.state.currentPlayer !== g.teamSide) {
      const col = houseMove(g.house, g.state, random);
      g.state = playTurn(g.state, col);
      g.log.push({ turn: g.state.moves.length, by: 3 - g.teamSide, column: col, ms: 0 });
      settle(g);
    }
    if (!g.result) {
      g.availableSince = now();
      g.servedAt = null;
    }
  }

  function createGame({ kind, house, first }) {
    seq += 1;
    const g = {
      id: `${kind === 'practice' ? 'g_p_' : 'g_l_'}${String(seq).padStart(2, '0')}`, kind, house, teamSide: first,
      state: createGameState(), log: [], result: null, startedAt: now(), finishedAt: null, servedAt: null, availableSince: now(),
      matchId: kind === 'practice' ? null : `m_${String(Math.ceil(seq / 2)).padStart(2, '0')}`,
    };
    games.set(g.id, g);
    playHouse(g);
    notify();
    return g;
  }

  function turnJson(g) {
    const s = g.state;
    return {
      status: 'turn', game_id: g.id, match_id: g.matchId, kind: g.kind, you: g.teamSide, opponent: g.house,
      turn: s.moves.length + 1, board: s.board, moves: [...s.moves],
      last_move: s.moves.length ? { by: 3 - s.currentPlayer, column: s.moves.at(-1) } : null,
      legal_moves: s.legalMoves, deadline_ms: deadlineMs, served_at: iso(g.servedAt),
    };
  }

  function summary(g, withBoard) {
    const out = {
      game_id: g.id, match_id: g.matchId, kind: g.kind, series: null,
      status: g.result ? 'finished' : 'playing',
      players: {
        [g.teamSide]: { team_id: team.id, name: team.name },
        [3 - g.teamSide]: { team_id: g.house, name: g.house, house: true },
      },
      moves: g.log, current: g.result ? null : g.state.currentPlayer, result: g.result,
      started_at: iso(g.startedAt), finished_at: g.finishedAt ? iso(g.finishedAt) : null,
    };
    if (withBoard) out.board = g.state.board;
    return out;
  }

  async function next(req, res, url) {
    const raw = url.searchParams.get('wait');
    const wait = raw === null ? 20 : Number(raw);
    if (!Number.isInteger(wait) || wait < 0 || wait > 25) return send(res, 400, err('validation', 'wait debe ser un entero entre 0 y 25.'));
    const serve = (g) => {
      if (g.servedAt === null) g.servedAt = now();
      send(res, 200, turnJson(g));
    };
    const ready = oldestPending();
    if (ready) return serve(ready);
    return new Promise((resolve) => {
      let timer;
      const onClose = () => done();
      const idle = () => {
        if (!res.headersSent) send(res, 200, { status: 'idle' });
        done();
      };
      const waiter = {
        check: () => {
          const g = oldestPending();
          if (g) {
            serve(g);
            done();
          }
        },
        cancel: idle,
      };
      function done() {
        clearTimeout(timer);
        waiters.delete(waiter);
        req.off('close', onClose);
        resolve();
      }
      timer = setTimeout(idle, wait * 1000);
      waiters.add(waiter);
      req.on('close', onClose);
    });
  }

  async function move(req, res) {
    const body = await readJson(req);
    const g = games.get(body.game_id);
    if (!g || !isPending(g)) return send(res, 409, err('not_your_turn', 'No hay turno pendiente para esa partida.'));
    if (state.chaos.moveLatencyMs) await new Promise((r) => setTimeout(r, state.chaos.moveLatencyMs));
    const elapsed = now() - (g.servedAt ?? g.availableSince);
    if (elapsed > deadlineMs) {
      finish(g, { winner: 3 - g.teamSide, reason: 'timeout', forfeited_by: g.teamSide, ms: elapsed });
      return send(res, 400, err('timeout', `La jugada llegó ${elapsed - deadlineMs} ms después del límite.`));
    }
    const col = body.column;
    if (!isValidColumn(col) || !g.state.legalMoves.includes(col)) {
      finish(g, { winner: 3 - g.teamSide, reason: 'illegal_move', forfeited_by: g.teamSide, ms: elapsed, column: col });
      return send(res, 400, err('illegal_move', isValidColumn(col) ? `La columna ${col} está llena.` : `La columna ${col} está fuera de rango.`));
    }
    g.state = playTurn(g.state, col);
    g.log.push({ turn: g.state.moves.length, by: g.teamSide, column: col, ms: elapsed });
    settle(g);
    const turn = g.state.moves.length;
    let payload;
    if (g.result) {
      payload = g.result.winner === g.teamSide
        ? { ok: true, state: 'won', turn, winning_cells: g.result.winning_cells }
        : { ok: true, state: 'draw', turn };
    } else {
      playHouse(g);
      payload = { ok: true, state: 'playing', turn: turn + 1 };
    }
    notify();
    if (state.chaos.dropNextMoveResponse) {
      // "POST dudoso": la jugada SÍ se aplicó, pero el bot no recibe respuesta.
      state.chaos.dropNextMoveResponse = false;
      return req.socket.destroy();
    }
    return send(res, 200, payload);
  }

  async function practice(req, res) {
    if (state.phase !== 'practice') return send(res, 423, err('practice_closed', 'Las prácticas cerraron.'));
    const body = await readJson(req);
    const opponent = body.opponent ?? 'casa-basico';
    const first = body.first ?? 1;
    if (!HOUSE_BOTS.includes(opponent) || ![1, 2].includes(first)) return send(res, 400, err('validation', 'Rival o first inválidos.'));
    const g = createGame({ kind: 'practice', house: opponent, first });
    return send(res, 201, { game_id: g.id, you: first });
  }

  async function submission(req, res) {
    if (state.phase !== 'practice') return send(res, 423, err('submissions_closed', 'Las entregas cerraron.'));
    const body = await readJson(req);
    if (!REPO_RE.test(body.repo_url ?? '') || !COMMIT_RE.test(body.commit ?? '')) {
      return send(res, 400, err('validation', 'repo_url o commit inválidos.'));
    }
    state.submission = { repo_url: body.repo_url, commit: body.commit, registered_at: iso(now()) };
    return send(res, 200, state.submission);
  }

  function me(res) {
    for (const g of games.values()) checkAbsent(g);
    return send(res, 200, {
      team, standing: null, pending_turns: [...games.values()].filter(isPending).map((g) => g.id),
      submission: state.submission, phase: state.phase,
    });
  }

  async function route(req, res) {
    const url = new URL(req.url, 'http://mock');
    const key = `${req.method} ${url.pathname}`;
    if (key === 'GET /api/health') return send(res, 200, { ok: true, phase: state.phase, time: iso(now()) });
    if (key === 'GET /api/standings') return send(res, 200, { phase: state.phase, standings: [] });
    if (key === 'GET /api/state') return send(res, 200, { phase: state.phase, live: [...games.values()].filter((g) => !g.result).map((g) => summary(g, true)) });
    if (key === 'GET /api/openapi.json') return send(res, 200, JSON.parse(readFileSync(OPENAPI_URL, 'utf8')));
    if (key === 'GET /api/games') return send(res, 200, [...games.values()].reverse().map((g) => summary(g, false)));
    const m = req.method === 'GET' && url.pathname.match(/^\/api\/games\/([^/]+)$/);
    if (m) {
      const g = games.get(decodeURIComponent(m[1]));
      return g ? send(res, 200, summary(g, true)) : send(res, 404, err('not_found', 'No existe.'));
    }
    if ((req.headers.authorization ?? '') !== `Bearer ${token}`) return send(res, 401, err('unauthorized', 'Token inválido.'));
    if (key === 'GET /api/next') return next(req, res, url);
    if (key === 'POST /api/move') return move(req, res);
    if (key === 'POST /api/practice') return practice(req, res);
    if (key === 'GET /api/me') return me(res);
    if (key === 'PUT /api/me/submission') return submission(req, res);
    return send(res, 404, err('not_found', `Ruta desconocida: ${key}`));
  }

  const server = http.createServer((req, res) => {
    route(req, res).catch((e) => (e.badJson ? send(res, 400, err('validation', e.message)) : send(res, 500, err('internal', e.message))));
  });

  // Simula los partidos de liga que programa el árbitro (alternando quién abre).
  for (let i = 0; i < scheduleLeague; i++) createGame({ kind: 'league', house: 'casa-basico', first: (i % 2) + 1 });

  return {
    server,
    state,
    games,
    createLeagueGame: (opts = {}) => createGame({ kind: 'league', house: 'casa-basico', first: 1, ...opts }),
    setPhase: (p) => { state.phase = p; },
    listen(port = 0, host = '127.0.0.1') {
      return new Promise((resolve) => server.listen(port, host, () => resolve(`http://${host}:${server.address().port}`)));
    },
    close() {
      for (const w of [...waiters]) w.cancel();
      server.closeAllConnections();
      return new Promise((r) => server.close(() => r()));
    },
  };
}
