<script setup lang="ts">
const props = defineProps<{
  consumed: { calories: number; protein: number; carbs: number; fat: number }
  goals: { calories: number; protein: number; carbs: number; fat: number }
}>()

const { t } = useI18n()

function pct(value: number, goal: number) {
  if (!goal) return 0
  return Math.min(100, Math.round((value / goal) * 100))
}

const calPct = computed(() => pct(props.consumed.calories, props.goals.calories))
const calRemaining = computed(() => Math.max(0, props.goals.calories - props.consumed.calories))

const macros = computed(() => [
  { key: 'protein', label: t('dashboard.protein'), value: Math.round(props.consumed.protein), goal: props.goals.protein, color: '#3b82f6' },
  { key: 'carbs', label: t('dashboard.carbs'), value: Math.round(props.consumed.carbs), goal: props.goals.carbs, color: '#f59e0b' },
  { key: 'fat', label: t('dashboard.fat'), value: Math.round(props.consumed.fat), goal: props.goals.fat, color: '#ef4444' }
])
</script>

<template>
  <UCard>
    <!-- Calories row -->
    <div class="flex items-baseline justify-between mb-1">
      <div class="flex items-baseline gap-1.5">
        <span class="text-2xl font-bold">{{ Math.round(consumed.calories) }}</span>
        <span class="text-xs text-[var(--ui-text-muted)]">/ {{ goals.calories }} kcal</span>
      </div>
      <span class="text-xs text-[var(--ui-text-muted)]">{{ calRemaining }} {{ t('dashboard.remaining') }}</span>
    </div>
    <div class="w-full bg-[var(--ui-border)] rounded-full h-2 overflow-hidden mb-4">
      <div
        class="h-2 rounded-full transition-all duration-500"
        :class="calPct >= 100 ? 'bg-red-500' : calPct >= 85 ? 'bg-amber-500' : 'bg-primary'"
        :style="{ width: `${calPct}%` }"
      />
    </div>

    <!-- Macro rows -->
    <div class="space-y-2">
      <div v-for="macro in macros" :key="macro.key" class="flex items-center gap-3">
        <span class="text-xs text-[var(--ui-text-muted)] w-16 shrink-0">{{ macro.label }}</span>
        <div class="flex-1 bg-[var(--ui-border)] rounded-full h-1.5 overflow-hidden">
          <div
            class="h-1.5 rounded-full transition-all duration-500"
            :style="{ width: `${pct(macro.value, macro.goal)}%`, backgroundColor: macro.color }"
          />
        </div>
        <span class="text-xs text-right shrink-0 w-16">
          <span class="font-medium">{{ macro.value }}</span>
          <span class="text-[var(--ui-text-muted)]"> / {{ macro.goal }}g</span>
        </span>
      </div>
    </div>
  </UCard>
</template>
