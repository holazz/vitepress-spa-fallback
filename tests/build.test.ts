import { execFile } from 'node:child_process'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const exec = promisify(execFile)
const require = createRequire(import.meta.url)
const root = fileURLToPath(new URL('..', import.meta.url))
const cli = join(dirname(require.resolve('vitepress/package.json')), 'bin/vitepress.js')
let outputRoot: string

async function readScripts(directory: string): Promise<string> {
  const files = await readdir(directory, { withFileTypes: true })
  return (await Promise.all(files.map(entry => entry.isDirectory()
    ? readScripts(join(directory, entry.name))
    : entry.name.endsWith('.js') ? readFile(join(directory, entry.name), 'utf8') : ''))).join('\n')
}

describe.sequential('vitepress alpha.20 build', () => {
  beforeAll(async () => {
    outputRoot = await mkdtemp(join(tmpdir(), 'vitepress-spa-build-'))
    const tsdownPackage = require.resolve('tsdown/package.json')
    const { bin } = JSON.parse(await readFile(tsdownPackage, 'utf8')) as { bin: Record<string, string> }
    await exec(process.execPath, [join(dirname(tsdownPackage), bin.tsdown), '--config', 'tsdown.config.ts'], { cwd: root })
  }, 30_000)

  afterAll(async () => {
    if (outputRoot) {
      await rm(outputRoot, { recursive: true, force: true })
    }
  })

  it.each([
    { name: 'no prefix', assetsBase: '', args: [], expected: '/docs/' },
    { name: 'no trailing slash', assetsBase: '/static/site', args: [], expected: '/static/site/' },
    { name: 'trailing slash', assetsBase: '/static/site/', args: [], expected: '/static/site/' },
    { name: 'CLI override', assetsBase: '/static/old/', args: ['--assetsBase', '/static/override'], expected: '/static/override/' },
  ])('$name', async ({ name, assetsBase, args, expected }) => {
    const outDir = join(outputRoot, name.replaceAll(' ', '-'))
    await exec(process.execPath, [cli, 'build', 'tests/fixtures/site', '--outDir', outDir, ...args], {
      cwd: root,
      env: { ...process.env, TEST_ASSETS_BASE: assetsBase },
      timeout: 30_000,
    })
    const home = await readFile(join(outDir, 'index.html'), 'utf8')
    const guide = await readFile(join(outDir, 'guide/intro.html'), 'utf8')
    const scripts = await readScripts(join(outDir, 'assets'))

    expect(home).toContain('VitePress v2.0.0-alpha.20')
    expect(home).toContain('<div id="app"></div>')
    expect(home).toContain(`${expected}assets/chunks/metadata.`)
    expect(home).toContain(`${expected}assets/app.`)
    expect(home).toContain(`${expected}assets/style.`)
    expect(guide).toContain('This content must remain in the prerendered guide.')
    expect(guide).toContain('.lean.js')
    expect(guide).toContain('logo.svg')
    expect(guide).toContain('hero.svg')
    expect(home).toContain('favicon.svg')
    expect(scripts).toContain('hasChildNodes()')
    expect(scripts).not.toContain('__ASSETS_BASE__')
    expect(JSON.parse(await readFile(join(outDir, 'hashmap.json'), 'utf8'))).toHaveProperty('guide_intro.md')
    if (assetsBase) {
      expect(scripts).toContain(`${expected}hashmap.json`)
      expect(home).toContain(`${expected}favicon.svg`)
      expect(guide).toContain(`${expected}logo.svg`)
      expect(guide).toContain(`${expected}hero.svg`)
      expect(guide).not.toContain('/docs/logo.svg')
      expect(guide).not.toContain('/docs/hero.svg')
    } else {
      expect(guide).toContain('/docs/logo.svg')
    }
    expect(home).not.toContain('/docs/static/')
  }, 30_000)
})
