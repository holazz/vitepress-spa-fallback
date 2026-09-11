# vitepress-spa-fallback

面向 VitePress `2.0.0-alpha.20` 的 Vite 插件。加上即启用三件事：

- SSG 结束后清空首页 `#app`，外围 HTML 不动；
- 空壳加载完整页面模块；页面 chunk 过期时重试 `hashmap.json`；
- 把根路径静态资源（`href` / `src` / `withBase`）改到最终解析的资源前缀。

```ts
import { defineConfig } from 'vitepress'
import { vitepressSpaFallback } from 'vitepress-spa-fallback'

export default defineConfig({
  vite: {
    plugins: [vitepressSpaFallback()],
  },
})
```

运行时补丁只在生产构建生效。其他预渲染页面保持原样。

peer dependency 锁定 `vitepress@2.0.0-alpha.20`。对不上预期运行时字符串，或不是 VitePress 构建，会直接失败。
