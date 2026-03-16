<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const toast = useToast()

interface Ingredient {
  text: string
  vegan?: 'yes' | 'no' | 'maybe'
  percent?: number
}

interface Product {
  id: string
  name: string
  brand: string | null
  image: string | null
  barcode: string | null
  source: 'barcode' | 'search' | 'ai' | 'photo'
  servingSize: string | null
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number | null
  sugar: number | null
  saturatedFat: number | null
  salt: number | null
  monounsaturatedFat: number | null
  polyunsaturatedFat: number | null
  transFat: number | null
  omega3Fat: number | null
  omega6Fat: number | null
  cholesterol: number | null
  sodium: number | null
  potassium: number | null
  calcium: number | null
  iron: number | null
  magnesium: number | null
  zinc: number | null
  phosphorus: number | null
  iodine: number | null
  selenium: number | null
  vitaminA: number | null
  vitaminB1: number | null
  vitaminB2: number | null
  vitaminB3: number | null
  vitaminB5: number | null
  vitaminB6: number | null
  vitaminB9: number | null
  vitaminB12: number | null
  vitaminC: number | null
  vitaminD: number | null
  vitaminE: number | null
  vitaminK: number | null
  caffeine: number | null
  alcohol: number | null
  nutriScore: 'A' | 'B' | 'C' | 'D' | 'E' | null
  novaGroup: number | null
  origins: string | null
  quantity: string | null
  ingredients: Ingredient[] | null
  labelsTags: string[] | null
  additivesTags: string[] | null
  createdAt: string
}

const { data: product, error } = await useFetch<Product>(`/api/products/${route.params.id}`)

if (error.value) {
  await navigateTo('/dashboard')
}

const { data: goals } = await useFetch('/api/goals')
const defaultGoals = { calories: 2000, protein: 150, carbs: 250, fat: 70, fiber: 25 }
const safeGoals = computed(() => goals.value ?? defaultGoals)

const nutriScoreColors: Record<string, string> = {
  A: 'bg-green-500', B: 'bg-lime-500', C: 'bg-yellow-500', D: 'bg-orange-500', E: 'bg-red-500'
}

const novaClass: Record<number, string> = {
  1: 'bg-green-500/15 text-green-700 dark:text-green-400',
  2: 'bg-lime-500/15 text-lime-700 dark:text-lime-400',
  3: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
  4: 'bg-red-500/15 text-red-700 dark:text-red-400'
}

function bar(value: number | null | undefined, max: number) {
  if (!value || !max) return '0%'
  return `${Math.min(value / max * 100, 100)}%`
}

const sourceIcon: Record<string, string> = {
  barcode: 'i-lucide-scan-barcode',
  search: 'i-lucide-search',
  ai: 'i-lucide-sparkles',
  photo: 'i-lucide-camera'
}

const sourceKey: Record<string, string> = {
  barcode: 'barcodeMode',
  search: 'searchMode',
  ai: 'textMode',
  photo: 'photoMode'
}

const displayLabels = computed(() =>
  (product.value?.labelsTags ?? [])
    .map(tag => {
      const label = tag.replace(/^[a-z]{2}:/, '')
      if (label.startsWith('nutriscore')) return null
      if (/^(eu|fr|tn|en)-bio/.test(label)) return null
      if (label === 'eu-organic') return null
      const map: Record<string, string> = { organic: 'Bio', fsc: 'FSC', 'fsc-mix': 'FSC Mix' }
      return map[label] ?? label.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    })
    .filter(Boolean) as string[]
)

const displayAdditives = computed(() =>
  [...new Set(
    (product.value?.additivesTags ?? [])
      .map(tag => tag.replace(/^en:/, '').toUpperCase())
      .filter(code => /^E\d+$/.test(code))
  )]
)

const showIngredients = ref(false)

// Add to journal
type MealCategory = 'breakfast' | 'lunch' | 'snack' | 'dinner'
const showAddModal = ref(false)
const addingToJournal = ref(false)

const mealCategories: MealCategory[] = ['breakfast', 'lunch', 'snack', 'dinner']
const selectedCategory = ref<MealCategory>('lunch')

const defaultPortionGrams = (() => {
  const s = product.value?.servingSize
  if (!s) return 100
  const m = s.match(/(\d+(?:\.\d+)?)\s*g/i)
  return m ? parseFloat(m[1]) : 100
})()
const portionGrams = ref(defaultPortionGrams)

