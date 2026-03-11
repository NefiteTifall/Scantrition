<script setup lang="ts">
const { loggedIn, user, clear } = useUserSession()
const { t } = useI18n()

useHead({
  meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
  link: [{ rel: 'icon', href: '/favicon.ico' }],
  htmlAttrs: { lang: 'fr' }
})

useSeoMeta({
  title: 'Scantrition',
  description: 'Suivez votre nutrition avec l\'IA — texte, photo ou code-barres.'
})

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await clear()
  navigateTo('/login')
}
</script>

<template>
  <UApp>
    <div class="h-dvh flex flex-col overflow-hidden">
      <header class="shrink-0 z-40 bg-[var(--ui-bg)] border-b border-[var(--ui-border)]">
        <div class="flex items-center justify-between max-w-xl mx-auto px-4 h-14">
          <NuxtLink to="/dashboard" class="flex items-center gap-2">
            <UIcon name="i-lucide-leaf" class="w-6 h-6 text-primary" />
            <span class="font-bold text-lg tracking-tight">Scantrition</span>
          </NuxtLink>

          <div class="flex items-center gap-1">
            <UColorModeButton size="sm" />
            <UButton
              v-if="loggedIn"
              icon="i-lucide-log-out"
              variant="ghost"
              color="neutral"
              size="sm"
              :aria-label="t('auth.logout')"
              @click="logout"
            />
          </div>
        </div>
      </header>

      <main class="flex-1 overflow-y-auto">
        <NuxtPage />
      </main>

      <AppNavbar v-if="loggedIn" class="shrink-0" />
    </div>
  </UApp>
</template>
