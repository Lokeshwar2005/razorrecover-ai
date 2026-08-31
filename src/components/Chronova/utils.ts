/**
 * Utility functions for Chronova Storefront & RazorRecover AI
 */

export function resolveProductImageUrl(imgPath: string | undefined | null): string {
  if (!imgPath || typeof imgPath !== 'string' || !imgPath.trim()) {
    return 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=600&auto=format&fit=crop&q=80'
  }
  const clean = imgPath.trim()
  if (clean.startsWith('http://') || clean.startsWith('https://') || clean.startsWith('data:')) {
    return clean
  }
  const relativePath = clean.replace(/^\/?(razorrecover-ai\/)?/, '').replace(/^\.?\//, '')
  return `https://lokeshwar2005.github.io/razorrecover-ai/${relativePath}`
}

export function getAssetUrl(imgPath: string): string {
  return resolveProductImageUrl(imgPath)
}
