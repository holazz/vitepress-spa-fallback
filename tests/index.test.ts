import type { Plugin } from 'vite'
import type { SiteConfig, TransformContext } from 'vitepress'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { vitepressSpaFallback } from '../src'

function getHook<Name extends 'config' | 'configResolved'>(plugin: Plugin, name: Name) {
  const hook = plugin[name]
  if (typeof hook !== 'function') {
    throw new TypeError(`Expected ${name} hook`)
  }
  return hook
}

function siteConfig(partial: Record<string, unknown>): SiteConfig {
  return partial as unknown as SiteConfig
}

describe('vitepressSpaFallback', () => {
  const directories: string[] = []
  afterEach(async () => {
    await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
  })

  it('wraps VitePress buildEnd after the user hook and is idempotent', async () => {
    const outDir = await mkdtemp(join(tmpdir(), 'vitepress-spa-fallback-'))
    directories.push(outDir)
    const originalBuildEnd = vi.fn(async (config: SiteConfig) => {
      await writeFile(join(config.outDir, 'index.html'), '<html><body><div id="app"><main>home</main></div></body></html>')
    })
    const config = siteConfig({
      outDir,
      buildEnd: originalBuildEnd,
      site: { base: '/docs/' },
    })
    const plugin = vitepressSpaFallback()
    const configResolved = getHook(plugin, 'configResolved')
    const resolved = { vitepress: config } as never

    await configResolved.call({} as ThisParameterType<typeof configResolved>, resolved)
    await configResolved.call({} as ThisParameterType<typeof configResolved>, resolved)
    await config.buildEnd?.(config)

    expect(originalBuildEnd).toHaveBeenCalledOnce()
    expect(await readFile(join(outDir, 'index.html'), 'utf8')).toContain('<div id="app"></div>')
  })

  it('propagates a failing user buildEnd instead of overwriting its result', async () => {
    const config = siteConfig({
      outDir: '/not-used',
      buildEnd() {
        throw new Error('user hook failed')
      },
      site: { base: '/docs/' },
    })
    const plugin = vitepressSpaFallback()
    const configResolved = getHook(plugin, 'configResolved')

    await configResolved.call({} as ThisParameterType<typeof configResolved>, { vitepress: config } as never)

    await expect(config.buildEnd?.(config)).rejects.toThrow('user hook failed')
  })

  it('rewrites root-relative URLs after the user transformHtml hook', async () => {
    const original = vi.fn(async (code: string) => code.replace('hero', 'logo'))
    const config = siteConfig({
      transformHtml: original,
      assetsBase: '/static/site/',
      site: { base: '/docs/' },
    })
    const plugin = vitepressSpaFallback()
    const configResolved = getHook(plugin, 'configResolved')
    await configResolved.call({} as ThisParameterType<typeof configResolved>, { vitepress: config } as never)

    const html = await config.transformHtml?.(
      '<img src="/hero.svg">',
      'index.html',
      { siteConfig: config } as TransformContext,
    )

    expect(original).toHaveBeenCalledOnce()
    expect(html).toBe('<img src="/static/site/logo.svg">')
  })

  it('rewrites type=public URLs through renderBuiltUrl and keeps user results', async () => {
    const userHook = vi.fn((filename: string) => filename === 'keep.svg' ? '/from-user' : undefined)
    const plugin = vitepressSpaFallback()
    const next = await getHook(plugin, 'config').call({} as never, {
      experimental: { renderBuiltUrl: userHook },
    }, { command: 'build', mode: 'production' })
    const render = next && 'experimental' in next ? next.experimental?.renderBuiltUrl : undefined
    if (!render) {
      throw new TypeError('Expected renderBuiltUrl')
    }

    await getHook(plugin, 'configResolved').call({} as never, {
      vitepress: siteConfig({ assetsBase: '/static/site/', site: { base: '/docs/' } }),
    } as never)

    const publicCtx = { type: 'public', hostId: '', hostType: 'html', ssr: false } as const
    const assetCtx = { type: 'asset', hostId: '', hostType: 'js', ssr: false } as const
    expect(render('/logo.svg', publicCtx)).toBe('/static/site/logo.svg')
    expect(render('assets/app.js', assetCtx)).toBeUndefined()
    expect(render('keep.svg', publicCtx)).toBe('/from-user')
  })

  it('fails when VitePress did not attach site config', () => {
    const plugin = vitepressSpaFallback()
    expect(() => getHook(plugin, 'configResolved').call({} as never, {} as never))
      .toThrow('config.vitepress is missing')
  })

  it('does not wrap hooks twice when the plugin is installed twice', async () => {
    const outDir = await mkdtemp(join(tmpdir(), 'vitepress-spa-fallback-'))
    directories.push(outDir)
    const originalBuildEnd = vi.fn(async (site: SiteConfig) => {
      await writeFile(join(site.outDir, 'index.html'), '<html><body><div id="app"><main>home</main></div></body></html>')
    })
    const config = siteConfig({
      outDir,
      buildEnd: originalBuildEnd,
      site: { base: '/docs/' },
    })
    const resolved = { vitepress: config } as never
    await getHook(vitepressSpaFallback(), 'configResolved').call({} as never, resolved)
    await getHook(vitepressSpaFallback(), 'configResolved').call({} as never, resolved)
    await config.buildEnd?.(config)
    expect(originalBuildEnd).toHaveBeenCalledOnce()
  })

  it('fails clearly when the home page is missing', async () => {
    const config = siteConfig({
      outDir: '/not-used',
      site: { base: '/docs/' },
    })
    await getHook(vitepressSpaFallback(), 'configResolved').call({} as never, { vitepress: config } as never)
    await expect(config.buildEnd?.(config)).rejects.toThrow('Missing /not-used/index.html')
  })
})
