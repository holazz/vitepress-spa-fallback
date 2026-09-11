import { describe, expect, it } from 'vitest'
import {
  createRenderBuiltUrl,
  isRootAssetPath,
  joinAssetUrl,
  rewriteAssetUrl,
  rewriteHtmlAssetUrls,
} from '../src/url'

describe('asset URLs', () => {
  it('joins assetsBase without duplicating slashes', () => {
    expect(joinAssetUrl('/static/site/', '/logo.svg')).toBe('/static/site/logo.svg')
    expect(joinAssetUrl('/static/site', 'logo.svg')).toBe('/static/site/logo.svg')
    expect(joinAssetUrl('https://cdn.example.com/site/', '/logo.svg')).toBe('https://cdn.example.com/site/logo.svg')
  })

  it('rewrites root-relative files, including site-base prefixes', () => {
    expect(rewriteAssetUrl('/logo.svg', '/static/site/', '/docs/')).toBe('/static/site/logo.svg')
    expect(rewriteAssetUrl('/docs/logo.svg', '/static/site/', '/docs/')).toBe('/static/site/logo.svg')
    expect(rewriteAssetUrl('/docs/logo.svg', '/static/site/', '/docs')).toBe('/static/site/logo.svg')
    expect(rewriteAssetUrl('/docsfoo.svg', '/static/site/', '/docs')).toBe('/static/site/docsfoo.svg')
    expect(rewriteAssetUrl('/static/site/logo.svg', '/static/site/', '/docs/')).toBe('/static/site/logo.svg')
    expect(rewriteAssetUrl('/guide/', '/static/site/', '/docs/')).toBe('/guide/')
    expect(rewriteAssetUrl('/logo.svg', '', '/docs/')).toBe('/logo.svg')
    expect(rewriteAssetUrl('https://cdn.example.com/logo.svg', '/static/site/')).toBe('https://cdn.example.com/logo.svg')
  })

  it('only treats root paths with asset extensions as files', () => {
    expect(isRootAssetPath('/logo.svg')).toBe(true)
    expect(isRootAssetPath('/favicon.ico?v=1')).toBe(true)
    expect(isRootAssetPath('/guide/')).toBe(false)
    expect(isRootAssetPath('logo.svg')).toBe(false)
  })

  it('rewrites href/src in HTML and leaves page links alone', () => {
    const html = '<a href="/guide/">g</a><img src="/hero.svg"><link rel="icon" href="/docs/favicon.svg">'
    expect(rewriteHtmlAssetUrls(html, '/static/site/', '/docs/')).toBe(
      '<a href="/guide/">g</a><img src="/static/site/hero.svg"><link rel="icon" href="/static/site/favicon.svg">',
    )
    expect(rewriteHtmlAssetUrls(html, '')).toBe(html)
  })

  it('rewrites type=public URLs and keeps user results', () => {
    const userHook = (filename: string) => filename === 'custom.svg' ? '/from-user' : undefined
    const render = createRenderBuiltUrl({ value: '/static/site/' }, userHook)
    const publicCtx = { type: 'public', hostId: '', hostType: 'html', ssr: false } as const
    const assetCtx = { type: 'asset', hostId: '', hostType: 'js', ssr: false } as const

    expect(render('/logo.svg', publicCtx)).toBe('/static/site/logo.svg')
    expect(render('assets/app.js', assetCtx)).toBeUndefined()
    expect(render('custom.svg', publicCtx)).toBe('/from-user')
  })
})
