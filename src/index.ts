import type { Plugin } from 'vite'
import type { SiteConfig } from 'vitepress'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createFallbackHtml } from './html'
import { patchRuntimeModule } from './runtime'
import { createRenderBuiltUrl, rewriteHtmlAssetUrls } from './url'

const HOOKED = Symbol.for('vitepress-spa-fallback:hooks')

/**
 * Empty the home page after the user's buildEnd hook.
 * 在用户的 buildEnd 之后清空首页。
 */
function wrapBuildEnd(siteConfig: SiteConfig): void {
  const original = siteConfig.buildEnd
  siteConfig.buildEnd = async (config) => {
    await original?.(config)
    const file = join(config.outDir, 'index.html')
    let html: string
    try {
      html = await readFile(file, 'utf8')
    } catch (error) {
      throw new Error(`[vitepress-spa-fallback] Missing ${file}.`, { cause: error })
    }
    const shell = createFallbackHtml(html)
    if (shell !== html) {
      await writeFile(file, shell)
    }
  }
}

/**
 * Rewrite leftover root-relative asset URLs in generated HTML.
 * 改写生成 HTML 里残留的根路径静态资源地址。
 */
function wrapTransformHtml(siteConfig: SiteConfig): void {
  const original = siteConfig.transformHtml
  siteConfig.transformHtml = async (code, id, context) => {
    const transformed = await original?.(code, id, context) ?? code
    return rewriteHtmlAssetUrls(
      transformed,
      context.siteConfig.assetsBase ?? '',
      context.siteConfig.site.base,
    )
  }
}

/**
 * 1. config: prefix type=public built URLs with assetsBase
 * 2. configResolved: wrap buildEnd / transformHtml once (client and SSR share SiteConfig)
 * 3. transform: patch withBase, empty-shell page modules, and hashmap retry
 * 1. config：给 type=public 的构建 URL 接上 assetsBase
 * 2. configResolved：挂一次 buildEnd / transformHtml（client 与 SSR 共用同一份 SiteConfig）
 * 3. transform：补丁 withBase、空壳走完整页、hashmap 重试
 */
export function vitepressSpaFallback(): Plugin {
  const assetsBase = { value: '' }

  return {
    name: 'vitepress-spa-fallback',
    apply: 'build',
    // Run first so later VitePress hooks wrap this renderBuiltUrl instead of the reverse.
    // 先注册，让后续 VitePress 钩子包住本插件的 renderBuiltUrl，而不是反过来。
    enforce: 'pre',
    config(userConfig) {
      return {
        experimental: {
          ...userConfig.experimental,
          renderBuiltUrl: createRenderBuiltUrl(
            assetsBase,
            userConfig.experimental?.renderBuiltUrl,
          ),
        },
      }
    },
    configResolved(config) {
      const siteConfig = config.vitepress
      if (!siteConfig) {
        throw new Error('[vitepress-spa-fallback] Expected a VitePress build (config.vitepress is missing).')
      }
      assetsBase.value = siteConfig.assetsBase ?? ''
      // Client and SSR each resolve config once against the same SiteConfig.
      // client 与 SSR 会各解析一次配置，但拿到的是同一份 SiteConfig。
      if (HOOKED in siteConfig) {
        return
      }
      Object.defineProperty(siteConfig, HOOKED, { value: true })
      wrapBuildEnd(siteConfig)
      wrapTransformHtml(siteConfig)
    },
    transform(code, id, options) {
      return patchRuntimeModule(code, id, options, this.environment.config.consumer)
    },
  }
}