const portionNutrition = computed(() => {
  const p = product.value
  if (!p) return null
  const m = portionGrams.value / 100
  return {
    calories: Math.round(p.calories * m),
    protein: Math.round(p.protein * m * 10) / 10,
    carbs: Math.round(p.carbs * m * 10) / 10,
    fat: Math.round(p.fat * m * 10) / 10,
    fiber: p.fiber != null ? Math.round(p.fiber * m * 10) / 10 : null,
    sugar: p.sugar != null ? Math.round(p.sugar * m * 10) / 10 : null,
    saturatedFat: p.saturatedFat != null ? Math.round(p.saturatedFat * m * 10) / 10 : null,
    salt: p.salt != null ? Math.round(p.salt * m * 100) / 100 : null
  }
})

async function addToJournal() {
  if (!product.value || !portionNutrition.value) return
  addingToJournal.value = true
  const p = product.value
  const n = portionNutrition.value
  try {
    const todayDate = new Date().toISOString().split('T')[0] ?? ''
    await $fetch('/api/meals', {
      method: 'POST',
      body: {
        date: todayDate,
        type: 'product',
        mealCategory: selectedCategory.value,
        items: [{
          productId: p.id,
          name: p.name,
          quantity: `${portionGrams.value}g`,
          calories: n.calories,
          protein: n.protein,
          carbs: n.carbs,
          fat: n.fat,
          fiber: n.fiber ?? undefined,
          sugar: n.sugar ?? undefined,
          saturatedFat: n.saturatedFat ?? undefined,
          salt: n.salt ?? undefined
        }],
        totalCalories: n.calories,
        totalProtein: n.protein,
        totalCarbs: n.carbs,
        totalFat: n.fat,
        totalFiber: n.fiber,
        totalSugar: n.sugar,
        totalSaturatedFat: n.saturatedFat,
        totalSalt: n.salt,
        nutriScore: p.nutriScore,
        confidence: 1,
        productName: p.name,
        productBarcode: p.barcode,
        productBrand: p.brand,
        productImage: p.image,
        productServingSize: p.servingSize,
        productNovaGroup: p.novaGroup,
        productOrigins: p.origins
      }
    })
    toast.add({ title: t('add.mealAdded'), color: 'success', icon: 'i-lucide-check-circle' })
    showAddModal.value = false
  } catch {
    toast.add({ title: t('common.error'), color: 'error' })
  } finally {
    addingToJournal.value = false
  }
}

// Vitamins & minerals to display (only non-null)
const vitamins = computed(() => {
  const p = product.value
  if (!p) return []
  return [
    { key: 'vitaminA', label: t('nutrition.vitaminA'), value: p.vitaminA },
    { key: 'vitaminB1', label: t('nutrition.vitaminB1'), value: p.vitaminB1 },
    { key: 'vitaminB2', label: t('nutrition.vitaminB2'), value: p.vitaminB2 },
    { key: 'vitaminB3', label: t('nutrition.vitaminB3'), value: p.vitaminB3 },
    { key: 'vitaminB5', label: t('nutrition.vitaminB5'), value: p.vitaminB5 },
    { key: 'vitaminB6', label: t('nutrition.vitaminB6'), value: p.vitaminB6 },
    { key: 'vitaminB9', label: t('nutrition.vitaminB9'), value: p.vitaminB9 },
    { key: 'vitaminB12', label: t('nutrition.vitaminB12'), value: p.vitaminB12 },
    { key: 'vitaminC', label: t('nutrition.vitaminC'), value: p.vitaminC },
    { key: 'vitaminD', label: t('nutrition.vitaminD'), value: p.vitaminD },
    { key: 'vitaminE', label: t('nutrition.vitaminE'), value: p.vitaminE },
    { key: 'vitaminK', label: t('nutrition.vitaminK'), value: p.vitaminK }
  ].filter(v => v.value != null && v.value > 0)
})

