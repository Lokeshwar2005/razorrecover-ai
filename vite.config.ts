import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/razorrecover-ai/',
  build: {
    target: 'es2022',
    cssMinify: 'lightningcss',
    rollupOptions: { output: { manualChunks: { three: ['three'] } } },
  },
})
