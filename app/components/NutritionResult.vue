<script setup lang="ts">
import type { NutritionResult, MealItem } from '~/types/nutrition'

const props = defineProps<{
  result: NutritionResult
  loading?: boolean
}>()

const emit = defineEmits<{ add: [result: NutritionResult] }>()
const { t } = useI18n()
const toast = useToast()

const isBarcode = computed(() => !!props.result.productName)

// Default portion to serving size from product if available, else 100g
const defaultPortionGrams = computed(() => props.result.servingGrams ?? 100)
const portionGrams = ref(defaultPortionGrams.value)
const portionMultiplier = ref(1)

watch(() => props.result.servingGrams, (v) => {
  if (v) portionGrams.value = v
})

const multiplier = computed(() =>
  isBarcode.value ? portionGrams.value / 100 : portionMultiplier.value
)

function scale1(v: number | undefined) {
  const m = multiplier.value
  return v !== undefined ? Math.round(v * m * 10) / 10 : undefined
}
function scale2(v: number | undefined) {
  const m = multiplier.value
  return v !== undefined ? Math.round(v * m * 100) / 100 : undefined
}

const scaledResult = computed<NutritionResult>(() => {
  const m = multiplier.value
  return {
    ...props.result,
    items: props.result.items.map((item: MealItem) => ({
      ...item,
      quantity: isBarcode.value ? `${portionGrams.value}g` : item.quantity,
      calories: Math.round(item.calories * m),
      protein: Math.round(item.protein * m * 10) / 10,
      carbs: Math.round(item.carbs * m * 10) / 10,
      fat: Math.round(item.fat * m * 10) / 10,
      fiber: scale1(item.fiber),
      sugar: scale1(item.sugar),
      saturatedFat: scale1(item.saturatedFat),
      salt: scale2(item.salt)
    })),
    totalCalories: Math.round(props.result.totalCalories * m),
    totalProtein: scale1(props.result.totalProtein) ?? 0,
    totalCarbs: scale1(props.result.totalCarbs) ?? 0,
    totalFat: scale1(props.result.totalFat) ?? 0,
    totalFiber: scale1(props.result.totalFiber),
    totalSugar: scale1(props.result.totalSugar),
    totalSaturatedFat: scale1(props.result.totalSaturatedFat),
    totalSalt: scale2(props.result.totalSalt),
    totalMonounsaturatedFat: scale1(props.result.totalMonounsaturatedFat),
    totalPolyunsaturatedFat: scale1(props.result.totalPolyunsaturatedFat),
    totalTransFat: scale1(props.result.totalTransFat),
    totalOmega3Fat: scale1(props.result.totalOmega3Fat),
    totalOmega6Fat: scale1(props.result.totalOmega6Fat),
    totalCholesterol: scale1(props.result.totalCholesterol)
  }
})

// NutriScore colors
const nutriScoreClass: Record<string, string> = {
  A: 'bg-green-500', B: 'bg-lime-500', C: 'bg-yellow-500', D: 'bg-orange-500', E: 'bg-red-500'
}

// NOVA group
const novaClass: Record<number, string> = {
  1: 'bg-green-500/15 text-green-700 dark:text-green-400',
  2: 'bg-lime-500/15 text-lime-700 dark:text-lime-400',
  3: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
  4: 'bg-red-500/15 text-red-700 dark:text-red-400'
}