const minerals = computed(() => {
  const p = product.value
  if (!p) return []
  return [
    { key: 'calcium', label: t('nutrition.calcium'), value: p.calcium },
    { key: 'iron', label: t('nutrition.iron'), value: p.iron },
    { key: 'magnesium', label: t('nutrition.magnesium'), value: p.magnesium },
    { key: 'zinc', label: t('nutrition.zinc'), value: p.zinc },
    { key: 'phosphorus', label: t('nutrition.phosphorus'), value: p.phosphorus },
    { key: 'potassium', label: t('nutrition.potassium'), value: p.potassium },
    { key: 'sodium', label: t('nutrition.sodium'), value: p.sodium },
    { key: 'iodine', label: t('nutrition.iodine'), value: p.iodine },
    { key: 'selenium', label: t('nutrition.selenium'), value: p.selenium }
  ].filter(v => v.value != null && v.value > 0)
})

const extendedFats = computed(() => {
  const p = product.value
  if (!p) return []
  return [
    { key: 'monounsaturatedFat', label: t('nutrition.monounsaturatedFat'), value: p.monounsaturatedFat },
    { key: 'polyunsaturatedFat', label: t('nutrition.polyunsaturatedFat'), value: p.polyunsaturatedFat },
    { key: 'transFat', label: t('nutrition.transFat'), value: p.transFat },
    { key: 'omega3Fat', label: t('nutrition.omega3'), value: p.omega3Fat },
    { key: 'omega6Fat', label: t('nutrition.omega6'), value: p.omega6Fat },
    { key: 'cholesterol', label: t('nutrition.cholesterol'), value: p.cholesterol }
  ].filter(v => v.value != null && v.value > 0)
})
</script>

