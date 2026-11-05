import { useCallback, useState } from 'react';

const KEY = 'c4.preferences';
const read = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? {};
  } catch {
    return {};
  }
};

/** Preferencias en localStorage (quién empieza). Nunca el tablero ni datos del torneo. */
export function usePreferences() {
  const [prefs, setPrefs] = useState(() => ({ first: 'human', ...read() }));
  const update = useCallback((patch) => {
    setPrefs((p) => {
      const next = { ...p, ...patch };
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* sin almacenamiento */ }
      return next;
    });
  }, []);
  return [prefs, update];
}
