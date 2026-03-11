<script setup lang="ts">
const { t } = useI18n()

const { data } = await useFetch('/api/stats/trends', { query: { days: 30 } })

const days = computed(() => data.value?.days ?? [])
const goals = computed(() => data.value?.goals ?? { calories: 2000, protein: 150, carbs: 250, fat: 70 })
const averages = computed(() => data.value?.averages ?? { calories: 0, protein: 0, carbs: 0, fat: 0 })

const maxCalories = computed(() =>
  Math.max(goals.value.calories, ...days.value.map(d => d.totalCalories), 1)
)

function barHeight(calories: number) {
  return Math.round((calories / maxCalories.value) * 100)
}

function goalHeight() {
  return Math.round((goals.value.calories / maxCalories.value) * 100)
}

function barColor(calories: number) {
  const ratio = calories / goals.value.calories
  if (ratio > 1.1) return 'bg-red-400'
  if (ratio >= 0.85) return 'bg-primary'
  return 'bg-primary/50'
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

const goalPercent = computed(() =>
  averages.value.calories > 0
    ? Math.round((averages.value.calories / goals.value.calories) * 100)
    : 0
)
</script>

<template>
  <div class="max-w-xl mx-auto px-4 py-6 space-y-6">
    <div class="flex items-center gap-3">
      <UButton icon="i-lucide-arrow-left" variant="ghost" color="neutral" size="sm" to="/history" />
      <h1 class="text-xl font-bold">{{ t('trends.title') }}</h1>
    </div>

    <div v-if="!days.length" class="text-center py-16 text-[var(--ui-text-muted)]">
      <UIcon name="i-lucide-bar-chart-2" class="w-12 h-12 mx-auto mb-3 opacity-40" />
      <p>{{ t('trends.noData') }}</p>
    </div>

    <template v-else>
      <!-- Summary cards -->
      <div class="grid grid-cols-2 gap-3">
        <UCard>
          <p class="text-xs text-[var(--ui-text-muted)]">{{ t('trends.avgCalories') }}</p>
          <p class="text-2xl font-bold text-primary mt-1">{{ averages.calories }}</p>
          <p class="text-xs text-[var(--ui-text-muted)]">{{ goalPercent }}% {{ t('trends.goalLine').toLowerCase() }}</p>
        </UCard>
        <UCard>
          <p class="text-xs text-[var(--ui-text-muted)]">{{ t('trends.trackedDays') }}</p>
          <p class="text-2xl font-bold mt-1">{{ days.length }}</p>
          <p class="text-xs text-[var(--ui-text-muted)]">{{ t('trends.last30') }}</p>
        </UCard>
        <UCard>
          <p class="text-xs text-[var(--ui-text-muted)]">{{ t('trends.avgProtein') }}</p>
          <p class="text-2xl font-bold mt-1">{{ averages.protein }}g</p>
          <p class="text-xs text-[var(--ui-text-muted)]">objectif {{ goals.protein }}g</p>
        </UCard>
        <UCard>
          <p class="text-xs text-[var(--ui-text-muted)]">{{ t('trends.avgCarbs') }}</p>
          <p class="text-2xl font-bold mt-1">{{ averages.carbs }}g</p>
          <p class="text-xs text-[var(--ui-text-muted)]">objectif {{ goals.carbs }}g</p>
        </UCard>
      </div>

      <!-- Calories bar chart -->
      <UCard>
        <template #header>
          <p class="font-semibold">{{ t('trends.caloriesChart') }}</p>
        </template>

        <div class="relative">
          <!-- Goal line -->
          <div
            class="absolute left-0 right-0 border-t border-dashed border-primary/40 z-10 pointer-events-none"
            :style="{ bottom: `${goalHeight()}%` }"
          />

          <!-- Bars -->
          <div class="flex items-end gap-1 h-40 overflow-x-auto pb-6">
            <div
              v-for="day in [...days].reverse()"
              :key="day.date"
              class="flex flex-col items-center gap-1 shrink-0"
              style="min-width: 28px"
            >
              <div class="w-full flex items-end" style="height: 128px">
                <div
                  class="w-full rounded-t transition-all"
                  :class="barColor(day.totalCalories)"
                  :style="{ height: `${barHeight(day.totalCalories)}%` }"
                  :title="`${Math.round(day.totalCalories)} kcal`"
                />
              </div>
              <span class="text-[10px] text-[var(--ui-text-muted)] rotate-45 origin-left whitespace-nowrap">
                {{ formatDate(day.date) }}
              </span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-4 mt-2 text-xs text-[var(--ui-text-muted)]">
          <div class="flex items-center gap-1">
            <div class="w-3 h-3 rounded bg-primary" />
            <span>Dans l'objectif</span>
          </div>
          <div class="flex items-center gap-1">
            <div class="w-3 h-3 rounded bg-red-400" />
            <span>Au-dessus</span>
          </div>
          <div class="flex items-center gap-1">
            <div class="w-6 border-t border-dashed border-primary/40" />
            <span>{{ t('trends.goalLine') }}</span>
          </div>
        </div>
      </UCard>

      <!-- Macros table -->
      <UCard>
        <template #header>
          <p class="font-semibold">Détail par jour</p>
        </template>
        <div class="space-y-2">
          <div
            v-for="day in days"
            :key="day.date"
            class="flex items-center justify-between text-sm py-1 border-b border-[var(--ui-border)] last:border-0"
          >
            <span class="text-[var(--ui-text-muted)] w-24 shrink-0">{{ formatDate(day.date) }}</span>
            <span class="font-bold text-primary w-20 text-right">{{ Math.round(day.totalCalories) }} kcal</span>
            <span class="text-[var(--ui-text-muted)] text-xs">
              P{{ Math.round(day.totalProtein) }} G{{ Math.round(day.totalCarbs) }} L{{ Math.round(day.totalFat) }}
            </span>
          </div>
        </div>
      </UCard>
    </template>
  </div>
</template>