<template>
  <div
    v-if="product"
    class="max-w-xl mx-auto pb-8"
  >
    <!-- Header -->
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
      <h1 class="font-bold text-base flex-1 truncate">
        {{ product.name }}
      </h1>
      <div class="flex items-center gap-1.5 shrink-0">
        <span
          v-if="product.nutriScore"
          class="text-xs font-bold px-2 py-1 rounded text-white"
          :class="nutriScoreColors[product.nutriScore]"
        >{{ product.nutriScore }}</span>
        <span
          v-if="product.novaGroup"
          class="text-[10px] font-bold px-1.5 py-0.5 rounded"
          :class="novaClass[product.novaGroup]"
        >NOVA {{ product.novaGroup }}</span>
      </div>
    </div>

    <!-- Product identity -->
    <div class="px-4 pt-4 pb-3 flex items-start gap-4">
      <img
        v-if="product.image"
        :src="product.image"
        :alt="product.name"
        class="w-20 h-20 object-contain rounded-xl bg-[var(--ui-bg-elevated)] shrink-0"
      >
      <div class="flex-1 min-w-0">
        <p class="font-semibold text-lg leading-tight">
          {{ product.name }}
        </p>
        <p
          v-if="product.brand"
          class="text-sm text-[var(--ui-text-muted)]"
        >
          {{ product.brand }}
        </p>
        <div class="flex items-center gap-2 mt-1 flex-wrap">
          <div class="flex items-center gap-1 text-xs text-[var(--ui-text-muted)]">
            <UIcon
              :name="sourceIcon[product.source]"
              class="w-3.5 h-3.5"
            />
            {{ t(`add.${sourceKey[product.source]}`) }}
          </div>
          <span
            v-if="product.servingSize"
            class="text-xs text-[var(--ui-text-muted)]"
          >· {{ product.servingSize }}</span>
          <span
            v-if="product.quantity"
            class="text-xs text-[var(--ui-text-muted)]"
          >· {{ product.quantity }}</span>
        </div>
        <p
          v-if="product.origins"
          class="text-xs text-[var(--ui-text-muted)] mt-1"
        >
          {{ t('nutrition.origins') }}: {{ product.origins }}
        </p>
      </div>
    </div>

    <!-- Labels -->
    <div
      v-if="displayLabels.length"
      class="px-4 mb-3 flex flex-wrap gap-1.5"
    >
      <span
        v-for="label in displayLabels"
        :key="label"
        class="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-700 dark:text-green-400 font-medium"
      >{{ label }}</span>
    </div>

    <!-- Add to journal button -->
    <div class="mx-4 mb-4">
      <UButton
        block
        icon="i-lucide-plus"
        size="lg"
        @click="showAddModal = true"
      >
        {{ t('add.addToJournal') }}
      </UButton>
    </div>

    <!-- Calories highlight -->
    <div class="mx-4 mb-4 p-4 rounded-2xl bg-[var(--ui-bg-elevated)] flex items-center justify-between">
      <div>
        <p class="text-3xl font-bold text-primary">
          {{ Math.round(product.calories) }}
        </p>
        <p class="text-sm text-[var(--ui-text-muted)]">
          kcal {{ product.servingSize ? `/ ${product.servingSize}` : '' }}
        </p>
      </div>
      <div class="w-24">
        <div class="h-2 rounded-full bg-[var(--ui-border)] overflow-hidden">
          <div
            class="h-full rounded-full transition-all"
            :class="product.calories > safeGoals.calories ? 'bg-red-400' : 'bg-green-400'"
            :style="`width: ${bar(product.calories, safeGoals.calories)}`"
          />
        </div>
        <p class="text-xs text-[var(--ui-text-muted)] text-right mt-1">
          / {{ safeGoals.calories }} kcal
        </p>
      </div>
    </div>

    <!-- Macros -->
    <div class="mx-4 rounded-2xl border border-[var(--ui-border)] overflow-hidden divide-y divide-[var(--ui-border)] mb-4">
      <!-- Protein -->
      <div class="px-4 py-3">
        <div class="flex items-center justify-between mb-1.5">
          <span class="text-sm font-medium">{{ t('dashboard.protein') }}</span>
          <span class="text-sm font-bold">{{ Math.round(product.protein * 10) / 10 }}g</span>
        </div>
        <div class="h-2 rounded-full bg-[var(--ui-border)] overflow-hidden">
          <div
            class="h-full rounded-full bg-blue-400 transition-all"
            :style="`width: ${bar(product.protein, safeGoals.protein)}`"
          />
        </div>
        <p class="text-xs text-[var(--ui-text-muted)] mt-1">
          {{ safeGoals.protein ? Math.round(product.protein / safeGoals.protein * 100) : 0 }}% {{ t('dashboard.of') }} {{ safeGoals.protein }}g
        </p>
      </div>

      <!-- Fat -->
      <div class="px-4 py-3">
        <div class="flex items-center justify-between mb-1.5">
          <span class="text-sm font-medium">{{ t('dashboard.fat') }}</span>
          <span class="text-sm font-bold">{{ Math.round(product.fat * 10) / 10 }}g</span>
        </div>
        <div class="h-2 rounded-full bg-[var(--ui-border)] overflow-hidden">
          <div
            class="h-full rounded-full bg-amber-400 transition-all"
            :style="`width: ${bar(product.fat, safeGoals.fat)}`"
          />
        </div>
        <p class="text-xs text-[var(--ui-text-muted)] mt-1">
          {{ safeGoals.fat ? Math.round(product.fat / safeGoals.fat * 100) : 0 }}% {{ t('dashboard.of') }} {{ safeGoals.fat }}g
        </p>
        <!-- Saturated fat sub-row -->
        <div
          v-if="product.saturatedFat"
          class="flex items-center justify-between mt-2 pl-3 border-l-2 border-[var(--ui-border)]"
        >
          <span class="text-xs text-[var(--ui-text-muted)]">{{ t('nutrition.saturatedFat') }}</span>
          <span class="text-xs font-medium">{{ Math.round(product.saturatedFat * 10) / 10 }}g</span>
        </div>
        <!-- Extended fats sub-rows -->
        <div
          v-for="ef in extendedFats"
          :key="ef.key"
          class="flex items-center justify-between mt-1.5 pl-3 border-l-2 border-[var(--ui-border)]"
        >
          <span class="text-xs text-[var(--ui-text-muted)]">{{ ef.label }}</span>
          <span class="text-xs font-medium">{{ Math.round((ef.value ?? 0) * 100) / 100 }}g</span>
        </div>
      </div>

      <!-- Carbs -->
      <div class="px-4 py-3">
        <div class="flex items-center justify-between mb-1.5">
          <span class="text-sm font-medium">{{ t('dashboard.carbs') }}</span>
          <span class="text-sm font-bold">{{ Math.round(product.carbs * 10) / 10 }}g</span>
        </div>
        <div class="h-2 rounded-full bg-[var(--ui-border)] overflow-hidden">
          <div
            class="h-full rounded-full bg-purple-400 transition-all"
            :style="`width: ${bar(product.carbs, safeGoals.carbs)}`"
          />
        </div>
        <p class="text-xs text-[var(--ui-text-muted)] mt-1">
          {{ safeGoals.carbs ? Math.round(product.carbs / safeGoals.carbs * 100) : 0 }}% {{ t('dashboard.of') }} {{ safeGoals.carbs }}g
        </p>
        <!-- Sugar sub-row -->
        <div
          v-if="product.sugar"
          class="flex items-center justify-between mt-2 pl-3 border-l-2 border-[var(--ui-border)]"
        >
          <span class="text-xs text-[var(--ui-text-muted)]">{{ t('nutrition.sugar') }}</span>
          <span class="text-xs font-medium">{{ Math.round(product.sugar * 10) / 10 }}g</span>
        </div>
      </div>

      <!-- Fiber -->
      <div
        v-if="product.fiber != null"
        class="px-4 py-3"
      >
        <div class="flex items-center justify-between mb-1.5">
          <span class="text-sm font-medium">{{ t('nutrition.fiber') }}</span>
          <span class="text-sm font-bold">{{ Math.round(product.fiber * 10) / 10 }}g</span>
        </div>
        <div class="h-2 rounded-full bg-[var(--ui-border)] overflow-hidden">
          <div
            class="h-full rounded-full bg-green-400 transition-all"
            :style="`width: ${bar(product.fiber, safeGoals.fiber ?? 25)}`"
          />
        </div>
        <p class="text-xs text-[var(--ui-text-muted)] mt-1">
          {{ Math.round((product.fiber ?? 0) / (safeGoals.fiber ?? 25) * 100) }}% {{ t('dashboard.of') }} {{ safeGoals.fiber ?? 25 }}g
        </p>
      </div>

      <!-- Salt -->
      <div
        v-if="product.salt"
        class="px-4 py-3 flex items-center justify-between"
      >
        <span class="text-sm font-medium">{{ t('nutrition.salt') }}</span>
        <span class="text-sm font-bold">{{ Math.round(product.salt * 100) / 100 }}g</span>
      </div>
    </div>

    <!-- Vitamins -->
    <div
      v-if="vitamins.length"
      class="mx-4 rounded-2xl border border-[var(--ui-border)] overflow-hidden mb-4"
    >
      <p class="px-4 py-2 text-xs font-semibold text-[var(--ui-text-muted)] border-b border-[var(--ui-border)] uppercase tracking-wide">
        Vitamines
      </p>
      <div class="divide-y divide-[var(--ui-border)]">
        <div
          v-for="v in vitamins"
          :key="v.key"
          class="px-4 py-2 flex items-center justify-between"
        >
          <span class="text-sm">{{ v.label }}</span>
          <span class="text-sm font-medium">{{ Math.round((v.value ?? 0) * 1000) / 1000 }} mg</span>
        </div>
      </div>
    </div>

    <!-- Minerals -->
    <div
      v-if="minerals.length"
      class="mx-4 rounded-2xl border border-[var(--ui-border)] overflow-hidden mb-4"
    >
      <p class="px-4 py-2 text-xs font-semibold text-[var(--ui-text-muted)] border-b border-[var(--ui-border)] uppercase tracking-wide">
        Minéraux
      </p>
      <div class="divide-y divide-[var(--ui-border)]">
        <div
          v-for="m in minerals"
          :key="m.key"
          class="px-4 py-2 flex items-center justify-between"
        >
          <span class="text-sm">{{ m.label }}</span>
          <span class="text-sm font-medium">{{ Math.round((m.value ?? 0) * 1000) / 1000 }} mg</span>
        </div>
      </div>
    </div>

    <!-- Additives -->
    <div
      v-if="displayAdditives.length"
      class="mx-4 mb-4"
    >
      <p class="text-xs text-[var(--ui-text-muted)] mb-1.5">
        {{ t('nutrition.additives') }}
      </p>
      <div class="flex flex-wrap gap-1">
        <span
          v-for="add in displayAdditives"
          :key="add"
          class="text-xs px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400"
        >{{ add }}</span>
      </div>
    </div>

    <!-- Ingredients collapsible -->
    <div
      v-if="product.ingredients?.length"
      class="mx-4 mb-4 rounded-2xl border border-[var(--ui-border)] overflow-hidden"
    >
      <button
        class="flex items-center gap-2 text-sm font-medium w-full px-4 py-3"
        @click="showIngredients = !showIngredients"
      >
        <UIcon
          :name="showIngredients ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
          class="w-4 h-4 text-[var(--ui-text-muted)]"
        />
        {{ t('nutrition.ingredients') }} ({{ product.ingredients.length }})
      </button>
      <div
        v-if="showIngredients"
        class="border-t border-[var(--ui-border)] divide-y divide-[var(--ui-border)]"
      >
        <div
          v-for="ing in product.ingredients"
          :key="ing.text"
          class="px-4 py-2 flex items-center gap-2 text-xs text-[var(--ui-text-muted)]"
        >
          <span class="flex-1">{{ ing.text }}</span>
          <span
            v-if="ing.percent"
            class="shrink-0 opacity-60"
          >{{ Math.round(ing.percent) }}%</span>
          <span
            v-if="ing.vegan === 'no'"
            class="shrink-0 text-red-400"
            :title="t('nutrition.notVegan')"
          >🥩</span>
        </div>
      </div>
    </div>

    <!-- Add to journal modal -->
    <UModal
      :open="showAddModal"
      :title="t('add.addToJournal')"
      @update:open="(v) => { if (!v) showAddModal = false }"
    >
      <template #body>
        <div class="space-y-4">
          <!-- Category selector -->
          <div>
            <p class="text-sm text-[var(--ui-text-muted)] mb-2">
              {{ t('mealCategory.label') }}
            </p>
            <div class="grid grid-cols-4 gap-1 bg-[var(--ui-border)] rounded-xl p-1">
              <button
                v-for="cat in mealCategories"
                :key="cat"
                class="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg text-xs font-medium transition-all"
                :class="selectedCategory === cat
                  ? 'bg-[var(--ui-bg)] shadow text-primary'
                  : 'text-[var(--ui-text-muted)] hover:text-[var(--ui-text)]'"
                @click="selectedCategory = cat"
              >
                {{ t(`mealCategory.${cat}`) }}
              </button>
            </div>
          </div>

          <!-- Portion input -->
          <div class="flex items-center gap-3">
            <span class="text-sm text-[var(--ui-text-muted)] shrink-0">
              {{ t('recipes.portionGrams') }}
            </span>
            <UInput
              v-model.number="portionGrams"
              type="number"
              min="1"
              max="5000"
              step="10"
              size="sm"
              class="w-24"
            />
            <span class="text-sm text-[var(--ui-text-muted)]">g</span>
            <span
              v-if="product?.servingSize"
              class="text-xs text-[var(--ui-text-muted)] ml-auto cursor-pointer hover:text-primary"
              @click="portionGrams = defaultPortionGrams"
            >↺ {{ product.servingSize }}</span>
          </div>

          <!-- Nutrition preview -->
          <div
            v-if="portionNutrition"
            class="grid grid-cols-4 gap-2 text-center py-3 rounded-xl bg-[var(--ui-bg-elevated)]"
          >
            <div>
              <p class="text-lg font-bold text-primary">
                {{ portionNutrition.calories }}
              </p>
              <p class="text-xs text-[var(--ui-text-muted)]">
                kcal
              </p>
            </div>
            <div>
              <p class="text-base font-semibold">
                {{ portionNutrition.protein }}g
              </p>
              <p class="text-xs text-[var(--ui-text-muted)]">
                {{ t('dashboard.protein') }}
              </p>
            </div>
            <div>
              <p class="text-base font-semibold">
                {{ portionNutrition.carbs }}g
              </p>
              <p class="text-xs text-[var(--ui-text-muted)]">
                {{ t('dashboard.carbs') }}
              </p>
            </div>
            <div>
              <p class="text-base font-semibold">
                {{ portionNutrition.fat }}g
              </p>
              <p class="text-xs text-[var(--ui-text-muted)]">
                {{ t('dashboard.fat') }}
              </p>
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex gap-2 w-full">
          <UButton
            variant="outline"
            color="neutral"
            class="flex-1"
            @click="showAddModal = false"
          >
            {{ t('common.cancel') }}
          </UButton>
          <UButton
            class="flex-1"
            :loading="addingToJournal"
            icon="i-lucide-plus"
            @click="addToJournal"
          >
            {{ t('add.addToJournal') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
