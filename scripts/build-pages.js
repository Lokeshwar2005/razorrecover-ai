import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(__dirname, '../dist')

if (!fs.existsSync(distDir)) {
  console.error('dist directory does not exist. Run vite build first.')
  process.exit(1)
}

const indexHtml = path.join(distDir, 'index.html')
if (!fs.existsSync(indexHtml)) {
  console.error('dist/index.html does not exist.')
  process.exit(1)
}

const routes = [
  'dashboard',
  'opportunities',
  'transactions',
  'analytics/recovery',
  'analytics',
  'settings/policies',
  'settings',
  'audit',
  'audit-trail',
  'simulation',
  'agent-trace',
  'overview',
  'merchant-portal',
  'acme-store',
  'dual-sandbox',
  'chronosphere',
  'chronova',
  'watches',
  'store',
]

// 1. Create 404.html for GitHub Pages SPA fallback
fs.copyFileSync(indexHtml, path.join(distDir, '404.html'))
console.log('✓ Created dist/404.html for GitHub Pages SPA fallback')

// 2. Create physical route directories with index.html
for (const route of routes) {
  const targetDir = path.join(distDir, route)
  fs.mkdirSync(targetDir, { recursive: true })
  fs.copyFileSync(indexHtml, path.join(targetDir, 'index.html'))
  console.log(`✓ Created dist/${route}/index.html`)
}

console.log('🎉 GitHub Pages static route generation complete!')
