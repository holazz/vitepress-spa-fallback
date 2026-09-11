import type { RenderBuiltAssetUrl } from 'vite'

export const ASSET_EXTENSIONS = 'css|js|mjs|json|svg|png|jpe?g|gif|webp|ico|woff2?|ttf|otf|eot'

const ROOT_ASSET_RE = new RegExp(`^/(?!/).+\\.(?:${ASSET_EXTENSIONS})(?:[?#].*)?$`, 'i')
const HTML_ASSET_RE = new RegExp(`\\b(href|src)=("|')(/(?!/)[^"'?#]+\\.(?:${ASSET_EXTENSIONS})(?:[?#][^"']*)?)\\2`, 'gi')
const EXTERNAL_URL_RE = /^(?:[a-z][a-z\d+\-.]*:|\/\/)/i

/**
 * Join assetsBase and a file path without duplicating slashes.
 * 拼接 assetsBase 与文件路径，避免重复斜杠。
 */
export function joinAssetUrl(assetsBase: string, path: string): string {
  const base = assetsBase.endsWith('/') ? assetsBase.slice(0, -1) : assetsBase
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

export function isRootAssetPath(path: string): boolean {
  return ROOT_ASSET_RE.test(path)
}

/**
 * Root-relative files go to assetsBase; page routes stay on site base.
 * 根路径静态文件改到 assetsBase，页面路由仍走站点 base。
 */
export function rewriteAssetUrl(path: string, assetsBase: string, pageBase = '/'): string {
  if (!assetsBase || EXTERNAL_URL_RE.test(path) || path.startsWith(assetsBase)) {
    return path
  }
  // Require a slash boundary so `/docs` does not steal `/docsfoo.svg`.
  // 必须按目录边界剥离，避免 `/docs` 误匹配 `/docsfoo.svg`。
  const prefix = pageBase === '/' ? '' : pageBase.endsWith('/') ? pageBase : `${pageBase}/`
  const relative = prefix && path.startsWith(prefix)
    ? `/${path.slice(prefix.length)}`
    : path
  return isRootAssetPath(relative) ? joinAssetUrl(assetsBase, relative) : path
}

/**
 * Rewrite root-relative href/src values in generated HTML.
 * 改写生成 HTML 中的根路径 href/src。
 */
export function rewriteHtmlAssetUrls(html: string, assetsBase: string, pageBase = '/'): string {
  if (!assetsBase) {
    return html
  }
  return html.replace(HTML_ASSET_RE, (match, attr: string, quote: string, path: string) => {
    const next = rewriteAssetUrl(path, assetsBase, pageBase)
    return next === path ? match : `${attr}=${quote}${next}${quote}`
  })
}

/**
 * Prefix Vite `type=public` URLs; leave `type=asset` unchanged.
 * 只改写 type=public 的构建 URL，不改 type=asset。
 */
export function createRenderBuiltUrl(
  assetsBase: { value: string },
  original?: RenderBuiltAssetUrl,
): RenderBuiltAssetUrl {
  return (filename, context) => {
    const originalResult = original?.(filename, context)
    if (originalResult !== undefined) {
      return originalResult
    }
    if (context.type === 'public' && assetsBase.value) {
      return joinAssetUrl(assetsBase.value, filename)
    }
  }
}
