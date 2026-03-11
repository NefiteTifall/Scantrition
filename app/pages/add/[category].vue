<script setup lang="ts">
import type { NutritionResult } from '~/types/nutrition'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const toast = useToast()

type Mode = 'text' | 'photo' | 'barcode' | 'search'
type MealCategory = 'breakfast' | 'lunch' | 'snack' | 'dinner'

const validCategories: MealCategory[] = ['breakfast', 'lunch', 'snack', 'dinner']
const param = route.params.category as string
const category = validCategories.includes(param as MealCategory) ? param as MealCategory : null

if (!category) {
  await navigateTo('/dashboard')
}

const categoryMeta: Record<MealCategory, { icon: string, colorClass: string, bgClass: string }> = {
  breakfast: { icon: 'i-lucide-sunrise', colorClass: 'text-orange-400', bgClass: 'bg-orange-400/15' },
  lunch: { icon: 'i-lucide-sun', colorClass: 'text-green-400', bgClass: 'bg-green-400/15' },
  snack: { icon: 'i-lucide-apple', colorClass: 'text-violet-400', bgClass: 'bg-violet-400/15' },
  dinner: { icon: 'i-lucide-moon', colorClass: 'text-blue-400', bgClass: 'bg-blue-400/15' }
}

const meta = category ? categoryMeta[category] : categoryMeta.breakfast

const modes: Array<{ key: Mode, icon: string, label: string }> = [
  { key: 'text', icon: 'i-lucide-message-square', label: t('add.textMode') },
  { key: 'photo', icon: 'i-lucide-camera', label: t('add.photoMode') },
  { key: 'barcode', icon: 'i-lucide-scan-barcode', label: t('add.barcodeMode') },
  { key: 'search', icon: 'i-lucide-search', label: t('add.searchMode') }
]

const activeMode = ref<Mode>('text')

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
  try {
    await $fetch('/api/meals', {
      method: 'POST',
      body: {
        date: new Date().toISOString().split('T')[0],
        type,
        mealCategory: category,
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
  <div
    v-if="category"
    class="flex flex-col"
  >
    <!-- Category header -->
    <div class="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 bg-[var(--ui-bg)] border-b border-[var(--ui-border)]">
      <button
        class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[var(--ui-bg-elevated)] transition-colors shrink-0"
        @click="router.back()"
      >
        <UIcon
          name="i-lucide-arrow-left"
          class="w-5 h-5"
        />
      </button>
      <div
        class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        :class="meta.bgClass"
      >
        <UIcon
          :name="meta.icon"
          class="w-5 h-5"
          :class="meta.colorClass"
        />
      </div>
      <h1 class="text-base font-bold">
        {{ t(`mealCategory.${category}`) }}
      </h1>
    </div>

    <!-- Mode tabs — horizontal scroll, big touch targets -->
    <div class="flex gap-2 overflow-x-auto px-4 py-3 border-b border-[var(--ui-border)] [scrollbar-width:none]">
      <button
        v-for="mode in modes"
        :key="mode.key"
        class="flex flex-col items-center gap-1.5 shrink-0 w-[76px] py-3 rounded-2xl transition-all active:scale-95"
        :class="activeMode === mode.key
          ? 'bg-primary text-white'
          : 'bg-[var(--ui-bg-elevated)] text-[var(--ui-text-muted)]'"
        @click="activeMode = mode.key"
      >
        <UIcon
          :name="mode.icon"
          class="w-5 h-5"
        />
        <span class="text-xs font-medium leading-none">{{ mode.label }}</span>
      </button>
    </div>

    <!-- Form content -->
    <div class="px-4 pt-4 pb-24 space-y-4">
      <MealAddText
        v-if="activeMode === 'text'"
        @result="addToJournal"
      />
      <MealAddPhoto
        v-else-if="activeMode === 'photo'"
        @result="addToJournal"
      />
      <MealAddBarcode
        v-else-if="activeMode === 'barcode'"
        @result="addToJournal"
      />
      <MealAddSearch
        v-else-if="activeMode === 'search'"
        @result="addToJournal"
      />

      <!-- Favorites -->
      <div
        v-if="favorites?.length"
        class="pt-2"
      >
        <h2 class="font-semibold text-sm mb-3">
          {{ t('add.favorites') }}
        </h2>
        <div class="space-y-2">
          <div
            v-for="fav in favorites"
            :key="fav.id"
            class="flex items-center gap-3 p-3 rounded-xl border border-[var(--ui-border)]"
          >
            <UIcon
              name="i-lucide-heart"
              class="w-4 h-4 text-primary shrink-0"
            />
            <div class="flex-1 min-w-0">
              <p class="font-medium text-sm truncate">
                {{ fav.name }}
              </p>
              <p class="text-xs text-[var(--ui-text-muted)]">
                {{ Math.round(fav.totalCalories) }} kcal · P {{ Math.round(fav.totalProtein) }}g
              </p>
            </div>
            <div class="flex gap-1 shrink-0">
              <UButton
                size="xs"
                icon="i-lucide-plus"
                @click="addFavoriteToJournal(fav)"
              />
              <UButton
                size="xs"
                variant="ghost"
                color="error"
                icon="i-lucide-trash-2"
                @click="deleteFavorite(fav.id)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
