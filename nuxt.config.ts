// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxt/image',
    '@nuxt/hints',
    'nuxt-auth-utils',
    '@nuxtjs/i18n',
    '@vite-pwa/nuxt'
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  buildDir: '.nuxt',

  routeRules: {
    '/login': { prerender: true },
    '/register': { prerender: true }
  },

  compatibilityDate: '2025-01-15',

  app: {
    head: {
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/icon-32x32.png' },
        { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/icon-16x16.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' }
      ]
    }
  },

  vite: {
    server: {
      allowedHosts: ['scantrition.nguillaume.fr']
    }
  },

  typescript: {
    tsConfig: {
      include: ['types/**/*.d.ts']
    }
  },

  hooks: {
    close: () => {
      process.exit(0)
    }
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },

  i18n: {
    locales: [
      { code: 'fr', name: 'Français', file: 'fr.json' },
      { code: 'en', name: 'English', file: 'en.json' }
    ],
    defaultLocale: 'fr',
    langDir: 'locales/',
    strategy: 'no_prefix'
  },

  pwa: {
    manifest: {
      name: 'Scantrition',
      short_name: 'Scantrition',
      description: 'AI-powered nutrition tracker',
      theme_color: '#22c55e',
      background_color: '#0f172a',
      display: 'standalone',
      start_url: '/dashboard',
      icons: [
        { src: '/icon-72x72.png', sizes: '72x72', type: 'image/png' },
        { src: '/icon-96x96.png', sizes: '96x96', type: 'image/png' },
        { src: '/icon-128x128.png', sizes: '128x128', type: 'image/png' },
        { src: '/icon-144x144.png', sizes: '144x144', type: 'image/png' },
        { src: '/icon-152x152.png', sizes: '152x152', type: 'image/png' },
        { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
        { src: '/icon-256x256.png', sizes: '256x256', type: 'image/png' },
        { src: '/icon-384x384.png', sizes: '384x384', type: 'image/png' },
        { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
      ]
    },
    workbox: {
      navigateFallback: '/'
    },
    devOptions: {
      enabled: false
    }
  }
})
