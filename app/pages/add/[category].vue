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

interface FavoriteProduct {
  id: string
  name: string
  productId: string
  product: {
    id: string
    name: string
    calories: number
    protein: number
    carbs: number
    fat: number
    fiber: number | null
    sugar: number | null
    saturatedFat: number | null
    salt: number | null
    servingSize: string | null
    barcode: string | null
    brand: string | null
    image: string | null
    nutriScore: 'A' | 'B' | 'C' | 'D' | 'E' | null
    source: string
  }
}

interface Meal {
  id: string
  type: string
  mealCategory: string | null
  items: Array<{ name: string, productId?: string }>
  totalCalories: number
  totalProtein: number
  totalCarbs: number
  totalFat: number
  totalFiber: number | null
  totalSugar: number | null
  totalSaturatedFat: number | null
  totalSalt: number | null
  nutriScore: 'A' | 'B' | 'C' | 'D' | 'E' | null
  healthScore: number | null
  healthLabel: 'excellent' | 'good' | 'limit' | 'avoid' | null
  confidence: number | null
  source: string | null
  createdAt: string
}

const todayDate = new Date().toISOString().split('T')[0] ?? ''

const [{ data: favorites, refresh: refreshFavorites }, { data: todayMeals, refresh: refreshMeals }, { data: goals }] = await Promise.all([
  useFetch<FavoriteProduct[]>('/api/favorites'),
  useFetch<Meal[]>('/api/meals', { query: { date: todayDate } }),
  useFetch<{ calories: number, protein: number, carbs: number, fat: number }>('/api/goals')
])

const mealsInCategory = computed(() =>
  (todayMeals.value ?? []).filter(m => m.mealCategory === category)
)

const defaultGoals = { calories: 2000, protein: 150, carbs: 250, fat: 70, fiber: 25 }
const safeGoals = computed(() => goals.value ?? defaultGoals)

const categoryTotals = computed(() => mealsInCategory.value.reduce(
  (acc, m) => ({
    calories: acc.calories + (m.totalCalories ?? 0),
    protein: acc.protein + (m.totalProtein ?? 0),
    carbs: acc.carbs + (m.totalCarbs ?? 0),
    fat: acc.fat + (m.totalFat ?? 0)
  }),
  { calories: 0, protein: 0, carbs: 0, fat: 0 }
))

// SVG ring: r=18, circumference = 2π×18 ≈ 113.1
function ringDash(value: number, max: number) {
  const pct = Math.min(value / max, 1)
  return `${(pct * 113.1).toFixed(1)} 113.1`
}

const categoryExtras = computed(() => mealsInCategory.value.reduce(
  (acc, m) => ({
    fiber: acc.fiber + (m.totalFiber ?? 0),
    sugar: acc.sugar + (m.totalSugar ?? 0),
    saturatedFat: acc.saturatedFat + (m.totalSaturatedFat ?? 0),
    salt: acc.salt + (m.totalSalt ?? 0)
  }),
  { fiber: 0, sugar: 0, saturatedFat: 0, salt: 0 }
))

const macroRings = computed(() => [
  {
    key: 'protein',
    label: t('dashboard.protein'),
    value: categoryTotals.value.protein,
    goal: safeGoals.value.protein,
    stroke: '#f472b6'
  },
  {
    key: 'fat',
    label: t('dashboard.fat'),
    value: categoryTotals.value.fat,
    goal: safeGoals.value.fat,
    stroke: '#facc15'
  },
  {
    key: 'carbs',
    label: t('dashboard.carbs'),
    value: categoryTotals.value.carbs,
    goal: safeGoals.value.carbs,
    stroke: '#38bdf8'
  },
  {
    key: 'fiber',
    label: t('nutrition.fiber'),
    value: categoryExtras.value.fiber,
    goal: safeGoals.value.fiber ?? 25,
    stroke: '#4ade80'
  }
])

// Edit modal
const editingMeal = ref<Meal | null>(null)
const editForm = reactive({ totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0 })
const saving = ref(false)

function openEdit(meal: Meal) {
  editingMeal.value = meal
  editForm.totalCalories = Math.round(meal.totalCalories)
  editForm.totalProtein = Math.round(meal.totalProtein * 10) / 10
  editForm.totalCarbs = Math.round(meal.totalCarbs * 10) / 10
  editForm.totalFat = Math.round(meal.totalFat * 10) / 10
}

async function saveEdit() {
  if (!editingMeal.value) return
  saving.value = true
  try {
    await $fetch(`/api/meals/${editingMeal.value.id}`, { method: 'PUT', body: editForm })
    toast.add({ title: t('edit.saved'), color: 'success', icon: 'i-lucide-check-circle' })
    editingMeal.value = null
    await refreshMeals()
  } catch {
    toast.add({ title: t('common.error'), color: 'error' })
  } finally {
    saving.value = false
  }
}

async function deleteMeal(id: string) {
  try {
    await $fetch(`/api/meals/${id}`, { method: 'DELETE' })
    await refreshMeals()
  } catch {
    toast.add({ title: t('common.error'), color: 'error' })
  }
}

