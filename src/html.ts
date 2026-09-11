const RAW_TEXT_TAGS = new Set(['script', 'style', 'textarea', 'title', 'xmp', 'iframe', 'noembed', 'noframes', 'noscript'])

/**
 * Clear only #app's contents without reserializing or changing surrounding HTML.
 * 仅清空 #app 内部，不重新序列化 HTML，保留外围内容与原有格式。
 */
export function createFallbackHtml(html: string): string {
  // Quoted attributes and comments may contain apparent tags or a fake id="app".
  // 带引号的属性和注释可能包含伪标签或伪 id="app"，必须按边界整体跳过。
  const tags = /<!--[\s\S]*?-->|<![^>]*>|<\/?([a-z][\w:-]*)(?=[\s/>])(?:[^<>"']|"[^"]*"|'[^']*')*>/gi
  let divDepth = 0
  let appDepth = -1
  let contentStart = -1
  let contentEnd = -1

  for (let match = tags.exec(html); match; match = tags.exec(html)) {
    if (!match[1]) {
      continue
    }
    const tag = match[1].toLowerCase()
    const closing = match[0].startsWith('</')
    if (closing) {
      if (tag === 'div') {
        if (contentStart >= 0 && contentEnd < 0 && divDepth === appDepth) {
          contentEnd = match.index
        }
        divDepth--
      }
      if (tag === 'body' && contentStart >= 0 && contentEnd < 0) {
        throw new Error('[vitepress-spa-fallback] Unclosed #app in generated index.html.')
      }
      continue
    }

    if (tag === 'div') {
      divDepth++
    }
    const attributes = match[0].slice(1 + match[1].length, -1)
    for (const attr of attributes.matchAll(/([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
      if (attr[1].toLowerCase() === 'id' && (attr[2] ?? attr[3] ?? attr[4]) === 'app') {
        if (contentStart >= 0) {
          throw new Error('[vitepress-spa-fallback] Duplicate #app in generated index.html.')
        }
        if (tag !== 'div') {
          throw new Error('[vitepress-spa-fallback] Expected a div for #app in generated index.html.')
        }
        contentStart = tags.lastIndex
        appDepth = divDepth
      }
    }

    // Raw text has its own closing tag; embedded <div> strings are not elements.
    // 原始文本区域由自身结束标签界定，其中的 <div> 字符串不是实际元素。
    if (RAW_TEXT_TAGS.has(tag)) {
      const endTag = new RegExp(`</${tag}\\s*>`, 'gi')
      endTag.lastIndex = tags.lastIndex
      if (!endTag.exec(html)) {
        throw new Error(`[vitepress-spa-fallback] Unclosed ${tag} in generated index.html.`)
      }
      tags.lastIndex = endTag.lastIndex
    }
  }

  if (contentStart < 0 || contentEnd < 0) {
    throw new Error('[vitepress-spa-fallback] Missing or unclosed #app in generated index.html.')
  }
  return html.slice(0, contentStart) + html.slice(contentEnd)
}
