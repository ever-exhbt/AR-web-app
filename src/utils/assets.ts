/// <reference types="vite/client" />

/**
 * Resolves a root-relative or relative asset path against Vite's base URL.
 * Handles both development ('/') and GitHub Pages ('/AR-web-app/').
 *
 * Examples:
 *   resolveAssetUrl('/content/assets/sample-model.glb')
 *     -> '/content/assets/sample-model.glb' (when BASE_URL is '/')
 *     -> '/AR-web-app/content/assets/sample-model.glb' (when BASE_URL is '/AR-web-app/')
 *
 *   resolveAssetUrl('sw.js')
 *     -> '/sw.js' (when BASE_URL is '/')
 *     -> '/AR-web-app/sw.js' (when BASE_URL is '/AR-web-app/')
 */
export function resolveAssetUrl(path: string, baseOverride?: string): string {
  if (!path) return path;

  // External URLs or blob/data schemes should not be touched
  if (/^(?:[a-z]+:)?\/\//i.test(path) || path.startsWith('data:') || path.startsWith('blob:')) {
    return path;
  }

  const base = baseOverride !== undefined ? baseOverride : (import.meta.env.BASE_URL || '/');
  const cleanBase = base.endsWith('/') ? base : `${base}/`;
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;

  return `${cleanBase}${cleanPath}`;
}
