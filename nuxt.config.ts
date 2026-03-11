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

  routeRules: {
    '/login': { prerender: true },
    '/register': { prerender: true }
  },

  compatibilityDate: '2025-01-15',

  buildDir: '.nuxt',

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

  hooks: {
    close: () => {
      process.exit(0)
    }
  },

  pwa: {
    manifest: {
      name: 'Scantrition',
      short_name: 'Scantrition',
      description: 'AI-powered nutrition tracker',
      theme_color: '#22c55e',
      background_color: '#0f172a',
      display: 'standalone',
      start_url: '/dashboard'
    },
    workbox: {
      navigateFallback: '/'
    },
    devOptions: {
      enabled: false
    }
  }
})
