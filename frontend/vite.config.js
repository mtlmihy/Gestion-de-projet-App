import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Clés avec "/" final : n'intercepte que les vraies requêtes API,
      // pas les requêtes de page (ex: GET /risques au refresh F5).
      // Sans le "/", Vite proxifiait /risques → FastAPI → 307 → localhost:8000.
      '/auth/':    { target: 'http://localhost:8000', changeOrigin: true, secure: false },
      '/risques/': { target: 'http://localhost:8000', changeOrigin: true, secure: false },
      '/taches/':  { target: 'http://localhost:8000', changeOrigin: true, secure: false },
      '/equipe/':  { target: 'http://localhost:8000', changeOrigin: true, secure: false },
      '/cdc/':     { target: 'http://localhost:8000', changeOrigin: true, secure: false },
      '/projets/': { target: 'http://localhost:8000', changeOrigin: true, secure: false },
      '/health':   { target: 'http://localhost:8000', changeOrigin: true, secure: false },
    },
  },
})
