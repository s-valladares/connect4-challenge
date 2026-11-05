import { defineConfig } from 'vitest/config';

/**
 * `npm test` = TODAS las suites + cobertura V8 (comando único que piden las bases).
 * - Pruebas de backend: entorno node. Pruebas de React (tests/web/*.test.jsx):
 *   declaran `// @vitest-environment jsdom` en la primera línea.
 * - JSX sin plugin: esbuild con runtime automático de React 19.
 */
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    include: ['tests/**/*.test.{js,jsx}'],
    setupFiles: ['tests/setup.js'],
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['src/**', 'web/src/**'],
      // Puntos de entrada (solo leen env y llaman a módulos probados) y stubs P2.
      exclude: [
        'src/worker/main.js',
        'src/worker/supervisor.js',
        'src/infrastructure/http/server.js',
        'src/training/self-play.js',
        'src/training/benchmark.js',
        'src/training/tuners.js',
        'web/src/main.jsx',
      ],
      reporter: ['text', 'html', 'json-summary'],
      // TODO(Q06, Alex): activar thresholds cuando el core esté implementado.
      // Las bases exigen >=70% en reglas y algoritmo (src/domain, src/engine).
      // thresholds: { lines: 70, functions: 70, branches: 70, statements: 70 },
    },
  },
});
