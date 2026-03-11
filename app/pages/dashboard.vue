<script setup lang="ts">
const { t } = useI18n()

const today = new Date().toISOString().split('T')[0] ?? ''
const currentDate = ref(today)

const { data: meals, refresh: refreshMeals } = await useFetch('/api/meals', {
  query: computed(() => ({ date: currentDate.value }))
})

const { data: goals } = await useFetch('/api/goals')

const consumed = computed(() => {
  const list = meals.value ?? []
  return list.reduce(
    (acc, m) => ({
      calories: acc.calories + (m.totalCalories ?? 0),
      protein: acc.protein + (m.totalProtein ?? 0),
      carbs: acc.carbs + (m.totalCarbs ?? 0),
      fat: acc.fat + (m.totalFat ?? 0)
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  )
})

const defaultGoals = { calories: 2000, protein: 150, carbs: 250, fat: 70, fiber: 25 }
const safeGoals = computed(() => goals.value ?? defaultGoals)

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
}

function prevDay() {
  const d = new Date(currentDate.value + 'T12:00:00')
  d.setDate(d.getDate() - 1)
  currentDate.value = d.toISOString().split('T')[0] ?? ''
}

function nextDay() {
  const d = new Date(currentDate.value + 'T12:00:00')
  d.setDate(d.getDate() + 1)
  currentDate.value = d.toISOString().split('T')[0] ?? ''
}

const isToday = computed(() => currentDate.value === today)

type MealCategory = 'breakfast' | 'lunch' | 'snack' | 'dinner'

const categoryOrder: MealCategory[] = ['breakfast', 'lunch', 'snack', 'dinner']

const categoryMeta: Record<MealCategory, { icon: string, colorClass: string, bgClass: string }> = {
  breakfast: { icon: 'i-lucide-sunrise', colorClass: 'text-orange-400', bgClass: 'bg-orange-400/15' },
  lunch: { icon: 'i-lucide-sun', colorClass: 'text-green-400', bgClass: 'bg-green-400/15' },
  snack: { icon: 'i-lucide-apple', colorClass: 'text-violet-400', bgClass: 'bg-violet-400/15' },
  dinner: { icon: 'i-lucide-moon', colorClass: 'text-blue-400', bgClass: 'bg-blue-400/15' }
}

const categoryMacros = computed(() => {
  const result = {} as Record<MealCategory, { protein: number, carbs: number, fat: number }>
  for (const cat of categoryOrder) {
    const ms = (meals.value ?? []).filter(m => m.mealCategory === cat)
    result[cat] = {
      protein: ms.reduce((s, m) => s + (m.totalProtein ?? 0), 0),
      carbs: ms.reduce((s, m) => s + (m.totalCarbs ?? 0), 0),
      fat: ms.reduce((s, m) => s + (m.totalFat ?? 0), 0)
    }
  }
  return result
})

const mealsByCategory = computed(() => {
  const list = meals.value ?? []
  const result = {} as Record<MealCategory | 'none', typeof list>
  for (const cat of categoryOrder) {
    result[cat] = list.filter(m => m.mealCategory === cat)
  }
  result.none = list.filter(m => !m.mealCategory)
  return result
})

const uncategorizedMeals = computed(() => mealsByCategory.value.none ?? [])

// Recipe suggestions
interface RecipeSuggestion {
  name: string
  description: string
  calories: number
  protein: number
  carbs: number
  fat: number
}

const suggestions = ref<RecipeSuggestion[]>([])
const suggestionsLoading = ref(false)
const suggestionsError = ref(false)

async function fetchSuggestions() {
  suggestionsLoading.value = true
  suggestionsError.value = false
  suggestions.value = []
  try {
    const data = await $fetch<{ suggestions: RecipeSuggestion[] }>('/api/suggestions/recipes', { method: 'POST' })
    suggestions.value = data.suggestions
  } catch {
    suggestionsError.value = true
  } finally {
    suggestionsLoading.value = false
  }
}
</script>

<template>
  <div class="max-w-xl mx-auto pb-8">
    <!-- Date navigation -->
    <div class="flex items-center justify-between px-4 py-3">
      <button
        class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[var(--ui-bg-elevated)] transition-colors"
        @click="prevDay"
      >
        <UIcon
          name="i-lucide-chevron-left"
          class="w-5 h-5"
        />
      </button>
      <div class="text-center">
        <p class="font-semibold capitalize">
          {{ isToday ? t('dashboard.title') : formatDate(currentDate) }}
        </p>
        <p
          v-if="!isToday"
          class="text-xs text-[var(--ui-text-muted)]"
        >
          {{ currentDate }}
        </p>
      </div>
      <button
        class="w-9 h-9 flex items-center justify-center rounded-full transition-colors"
        :class="isToday ? 'opacity-30 cursor-not-allowed' : 'hover:bg-[var(--ui-bg-elevated)]'"
        :disabled="isToday"
        @click="nextDay"
      >
        <UIcon
          name="i-lucide-chevron-right"
          class="w-5 h-5"
        />
      </button>
    </div>

    <!-- Progress -->
    <div class="px-4 mb-2">
      <DailyProgress
        :consumed="consumed"
        :goals="safeGoals"
      />
    </div>

    <!-- Category rows — Foodvisor style -->
    <div class="mx-4 rounded-2xl border border-[var(--ui-border)] overflow-hidden divide-y divide-[var(--ui-border)]">
      <div
        v-for="cat in categoryOrder"
        :key="cat"
      >
        <!-- Tappable header row -->
        <NuxtLink
          :to="`/add/${cat}`"
          class="flex items-center gap-3 px-4 py-4 active:bg-[var(--ui-bg-elevated)] transition-colors"
        >
          <!-- Icon -->
          <div
            class="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            :class="categoryMeta[cat].bgClass"
          >
            <UIcon
              :name="categoryMeta[cat].icon"
              class="w-5 h-5"
              :class="categoryMeta[cat].colorClass"
            />
          </div>

          <!-- Info -->
          <div class="flex-1 min-w-0">
            <p class="font-semibold text-sm">
              {{ t(`mealCategory.${cat}`) }}
            </p>
            <p class="text-sm text-[var(--ui-text-muted)]">
              {{ Math.round(mealsByCategory[cat].reduce((s, m) => s + (m.totalCalories ?? 0), 0)) }} kcal
            </p>
          </div>

          <!-- Big + button -->
          <div class="w-10 h-10 rounded-full bg-[var(--ui-text)] flex items-center justify-center shrink-0">
            <UIcon
              name="i-lucide-plus"
              class="w-5 h-5 text-[var(--ui-bg)]"
            />
          </div>
        </NuxtLink>

        <!-- Macro stacked bar -->
        <div
          v-if="mealsByCategory[cat].length"
          class="border-t border-[var(--ui-border)] px-4 py-3 space-y-2"
        >
          <!-- Bar -->
          <div
            v-if="categoryMacros[cat].protein + categoryMacros[cat].carbs + categoryMacros[cat].fat > 0"
            class="flex h-2 rounded-full overflow-hidden gap-px"
          >
            <div
              class="bg-blue-400 h-full transition-all"
              :style="`width: ${categoryMacros[cat].protein / (categoryMacros[cat].protein + categoryMacros[cat].carbs + categoryMacros[cat].fat) * 100}%`"
            />
            <div
              class="bg-amber-400 h-full transition-all"
              :style="`width: ${categoryMacros[cat].carbs / (categoryMacros[cat].protein + categoryMacros[cat].carbs + categoryMacros[cat].fat) * 100}%`"
            />
            <div
              class="bg-purple-400 h-full transition-all"
              :style="`width: ${categoryMacros[cat].fat / (categoryMacros[cat].protein + categoryMacros[cat].carbs + categoryMacros[cat].fat) * 100}%`"
            />
          </div>
          <!-- Labels -->
          <div class="flex gap-3 text-xs text-[var(--ui-text-muted)]">
            <span class="flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
              {{ Math.round(categoryMacros[cat].protein) }}g P
            </span>
            <span class="flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
              {{ Math.round(categoryMacros[cat].carbs) }}g G
            </span>
            <span class="flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-purple-400 shrink-0" />
              {{ Math.round(categoryMacros[cat].fat) }}g L
            </span>
          </div>
          <!-- Product names -->
          <p
            v-for="meal in mealsByCategory[cat]"
            :key="meal.id"
            class="text-xs text-[var(--ui-text-muted)] truncate"
          >
            · {{ (meal.items as Array<{ name: string }>).map(i => i.name).join(', ') }}
          </p>
        </div>
      </div>
    </div>

    <!-- Uncategorized meals (legacy) -->
    <div
      v-if="uncategorizedMeals.length"
      class="mx-4 mt-3 space-y-2"
    >
      <p class="text-xs text-[var(--ui-text-muted)] px-1">
        {{ t('mealCategory.uncategorized') }}
      </p>
      <MealCard
        v-for="meal in uncategorizedMeals"
        :key="meal.id"
        :meal="meal"
        @delete="deleteMeal"
        @updated="() => refreshMeals()"
      />
    </div>

    <!-- Recipe suggestions -->
    <div
      v-if="isToday"
      class="mx-4 mt-4"
    >
      <div class="flex items-center justify-between mb-2">
        <h2 class="font-semibold">
          {{ t('recipes.title') }}
        </h2>
        <UButton
          size="sm"
          variant="outline"
          color="neutral"
          icon="i-lucide-sparkles"
          :loading="suggestionsLoading"
          @click="fetchSuggestions"
        >
          {{ t('recipes.suggest') }}
        </UButton>
      </div>
      <p
        v-if="suggestionsError"
        class="text-sm text-[var(--ui-text-muted)]"
      >
        {{ t('recipes.error') }}
      </p>
      <div
        v-if="suggestions.length"
        class="space-y-2"
      >
        <UCard
          v-for="s in suggestions"
          :key="s.name"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1 min-w-0">
              <p class="font-medium">
                {{ s.name }}
              </p>
              <p class="text-sm text-[var(--ui-text-muted)] mt-0.5">
                {{ s.description }}
              </p>
            </div>
            <div class="shrink-0 text-right">
              <p class="font-bold text-primary">
                {{ Math.round(s.calories) }} kcal
              </p>
              <p class="text-xs text-[var(--ui-text-muted)]">
                P {{ Math.round(s.protein) }}g
              </p>
            </div>
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>
