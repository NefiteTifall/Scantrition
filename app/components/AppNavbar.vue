<script setup lang="ts">
const route = useRoute()

const links = [
  { to: '/dashboard', icon: 'i-lucide-layout-dashboard', labelKey: 'nav.dashboard' },
  { to: '/add', icon: 'i-lucide-plus-circle', labelKey: 'nav.add' },
  { to: '/history', icon: 'i-lucide-calendar', labelKey: 'nav.history' },
  { to: '/settings', icon: 'i-lucide-settings', labelKey: 'nav.settings' }
]

function isActive(to: string) {
  if (to === '/add') return route.path.startsWith('/add')
  return route.path === to
}
</script>

<template>
  <nav class="bg-[var(--ui-bg)] border-t border-[var(--ui-border)] h-16">
    <div class="flex h-full max-w-xl mx-auto">
      <NuxtLink
        v-for="link in links"
        :key="link.to"
        :to="link.to"
        class="flex flex-1 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors"
        :class="isActive(link.to) ? 'text-primary' : 'text-[var(--ui-text-muted)] hover:text-[var(--ui-text)]'"
      >
        <UIcon
          :name="link.icon"
          class="w-5 h-5"
        />
        <span>{{ $t(link.labelKey) }}</span>
      </NuxtLink>
    </div>
  </nav>
</template>
