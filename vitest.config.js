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
      // Q06 (Alex): las bases exigen >= 70 % en reglas y algoritmo; meta del equipo: 85 %.
      // Si la cobertura baja de estos números, `npm test` falla (y el CI del PR también).
      thresholds: {
        lines: 70, functions: 70, branches: 70, statements: 70,
        'src/domain/**': { lines: 85, functions: 85, branches: 85, statements: 85 },
        'src/engine/**': { lines: 85, functions: 85, branches: 80, statements: 85 },
      },
    },
  },
});
