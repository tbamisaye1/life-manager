import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Dedicated port so Life Manager never collides with other local apps
    // (e.g. another Vite project on 5173). strictPort makes this deterministic.
    port: 5180,
    strictPort: true,
    proxy: {
      // Local backend (Express + SQLite). Never points at any cloud host.
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
})
