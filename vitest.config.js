import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      reporter: ['text', 'html'],
      // TODO(Q06, Alex): activar thresholds cuando el core esté implementado.
      // Las bases exigen >=70% en reglas y algoritmo (src/domain, src/engine).
      // thresholds: { lines: 70, functions: 70, branches: 70, statements: 70 },
    },
  },
});
