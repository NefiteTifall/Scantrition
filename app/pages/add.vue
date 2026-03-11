<script setup lang="ts">
import type { NutritionResult } from '~/server/utils/ai'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const toast = useToast()

type Mode = 'text' | 'photo' | 'barcode' | 'search'
type MealCategory = 'breakfast' | 'lunch' | 'snack' | 'dinner'

const mealCategories: Array<{ key: MealCategory; icon: string }> = [
  { key: 'breakfast', icon: 'i-lucide-sunrise' },
  { key: 'lunch', icon: 'i-lucide-sun' },
  { key: 'snack', icon: 'i-lucide-apple' },
  { key: 'dinner', icon: 'i-lucide-moon' }
]

function getDefaultCategory(): MealCategory {
  const h = new Date().getHours()
  if (h >= 5 && h < 10) return 'breakfast'
  if (h >= 10 && h < 14) return 'lunch'
  if (h >= 14 && h < 18) return 'snack'
  return 'dinner'
}

const validCategories: MealCategory[] = ['breakfast', 'lunch', 'snack', 'dinner']
const queryCategory = route.query.category as string
const mealCategory = ref<MealCategory>(
  validCategories.includes(queryCategory as MealCategory) ? queryCategory as MealCategory : getDefaultCategory()
)

const modes: Array<{ key: Mode; icon: string; label: string }> = [
  { key: 'text', icon: 'i-lucide-message-square', label: t('add.textMode') },
  { key: 'photo', icon: 'i-lucide-camera', label: t('add.photoMode') },
  { key: 'barcode', icon: 'i-lucide-scan-barcode', label: t('add.barcodeMode') },
  { key: 'search', icon: 'i-lucide-search', label: t('add.searchMode') }
]

const activeMode = ref<Mode>('text')
const saving = ref(false)

interface FavoriteMeal {
  id: string
  name: string
  totalCalories: number
  totalProtein: number
  totalCarbs: number
  totalFat: number
  items: NutritionResult['items']
}

const { data: favorites, refresh: refreshFavorites } = await useFetch<FavoriteMeal[]>('/api/favorites')

async function addToJournal(result: NutritionResult, type: string = activeMode.value) {
  saving.value = true
  try {
    await $fetch('/api/meals', {
      method: 'POST',
      body: {
        date: new Date().toISOString().split('T')[0],
        type,
        mealCategory: mealCategory.value,
        items: result.items,
        totalCalories: result.totalCalories,
        totalProtein: result.totalProtein,
        totalCarbs: result.totalCarbs,
        totalFat: result.totalFat,
        confidence: result.confidence
      }
    })
    toast.add({ title: t('add.mealAdded'), color: 'success', icon: 'i-lucide-check-circle' })
    router.push('/dashboard')
  } catch {
    toast.add({ title: t('common.error'), color: 'error' })
  } finally {
    saving.value = false
  }
}

async function addFavoriteToJournal(fav: FavoriteMeal) {
  await addToJournal({
    items: fav.items,
    totalCalories: fav.totalCalories,
    totalProtein: fav.totalProtein,
    totalCarbs: fav.totalCarbs,
    totalFat: fav.totalFat,
    confidence: 1
  }, 'favorite')
}

async function deleteFavorite(id: string) {
  await $fetch(`/api/favorites/${id}`, { method: 'DELETE' })
  await refreshFavorites()
  toast.add({ title: t('favorites.deleted'), color: 'success' })
}
</script>

<template>
  <div class="max-w-xl mx-auto px-4 py-6 space-y-5">
    <h1 class="text-xl font-bold">{{ t('add.title') }}</h1>

    <!-- Meal category -->
    <div class="grid grid-cols-4 gap-1 bg-[var(--ui-border)] rounded-xl p-1">
      <button
        v-for="cat in mealCategories"
        :key="cat.key"
        class="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg text-xs font-medium transition-all"
        :class="mealCategory === cat.key
          ? 'bg-[var(--ui-bg)] shadow text-primary'
          : 'text-[var(--ui-text-muted)] hover:text-[var(--ui-text)]'"
        @click="mealCategory = cat.key"
      >
        <UIcon :name="cat.icon" class="w-4 h-4" />
        {{ t(`mealCategory.${cat.key}`) }}
      </button>
    </div>

    <!-- Mode tabs -->
    <div class="grid grid-cols-4 gap-1 bg-[var(--ui-border)] rounded-xl p-1">
      <button
        v-for="mode in modes"
        :key="mode.key"
        class="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg text-xs font-medium transition-all"
        :class="activeMode === mode.key
          ? 'bg-[var(--ui-bg)] shadow text-[var(--ui-text)]'
          : 'text-[var(--ui-text-muted)] hover:text-[var(--ui-text)]'"
        @click="activeMode = mode.key"
      >
        <UIcon :name="mode.icon" class="w-4 h-4" />
        {{ mode.label }}
      </button>
    </div>

    <!-- Mode content -->
    <MealAddText v-if="activeMode === 'text'" @result="addToJournal" />
    <MealAddPhoto v-else-if="activeMode === 'photo'" @result="addToJournal" />
    <MealAddBarcode v-else-if="activeMode === 'barcode'" @result="addToJournal" />
    <MealAddSearch v-else-if="activeMode === 'search'" @result="addToJournal" />

    <!-- Favorites -->
    <div v-if="favorites?.length">
      <h2 class="font-semibold mb-2 text-sm">{{ t('add.favorites') }}</h2>
      <div class="space-y-2">
        <div
          v-for="fav in favorites"
          :key="fav.id"
          class="flex items-center gap-3 p-3 rounded-xl border border-[var(--ui-border)]"
        >
          <UIcon name="i-lucide-heart" class="w-4 h-4 text-primary shrink-0" />
          <div class="flex-1 min-w-0">
            <p class="font-medium text-sm truncate">{{ fav.name }}</p>
            <p class="text-xs text-[var(--ui-text-muted)]">
              {{ Math.round(fav.totalCalories) }} kcal · P {{ Math.round(fav.totalProtein) }}g
            </p>
          </div>
          <div class="flex gap-1 shrink-0">
            <UButton size="xs" icon="i-lucide-plus" @click="addFavoriteToJournal(fav)" />
            <UButton size="xs" variant="ghost" color="error" icon="i-lucide-trash-2" @click="deleteFavorite(fav.id)" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
