/**
 * Supervisor opcional (P1): reinicia el worker si el proceso muere,
 * garantizando que NUNCA haya dos instancias con el mismo token.
 * Alternativa operativa: pm2/launchd + checklist de energía (O02).
 * Owner: Salva (O02).
 */

// TODO(O02): spawn de src/worker/main.js con reinicio ante exit code != 0,
// lockfile/pid para exclusión de instancia única.
