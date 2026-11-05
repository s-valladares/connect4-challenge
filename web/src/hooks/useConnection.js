import { useCallback, useEffect, useState } from 'react';
import defaultApi from '../api/client.js';

/** Consulta GET /api/health al abrir y cada `intervalMs`: 'checking' | 'online' | 'offline'. */
export function useConnection(api = defaultApi, intervalMs = 10_000) {
  const [status, setStatus] = useState('checking');

  const check = useCallback(async () => {
    try {
      await api.checkHealth();
      setStatus('online');
    } catch {
      setStatus('offline');
    }
  }, [api]);

  useEffect(() => {
    check();
    const id = setInterval(check, intervalMs);
    return () => clearInterval(id);
  }, [check, intervalMs]);

  return { status, check };
}
