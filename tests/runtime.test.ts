import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { vitepressSpaFallback } from '../src'
import { patchRuntimeModule } from '../src/runtime'

const require = createRequire(import.meta.url)
const clientDir = join(dirname(require.resolve('vitepress/package.json')), 'dist/client/app')
const app = await readFile(join(clientDir, 'index.js'), 'utf8')
const router = await readFile(join(clientDir, 'router.js'), 'utf8')
const utils = await readFile(join(clientDir, 'utils.js'), 'utf8')

function transform(code: string, id: string, ssr = false, consumer = 'client') {
  const hook = vitepressSpaFallback().transform
  if (typeof hook !== 'function') {
    throw new TypeError('Expected a transform hook')
  }
  const context = { environment: { config: { consumer } } } as ThisParameterType<typeof hook>
  return hook.call(context, code, id, { ssr, moduleType: 'js' })
}

describe('runtime patches', () => {
  it('applies only to production builds and leaves unrelated modules alone', () => {
    expect(vitepressSpaFallback().apply).toBe('build')
    expect(transform(app, join(clientDir, 'index.js'), true)).toBeUndefined()
    expect(transform(app, join(clientDir, 'index.js'), false, 'server')).toBeUndefined()
    expect(transform(app, '/project/index.js')).toBeUndefined()
    expect(transform(utils, join(clientDir, 'utils.js'), true)).toContain('__ASSETS_BASE__')
  })

  it('handles query strings and Windows separators', () => {
    const id = `${join(clientDir, 'index.js').replaceAll('/', '\\')}?version=1`
    expect(transform(app, id)).toContain('document.querySelector("#app")?.hasChildNodes()')
  })

  it.each([
    [true, false, 'page.js'],
    [true, true, 'page.lean.js'],
    [false, true, 'page.js'],
  ])('chooses the page module for initial=%s, prerendered=%s', (initial, prerendered, expected) => {
    const statement = app.match(/if \(isInitialPageLoad\)[^\n]+/)![0]
    const transformed = transform(statement, join(clientDir, 'index.js'))
    const result = runInNewContext(`let pageFilePath = 'page.js'; ${transformed}; pageFilePath`, {
      isInitialPageLoad: initial,
      document: { querySelector: () => ({ hasChildNodes: () => prerendered }) },
    })
    expect(result).toBe(expected)
  })

  it.each([
    ['', '/docs/hashmap.json'],
    ['/static/site/', '/static/site/hashmap.json'],
    ['https://cdn.example.com/site/', 'https://cdn.example.com/site/hashmap.json'],
  ])('retries hashmap.json from %s', (assetsBase, expected) => {
    const statement = router.match(/fetch\(runtimeBase\(\) \+ "hashmap.json"\)/)![0]
    const transformed = transform(statement, join(clientDir, 'router.js'))
    expect(runInNewContext(String(transformed), {
      __ASSETS_BASE__: assetsBase,
      runtimeBase: () => '/docs/',
      fetch: (url: string) => url,
    })).toBe(expected)
  })

  it.each([
    ['/logo.svg', '/static/site/', '/static/site/logo.svg'],
    ['/static/site/logo.svg', '/static/site/', '/static/site/logo.svg'],
    ['/guide/', '/static/site/', '/docs/guide/'],
    ['/logo.svg', '', '/docs/logo.svg'],
    ['https://cdn.example.com/logo.svg', '/static/site/', 'https://cdn.example.com/logo.svg'],
  ])('withBase(%s) with assetsBase %s', (path, assetsBase, expected) => {
    const statement = utils.match(/return EXTERNAL_URL_RE\.test\(path\)[^\n]+/)![0]
    const transformed = patchRuntimeModule(statement, join(clientDir, 'utils.js'))
    expect(runInNewContext(`
      const EXTERNAL_URL_RE = /^(?:[a-z]+:|\\/\\/)/i
      function joinPath(base, path) {
        const protocol = /^(?:[a-z]+:)?\\/\\//i.exec(base)?.[0] ?? ''
        return protocol + (base.slice(protocol.length) + path).replace(/\\/+/g, '/')
      }
      function runtimeBase() { return '/docs/' }
      function withBase(path) { ${transformed} }
      withBase(${JSON.stringify(path)})
    `, { __ASSETS_BASE__: assetsBase })).toBe(expected)
  })

  it('rejects missing or duplicate patch targets', () => {
    for (const [source, file] of [[app, 'index.js'], [router, 'router.js'], [utils, 'utils.js']]) {
      expect(() => transform('export {}', join(clientDir, file))).toThrow('Expected one patch target')
      expect(() => transform(source + source, join(clientDir, file))).toThrow('Expected one patch target')
    }
  })
})
