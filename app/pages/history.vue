<script setup lang="ts">
const { t } = useI18n()

const { data: history } = await useFetch('/api/history')

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

function isToday(dateStr: string) {
  return dateStr === new Date().toISOString().split('T')[0]
}

function exportCSV() {
  window.location.href = '/api/export/csv'
}
</script>

<template>
  <div class="max-w-xl mx-auto px-4 py-6 space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-bold">{{ t('history.title') }}</h1>
      <div class="flex gap-2">
        <UButton v-if="history?.length" size="sm" variant="outline" color="neutral" icon="i-lucide-trending-up" to="/trends">
          {{ t('history.trends') }}
        </UButton>
        <UButton v-if="history?.length" size="sm" variant="outline" color="neutral" icon="i-lucide-download" @click="exportCSV">
          {{ t('history.export') }}
        </UButton>
      </div>
    </div>

    <div v-if="history?.length" class="space-y-2">
      <NuxtLink
        v-for="day in history"
        :key="day.date"
        :to="`/dashboard?date=${day.date}`"
        class="block"
      >
        <UCard class="hover:border-primary transition-colors cursor-pointer">
          <div class="flex items-center justify-between">
            <div>
              <p class="font-medium capitalize">
                {{ isToday(day.date) ? t('dashboard.title') : formatDate(day.date) }}
              </p>
              <p class="text-xs text-[var(--ui-text-muted)] mt-0.5">
                {{ day.mealCount }} {{ t('history.meals') }}
              </p>
            </div>
            <div class="text-right">
              <p class="font-bold text-primary">{{ Math.round(day.totalCalories) }} {{ t('history.kcal') }}</p>
              <p class="text-xs text-[var(--ui-text-muted)]">
                P {{ Math.round(day.totalProtein) }}g · G {{ Math.round(day.totalCarbs) }}g · L {{ Math.round(day.totalFat) }}g
              </p>
            </div>
          </div>
        </UCard>
      </NuxtLink>
    </div>

    <UCard v-else class="text-center py-10">
      <UIcon name="i-lucide-calendar" class="w-10 h-10 mx-auto text-[var(--ui-text-muted)] mb-3" />
      <p class="text-[var(--ui-text-muted)]">{{ t('history.noData') }}</p>
    </UCard>
  </div>
</template>
