/**
 * Utility functions for Chronova Storefront
 */

export function getAssetUrl(imgPath: string): string {
  if (!imgPath) return ''
  if (imgPath.startsWith('http://') || imgPath.startsWith('https://') || imgPath.startsWith('data:')) {
    return imgPath
  }
  const clean = imgPath.replace(/^\.?\//, '')
  const base = typeof window !== 'undefined' && window.location.pathname.startsWith('/razorrecover-ai')
    ? '/razorrecover-ai'
    : ''
  return `${base}/${clean}`
}
