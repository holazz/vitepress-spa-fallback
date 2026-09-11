import process from 'node:process'
import { defineConfig } from 'vitepress'
import { vitepressSpaFallback } from 'vitepress-spa-fallback'

export default defineConfig({
  base: '/docs/',
  assetsBase: process.env.TEST_ASSETS_BASE || undefined,
  cleanUrls: true,
  useWebFonts: false,
  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'Fixture',
  },
  head: [
    ['link', { rel: 'icon', href: '/favicon.svg' }],
  ],
  vite: {
    plugins: [vitepressSpaFallback()],
  },
})
