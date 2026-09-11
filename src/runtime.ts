import { ASSET_EXTENSIONS } from './url'

const APP_MODULE = '/vitepress/dist/client/app/index.js'
const ROUTER_MODULE = '/vitepress/dist/client/app/router.js'
const UTILS_MODULE = '/vitepress/dist/client/app/utils.js'
const LEAN_PAGE = 'if (isInitialPageLoad) pageFilePath = pageFilePath.replace(/\\.js$/, ".lean.js");'
const HASHMAP_FETCH = 'fetch(runtimeBase() + "hashmap.json")'
const WITH_BASE = 'return EXTERNAL_URL_RE.test(path) || !path.startsWith("/") ? path : joinPath(runtimeBase(), path);'
const WITH_BASE_PATCH = `return EXTERNAL_URL_RE.test(path) || !path.startsWith("/") || (__ASSETS_BASE__ && path.startsWith(__ASSETS_BASE__)) ? path : joinPath((__ASSETS_BASE__ && /\\.(?:${ASSET_EXTENSIONS})(?:[?#].*)?$/i.test(path) ? __ASSETS_BASE__ : runtimeBase()), path);`

/**
 * Require exactly one match in the pinned runtime instead of silently drifting.
 * 固定版本的运行时必须唯一命中补丁，避免内部代码变化后静默失效。
 */
function replaceOnce(code: string, search: string, replacement: string, id: string): string {
  const index = code.indexOf(search)
  if (index < 0 || code.includes(search, index + search.length)) {
    throw new Error(`[vitepress-spa-fallback] Expected one patch target in ${id}; check VitePress 2.0.0-alpha.20 compatibility.`)
  }
  return code.slice(0, index) + replacement + code.slice(index + search.length)
}

function normalizeModuleId(id: string): string {
  return id.split('?', 1)[0].replace(/\\/g, '/')
}

/**
 * Patch VitePress client modules. withBase also runs during SSR so prerendered URLs match the client.
 * 改写 VitePress 客户端模块；withBase 在 SSR 中也会执行，保证预渲染地址与客户端一致。
 */
export function patchRuntimeModule(
  code: string,
  id: string,
  options?: { ssr?: boolean },
  consumer = 'client',
): string | undefined {
  const moduleId = normalizeModuleId(id)
  if (moduleId.endsWith(UTILS_MODULE)) {
    return replaceOnce(code, WITH_BASE, WITH_BASE_PATCH, moduleId)
  }
  if (options?.ssr || consumer !== 'client') {
    return
  }
  if (moduleId.endsWith(APP_MODULE)) {
    return replaceOnce(
      code,
      LEAN_PAGE,
      'if (isInitialPageLoad && document.querySelector("#app")?.hasChildNodes()) pageFilePath = pageFilePath.replace(/\\.js$/, ".lean.js");',
      moduleId,
    )
  }
  if (moduleId.endsWith(ROUTER_MODULE)) {
    // VitePress defines __ASSETS_BASE__ after resolving config and CLI overrides.
    // VitePress 在解析配置与 CLI 覆盖后定义该常量，无需重复规范化前缀。
    return replaceOnce(code, HASHMAP_FETCH, 'fetch((__ASSETS_BASE__ || runtimeBase()) + "hashmap.json")', moduleId)
  }
}
