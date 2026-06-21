import process from 'node:process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const webPort = Number(process.env.LM_WEB_PORT || 5180)
const apiPort = Number(process.env.LM_API_PORT || 4000)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Default 5180; agents use LM_WEB_PORT=5181+ for parallel local testing.
    port: webPort,
    strictPort: true,
    proxy: {
      '/api': {
        target: `http://localhost:${apiPort}`,
        changeOrigin: true,
      },
    },
  },
})
