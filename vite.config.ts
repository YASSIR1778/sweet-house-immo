import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

// GitHub Pages serves the site under /<repo>/ ; a custom domain later
// (immo.sweethouse.ma) just needs VITE_BASE=/ in the workflow.
const base = process.env.VITE_BASE ?? '/sweet-house-immo/'

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: { chunkSizeWarningLimit: 700 },
  server: { port: 5174 },
  preview: { port: 4174 },
})
