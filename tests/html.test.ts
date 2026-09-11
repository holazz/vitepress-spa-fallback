import { describe, expect, it } from 'vitest'
import { createFallbackHtml } from '../src/html'

describe('createFallbackHtml', () => {
  it('preserves metadata, scripts and siblings around nested app contents byte-for-byte', () => {
    const before = '<html><head><script type="module" src="/assets/chunks/metadata.123.js"></script></head><body><div>before</div>'
    const after = '<aside>after</aside><div id="keep">keep</div><script>boot()</script></body></html>'
    const shell = `${before}<div id="app"></div>${after}`
    expect(createFallbackHtml(`${before}<div id="app"><main><div><div>home</div></div></main></div>${after}`)).toBe(shell)
    expect(createFallbackHtml(shell)).toBe(shell)
  })

  it('ignores fake tags and IDs inside comments, attributes and raw text', () => {
    const head = `<head><script>const fake = '<div id="app"></div>'</script><style>/* <div id="app"> */</style></head>`
    const before = `${head}<body><!-- <div id="app"></div> --><div title='id="app" > <div>'>before</div>`
    const after = '<textarea><div id="app"></div></textarea><div>after</div></body>'
    const inside = '<div>real</div><!-- </div> --><script>const fake = "</div>"</script>'
    expect(createFallbackHtml(`${before}<div id='app'>${inside}</div>${after}`)).toBe(`${before}<div id='app'></div>${after}`)
  })

  it.each(['id=app', 'class="x" id = "app"', 'ID=\'app\' data-x="a>b"'])(
    'recognizes the app attribute in %s',
    (attributes) => {
      expect(createFallbackHtml(`<DIV ${attributes}>home</DIV>`)).toBe(`<DIV ${attributes}></DIV>`)
    },
  )

  it.each([
    '<body><div>no app</div></body>',
    '<body><div id="app"><div>inner</div></body>',
    '<body><div id="app">no closing tag',
    '<div id="app"></div><div id="app"></div>',
    '<div id="app"><div id="app"></div></div>',
    '<main id="app">wrong element</main>',
  ])('rejects missing, duplicate and unclosed app containers: %s', (html) => {
    expect(() => createFallbackHtml(html)).toThrow('[vitepress-spa-fallback]')
  })
})
