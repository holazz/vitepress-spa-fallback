# vitepress-spa-fallback

Vite plugin for VitePress `2.0.0-alpha.20`. Adding it enables three build-time behaviors:

- clear the home page `#app` after SSG, keeping the rest of the HTML;
- load the full page module when that shell is empty; retry `hashmap.json` after a stale page-chunk failure;
- rewrite root-relative static file URLs (`href` / `src` / `withBase`) to the resolved asset prefix.

```ts
import { defineConfig } from 'vitepress'
import { vitepressSpaFallback } from 'vitepress-spa-fallback'

export default defineConfig({
  vite: {
    plugins: [vitepressSpaFallback()],
  },
})
```

Runtime patches apply only to production builds. Other prerendered pages are left intact.

Peer dependency is pinned to `vitepress@2.0.0-alpha.20`. The build fails if the expected runtime strings are missing, or if the plugin runs outside a VitePress build.
