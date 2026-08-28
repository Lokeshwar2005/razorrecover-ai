import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || (process.env.GITHUB_ACTIONS ? '/razorrecover-ai/' : '/'),
  build: {
    target: 'es2022',
  },
})
