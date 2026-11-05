/**
 * Una sola instancia del worker por token (ADR-08): archivo de bloqueo con el PID
 * en la carpeta temporal del sistema. Si el PID del archivo ya no existe, el
 * bloqueo se considera abandonado y se toma.
 * Owner: Salva (O02).
 */

import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

/**
 * @param {string} token se guarda solo su hash, nunca el token
 * @returns {{ file: string, release: () => void }}
 * @throws {Error} si ya hay otro worker vivo con el mismo token
 */
export function acquireWorkerLock(token, { dir = tmpdir(), pid = process.pid } = {}) {
  const id = createHash('sha256').update(token || 'sin-token').digest('hex').slice(0, 12);
  const file = join(dir, `connect4-bot-${id}.lock`);
  if (existsSync(file)) {
    const other = Number.parseInt(readFileSync(file, 'utf8'), 10);
    if (other && other !== pid && alive(other)) {
      throw new Error(`Ya hay un bot corriendo con este token (PID ${other}). Detenlo antes de iniciar otro.`);
    }
  }
  writeFileSync(file, String(pid));
  return {
    file,
    release() {
      try {
        if (existsSync(file) && readFileSync(file, 'utf8') === String(pid)) unlinkSync(file);
      } catch {
        // Nada que liberar.
      }
    },
  };
}