// Labels — filter redundant/technical tags
const displayLabels = computed(() =>
  (scaledResult.value.labelsTags ?? [])
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

// Additives — only main E codes (no sub-variants like e322i)
const displayAdditives = computed(() =>
  [...new Set(
    (scaledResult.value.additivesTags ?? [])
      .map(tag => tag.replace(/^en:/, '').toUpperCase())
      .filter(code => /^E\d+$/.test(code))
  )]
)

const showIngredients = ref(false)

// Favorites
const showFavoriteForm = ref(false)
const favoriteName = ref(props.result.productName ?? props.result.items[0]?.name ?? '')
const savingFavorite = ref(false)

async function saveAsFavorite() {
  savingFavorite.value = true
  try {
    const r = scaledResult.value
    const item = r.items[0]
    await $fetch('/api/favorites', {
      method: 'POST',
      body: {
        name: favoriteName.value || r.items.map((i: MealItem) => i.name).join(', '),
        productId: item?.productId ?? null,
        productName: r.productName ?? item?.name,
        barcode: r.barcode ?? null,
        brand: r.brand ?? null,
        image: r.image ?? null,
        servingSize: item?.quantity ?? null,
        calories: r.totalCalories,
        protein: r.totalProtein,
        carbs: r.totalCarbs,
        fat: r.totalFat,
        fiber: r.totalFiber ?? null,
        sugar: r.totalSugar ?? null,
        saturatedFat: r.totalSaturatedFat ?? null,
        salt: r.totalSalt ?? null,
        nutriScore: r.nutriScore ?? null
      }
    })
    toast.add({ title: t('favorites.saved'), color: 'success', icon: 'i-lucide-heart' })
    showFavoriteForm.value = false
  } catch {
    toast.add({ title: t('common.error'), color: 'error' })
  } finally {
    savingFavorite.value = false
  }
}
</script>

<template>
  <UCard class="mt-4">
    <template #header>
      <div class="flex items-center justify-between">
        <p class="font-semibold">
          {{ t('add.aiAnalysis') }}
        </p>
        <div class="flex items-center gap-2">
          <UButton
            size="xs"
            variant="ghost"
            color="neutral"
            icon="i-lucide-heart"
            :aria-label="t('favorites.save')"
            @click="showFavoriteForm = !showFavoriteForm"
          />
          <!-- NutriScore officiel -->
          <span
            v-if="result.nutriScore"
            class="text-[10px] font-bold px-1.5 py-0.5 rounded text-white"
            :class="nutriScoreClass[result.nutriScore]"
          >{{ result.nutriScore }}</span>
          <!-- NOVA group -->
          <span
            v-if="result.novaGroup"
            class="text-[10px] font-bold px-1.5 py-0.5 rounded"
            :class="novaClass[result.novaGroup]"
          >NOVA {{ result.novaGroup }}</span>
          <!-- AI confidence -->
          <template v-if="result.confidence < 1">
            <UBadge
              :color="result.confidence >= 0.7 ? 'success' : 'warning'"
              variant="subtle"
              size="sm"
            >
              {{ Math.round(result.confidence * 100) }}%
            </UBadge>
          </template>
        </div>
      </div>
    </template>

    <!-- Favorite form -->
    <div
      v-if="showFavoriteForm"
      class="mb-4 flex gap-2"
    >
      <UInput
        v-model="favoriteName"
        :placeholder="t('favorites.namePlaceholder')"
        class="flex-1"
        @keydown.enter="saveAsFavorite"
      />
      <UButton
        :loading="savingFavorite"
        size="sm"
        @click="saveAsFavorite"
      >
        {{ t('favorites.confirm') }}
      </UButton>
    </div>

    <!-- Product image -->
    <img
      v-if="result.image"
      :src="result.image"
      :alt="result.productName"
      class="w-24 h-24 object-contain mx-auto mb-3 rounded-lg"
    >

    <!-- Brand & origins -->
    <div
      v-if="result.brand || result.origins"
      class="text-xs text-[var(--ui-text-muted)] text-center mb-3 space-x-2"
    >
      <span v-if="result.brand">{{ result.brand }}</span>
      <span
        v-if="result.brand && result.origins"
        class="opacity-40"
      >·</span>
      <span v-if="result.origins">{{ result.origins }}</span>
    </div>

    <!-- Portion adjustment -->
    <div class="flex items-center gap-2 mb-4">
      <span class="text-sm text-[var(--ui-text-muted)] shrink-0">
        {{ isBarcode ? t('add.portionGrams') : t('add.portionMultiplier') }}
      </span>
      <UInput
        v-if="isBarcode"
        v-model.number="portionGrams"
        type="number"
        min="1"
        max="2000"
        step="10"
        size="sm"
        class="w-24"
      />
      <UInput
        v-else
        v-model.number="portionMultiplier"
        type="number"
        min="0.1"
        max="10"
        step="0.5"
        size="sm"
        class="w-20"
      />
      <span class="text-sm text-[var(--ui-text-muted)]">
        {{ isBarcode ? 'g' : '×' }}
      </span>
      <!-- Serving size hint -->
      <span
        v-if="isBarcode && result.servingSize && portionGrams !== (result.servingGrams ?? 100)"
        class="text-xs text-[var(--ui-text-muted)] ml-auto cursor-pointer underline-offset-2 hover:underline"
        @click="portionGrams = result.servingGrams ?? 100"
      >
        {{ t('add.resetToServing') }} ({{ result.servingGrams }}g)
      </span>
    </div>

    <!-- Items list -->
    <div class="space-y-2 mb-4">
      <div
        v-for="(item, i) in scaledResult.items"
        :key="i"
        class="flex items-center justify-between text-sm"
      >
        <div>
          <span class="font-medium">{{ item.name }}</span>
          <span class="text-[var(--ui-text-muted)] ml-1">({{ item.quantity }})</span>
        </div>
        <span class="font-medium">{{ item.calories }} kcal</span>
      </div>
    </div>

    <!-- Core totals: kcal / protein / carbs / fat -->
    <div class="border-t border-[var(--ui-border)] pt-3">
      <div class="grid grid-cols-4 gap-2 text-center">
        <div>
          <p class="text-lg font-bold text-primary">
            {{ Math.round(scaledResult.totalCalories) }}
          </p>
          <p class="text-xs text-[var(--ui-text-muted)]">
            kcal
          </p>
        </div>
        <div>
          <p class="text-lg font-bold">
            {{ scaledResult.totalProtein }}g
          </p>
          <p class="text-xs text-[var(--ui-text-muted)]">
            {{ t('dashboard.protein') }}
          </p>
        </div>
        <div>
          <p class="text-lg font-bold">
            {{ scaledResult.totalCarbs }}g
          </p>
          <p class="text-xs text-[var(--ui-text-muted)]">
            {{ t('dashboard.carbs') }}
          </p>
        </div>
        <div>
          <p class="text-lg font-bold">
            {{ scaledResult.totalFat }}g
          </p>
          <p class="text-xs text-[var(--ui-text-muted)]">
            {{ t('dashboard.fat') }}
          </p>
        </div>
      </div>
    </div>

    <!-- Extended nutrition: fiber / sugar / saturated fat / salt -->
    <div
      v-if="scaledResult.totalFiber !== undefined || scaledResult.totalSugar !== undefined || scaledResult.totalSaturatedFat !== undefined || scaledResult.totalSalt !== undefined"
      class="border-t border-[var(--ui-border)] pt-3 mt-3"
    >
      <div class="grid grid-cols-4 gap-2 text-center">
        <div v-if="scaledResult.totalFiber !== undefined">
          <p class="text-base font-semibold text-green-500">
            {{ scaledResult.totalFiber }}g
          </p>
          <p class="text-xs text-[var(--ui-text-muted)]">
            {{ t('nutrition.fiber') }}
          </p>
        </div>
        <div v-if="scaledResult.totalSugar !== undefined">
          <p class="text-base font-semibold text-amber-500">
            {{ scaledResult.totalSugar }}g
          </p>
          <p class="text-xs text-[var(--ui-text-muted)]">
            {{ t('nutrition.sugar') }}
          </p>
        </div>
        <div v-if="scaledResult.totalSaturatedFat !== undefined">
          <p class="text-base font-semibold text-orange-500">
            {{ scaledResult.totalSaturatedFat }}g
          </p>
          <p class="text-xs text-[var(--ui-text-muted)]">
            {{ t('nutrition.saturatedFat') }}
          </p>
        </div>
        <div v-if="scaledResult.totalSalt !== undefined">
          <p class="text-base font-semibold text-[var(--ui-text-muted)]">
            {{ scaledResult.totalSalt }}g
          </p>
          <p class="text-xs text-[var(--ui-text-muted)]">
            {{ t('nutrition.salt') }}
          </p>
        </div>
      </div>
    </div>

    <!-- Labels -->
    <div
      v-if="displayLabels.length"
      class="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-[var(--ui-border)]"
    >
      <span
        v-for="label in displayLabels"
        :key="label"
        class="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-700 dark:text-green-400 font-medium"
      >{{ label }}</span>
    </div>

    <!-- Additives -->
    <div
      v-if="displayAdditives.length"
      class="mt-3 pt-3 border-t border-[var(--ui-border)]"
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
      v-if="scaledResult.ingredients?.length"
      class="mt-3 pt-3 border-t border-[var(--ui-border)]"
    >
      <button
        class="flex items-center gap-1 text-xs font-medium text-[var(--ui-text-muted)] w-full"
        @click="showIngredients = !showIngredients"
      >
        <UIcon
          :name="showIngredients ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
          class="w-3.5 h-3.5"
        />
        {{ t('nutrition.ingredients') }} ({{ scaledResult.ingredients.length }})
      </button>
      <div
        v-if="showIngredients"
        class="mt-2 space-y-1"
      >
        <div
          v-for="ing in scaledResult.ingredients"
          :key="ing.text"
          class="flex items-center gap-2 text-xs text-[var(--ui-text-muted)]"
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

    <template #footer>
      <UButton
        block
        :loading="loading"
        icon="i-lucide-plus"
        @click="emit('add', scaledResult)"
      >
        {{ t('add.addToJournal') }}
      </UButton>
    </template>
  </UCard>
</template>