async function addToJournal(result: NutritionResult, type: string = activeMode.value) {
  try {
    await $fetch('/api/meals', {
      method: 'POST',
      body: {
        date: todayDate,
        type,
        mealCategory: category,
        items: result.items,
        totalCalories: result.totalCalories,
        totalProtein: result.totalProtein,
        totalCarbs: result.totalCarbs,
        totalFat: result.totalFat,
        totalFiber: result.totalFiber,
        totalSugar: result.totalSugar,
        totalSaturatedFat: result.totalSaturatedFat,
        totalSalt: result.totalSalt,
        nutriScore: result.nutriScore,
        healthScore: result.healthScore,
        healthLabel: result.healthLabel,
        confidence: result.confidence,
        productBarcode: result.barcode,
        productBrand: result.brand,
        productImage: result.image
      }
    })
    toast.add({ title: t('add.mealAdded'), color: 'success', icon: 'i-lucide-check-circle' })
    await refreshMeals()
  } catch {
    toast.add({ title: t('common.error'), color: 'error' })
  }
}

async function addFavoriteToJournal(fav: FavoriteProduct) {
  const p = fav.product
  await addToJournal({
    productName: p.name,
    brand: p.brand ?? undefined,
    image: p.image ?? undefined,
    barcode: p.barcode ?? undefined,
    items: [{
      productId: p.id,
      name: p.name,
      quantity: p.servingSize ?? '1 portion',
      calories: p.calories,
      protein: p.protein,
      carbs: p.carbs,
      fat: p.fat,
      fiber: p.fiber ?? undefined,
      sugar: p.sugar ?? undefined,
      saturatedFat: p.saturatedFat ?? undefined,
      salt: p.salt ?? undefined
    }],
    totalCalories: p.calories,
    totalProtein: p.protein,
    totalCarbs: p.carbs,
    totalFat: p.fat,
    totalFiber: p.fiber ?? undefined,
    totalSugar: p.sugar ?? undefined,
    totalSaturatedFat: p.saturatedFat ?? undefined,
    totalSalt: p.salt ?? undefined,
    nutriScore: p.nutriScore ?? undefined,
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
    class="flex flex-col max-w-xl mx-auto"
  >
    <!-- Sticky header -->
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
      <h1 class="text-base font-bold flex-1">
        {{ t(`mealCategory.${category}`) }}
      </h1>
      <span
        v-if="mealsInCategory.length"
        class="text-sm font-semibold text-primary"
      >
        {{ Math.round(categoryTotals.calories) }} kcal
      </span>
    </div>

    <!-- Category summary (when meals exist) -->
    <div
      v-if="mealsInCategory.length"
      class="px-4 pt-4 pb-2"
    >
      <!-- Kcal progress bar -->
      <div class="mb-4">
        <div class="flex justify-between text-xs text-[var(--ui-text-muted)] mb-1.5">
          <span class="font-medium text-[var(--ui-text)]">{{ Math.round(categoryTotals.calories) }} kcal</span>
          <span>{{ t('dashboard.of') }} {{ safeGoals.calories }} kcal</span>
        </div>
        <div class="h-2 rounded-full bg-[var(--ui-bg-elevated)] overflow-hidden">
          <div
            class="h-full rounded-full transition-all"
            :class="categoryTotals.calories > safeGoals.calories ? 'bg-red-400' : 'bg-green-400'"
            :style="`width: ${Math.min(categoryTotals.calories / safeGoals.calories * 100, 100)}%`"
          />
        </div>
      </div>

      <!-- Macro rings -->
      <div class="flex justify-around">
        <div
          v-for="ring in macroRings"
          :key="ring.key"
          class="flex flex-col items-center gap-1.5"
        >
          <div class="relative w-16 h-16">
            <svg
              class="w-full h-full -rotate-90"
              viewBox="0 0 44 44"
            >
              <circle
                cx="22"
                cy="22"
                r="18"
                fill="none"
                stroke-width="3.5"
                class="stroke-[var(--ui-bg-elevated)]"
              />
              <circle
                cx="22"
                cy="22"
                r="18"
                fill="none"
                stroke-width="3.5"
                stroke-linecap="round"
                :stroke="ring.stroke"
                :stroke-dasharray="ringDash(ring.value, ring.goal)"
              />
            </svg>
            <div class="absolute inset-0 flex flex-col items-center justify-center">
              <span class="text-sm font-bold leading-none">{{ Math.round(ring.value) }}</span>
              <span class="text-[10px] text-[var(--ui-text-muted)] leading-none mt-0.5">/{{ ring.goal }}g</span>
            </div>
          </div>
          <span class="text-xs text-[var(--ui-text-muted)]">{{ ring.label }}</span>
        </div>
      </div>

      <!-- Product list -->
      <div class="mt-4 divide-y divide-[var(--ui-border)] border-t border-[var(--ui-border)]">
        <div
          v-for="meal in mealsInCategory"
          :key="meal.id"
          class="flex items-start gap-3 py-3"
        >
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-0.5">
              <div class="flex flex-wrap gap-x-1">
                <template
                  v-for="(item, idx) in meal.items"
                  :key="idx"
                >
                  <NuxtLink
                    v-if="item.productId"
                    :to="`/products/${item.productId}`"
                    class="font-semibold text-sm text-primary underline-offset-2 hover:underline truncate"
                  >{{ item.name }}</NuxtLink>
                  <span
                    v-else
                    class="font-semibold text-sm truncate"
                  >{{ item.name }}</span>
                  <span
                    v-if="idx < meal.items.length - 1"
                    class="text-[var(--ui-text-muted)] text-sm"
                  >, </span>
                </template>
              </div>
              <span
                v-if="meal.nutriScore"
                class="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded text-white"
                :class="{
                  'bg-green-500': meal.nutriScore === 'A',
                  'bg-lime-500': meal.nutriScore === 'B',
                  'bg-yellow-500': meal.nutriScore === 'C',
                  'bg-orange-500': meal.nutriScore === 'D',
                  'bg-red-500': meal.nutriScore === 'E'
                }"
              >{{ meal.nutriScore }}</span>
              <span
                v-if="meal.healthLabel"
                class="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded text-white"
                :class="{
                  'bg-green-500': meal.healthLabel === 'excellent',
                  'bg-lime-500': meal.healthLabel === 'good',
                  'bg-orange-500': meal.healthLabel === 'limit',
                  'bg-red-500': meal.healthLabel === 'avoid'
                }"
              >{{ t('healthLabel.' + meal.healthLabel) }}{{ meal.healthScore != null ? ` (${meal.healthScore})` : '' }}</span>
            </div>
            <p class="text-xs text-[var(--ui-text-muted)]">
              {{ Math.round(meal.totalCalories) }} kcal · P {{ Math.round(meal.totalProtein) }}g · G {{ Math.round(meal.totalCarbs) }}g · L {{ Math.round(meal.totalFat) }}g
            </p>
            <p
              v-if="meal.totalFiber || meal.totalSugar || meal.totalSalt"
              class="text-xs text-[var(--ui-text-muted)] mt-0.5"
            >
              <template v-if="meal.totalFiber">
                Fibres {{ Math.round((meal.totalFiber ?? 0) * 10) / 10 }}g
              </template><template v-if="meal.totalFiber && (meal.totalSugar || meal.totalSalt)">
                ·
              </template><template v-if="meal.totalSugar">
                Sucres {{ Math.round((meal.totalSugar ?? 0) * 10) / 10 }}g
              </template><template v-if="meal.totalSugar && meal.totalSalt">
                ·
              </template><template v-if="meal.totalSalt">
                Sel {{ Math.round((meal.totalSalt ?? 0) * 10) / 10 }}g
              </template>
            </p>
          </div>
          <div class="flex gap-1 shrink-0 mt-0.5">
            <UButton
              icon="i-lucide-pencil"
              variant="ghost"
              color="neutral"
              size="xs"
              @click="openEdit(meal)"
            />
            <UButton
              icon="i-lucide-trash-2"
              variant="ghost"
              color="error"
              size="xs"
              @click="deleteMeal(meal.id)"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Mode tabs -->
    <div class="flex gap-2 px-4 py-3 border-y border-[var(--ui-border)]">
      <button
        v-for="mode in modes"
        :key="mode.key"
        class="flex flex-col flex-1 items-center gap-1.5 py-3 rounded-2xl transition-all active:scale-95"
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
                {{ Math.round(fav.product.calories) }} kcal · P {{ Math.round(fav.product.protein) }}g
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
    <!-- Edit modal -->
    <UModal
      :open="!!editingMeal"
      :title="t('edit.meal')"
      @update:open="(v) => { if (!v) editingMeal = null }"
    >
      <template #body>
        <div class="space-y-3">
          <UFormField
            :label="t('edit.calories')"
            name="calories"
          >
            <UInput
              v-model.number="editForm.totalCalories"
              type="number"
              min="0"
              class="w-full"
            />
          </UFormField>
          <UFormField
            :label="t('edit.protein')"
            name="protein"
          >
            <UInput
              v-model.number="editForm.totalProtein"
              type="number"
              min="0"
              step="0.1"
              class="w-full"
            />
          </UFormField>
          <UFormField
            :label="t('edit.carbs')"
            name="carbs"
          >
            <UInput
              v-model.number="editForm.totalCarbs"
              type="number"
              min="0"
              step="0.1"
              class="w-full"
            />
          </UFormField>
          <UFormField
            :label="t('edit.fat')"
            name="fat"
          >
            <UInput
              v-model.number="editForm.totalFat"
              type="number"
              min="0"
              step="0.1"
              class="w-full"
            />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex gap-2 w-full">
          <UButton
            variant="outline"
            color="neutral"
            class="flex-1"
            @click="editingMeal = null"
          >
            {{ t('common.cancel') }}
          </UButton>
          <UButton
            class="flex-1"
            :loading="saving"
            @click="saveEdit"
          >
            {{ t('common.save') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
