import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Proxy: el frontend llama /api/... y Vite lo reenvía a la API local (npm run api).
// Así no hay CORS ni URLs hardcodeadas en el código de React.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
