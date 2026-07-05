export default defineNuxtConfig({
  compatibilityDate: '2026-07-01',
  ssr: false,
  devtools: { enabled: false },
  app: {
    head: {
      title: '激突 ミッドウェー ― 3D俯瞰ドキュメント',
      htmlAttrs: { lang: 'ja' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: '昭和17年6月 ミッドウェー海戦をテレビ特番風3D俯瞰で再現' }
      ]
    }
  }
})
