/**
 * E2E sin internet (Q05, Alex): worker REAL (cliente HTTP + run-worker + engine)
 * contra el árbitro mock por HTTP. Flujo B de RESPONSABILIDADES_EQUIPO_CONNECT4.md.
 */
import { describe, it, expect } from 'vitest';
import { createRefereeMockServer } from '../referee/mock-referee-server.js';
import { createRefereeClient } from '../../src/infrastructure/referee/referee-client.js';
import { runWorker } from '../../src/worker/run-worker.js';

const TOKEN = 't-int';

/** Corre el worker hasta que todas las partidas del mock terminen (o maxEvents). */
async function playUntilDone(mock, client, opts = {}) {
  const ctrl = new AbortController();
  const loop = runWorker({ client, signal: ctrl.signal, budgetMs: 150, waitSec: 1, ...opts });
  let loopEnded = false;
  loop.finally(() => { loopEnded = true; });
  const deadline = Date.now() + 25_000;
  const finished = () => [...mock.games.values()].every((g) => g.result);
  while (!finished() && !loopEnded && Date.now() < deadline) await new Promise((r) => setTimeout(r, 50));
  ctrl.abort();
  return loop;
}

async function setup(options = {}) {
  const mock = createRefereeMockServer({ token: TOKEN, ...options });
  const url = await mock.listen(0);
  return { mock, client: createRefereeClient({ baseUrl: url, token: TOKEN }) };
}

describe('worker ↔ árbitro mock por HTTP', () => {
  it('gana prácticas y partidas de liga contra casa-basico, abriendo y sin abrir', async () => {
    const { mock, client } = await setup({ scheduleLeague: 2 });
    await client.createPractice('casa-basico', 1);
    await client.createPractice('casa-basico', 2);
    const events = await playUntilDone(mock, client);
    const games = [...mock.games.values()];
    expect(games).toHaveLength(4);
    for (const g of games) expect(g.result).toMatchObject({ winner: g.teamSide, reason: 'connect4' });
    expect(events.filter((e) => e.kind === 'moved').every((e) => !e.result.startsWith('lost'))).toBe(true);
    await mock.close();
  });

  it('POST dudoso: el mock aplica la jugada pero corta la respuesta → el worker reconcilia y sigue', async () => {
    const { mock, client } = await setup();
    await client.createPractice('casa-basico', 1);
    mock.state.chaos.dropNextMoveResponse = true;
    const events = await playUntilDone(mock, client);
    expect(events.some((e) => e.result === 'accepted_reconciled')).toBe(true);
    expect([...mock.games.values()][0].result.winner).toBe(1);
    await mock.close();
  });

  it('latencia de red alta: 2.600 ms de demora + 1.500 ms de cálculo = derrota por timeout (justifica el margen)', async () => {
    const { mock, client } = await setup({ moveLatencyMs: 2600 });
    await client.createPractice('casa-basico', 1);
    const events = await playUntilDone(mock, client, { budgetMs: 1500 });
    expect(events.find((e) => e.kind === 'moved').result).toBe('lost_timeout');
    await mock.close();
  });

  it('latencia moderada (800 ms) con el presupuesto del torneo (1.500 ms): sin timeouts', async () => {
    const { mock, client } = await setup({ moveLatencyMs: 800 });
    await client.createPractice('casa-aleatorio', 1);
    const events = await playUntilDone(mock, client, { budgetMs: 1500, maxEvents: 3 });
    const moved = events.filter((e) => e.kind === 'moved');
    expect(moved.length).toBeGreaterThan(0);
    expect(moved.every((e) => !e.result.startsWith('lost'))).toBe(true);
    expect(Math.max(...moved.map((e) => e.totalMs))).toBeLessThan(3000);
    await mock.close();
  });

  it('token inválido: el worker se detiene con 401 (no se queda girando)', async () => {
    const { mock } = await setup();
    const bad = createRefereeClient({ baseUrl: `http://127.0.0.1:${mock.server.address().port}`, token: 'otro' });
    await expect(runWorker({ client: bad, waitSec: 0 })).rejects.toMatchObject({ kind: 'http_401' });
    await mock.close();
  });
});
