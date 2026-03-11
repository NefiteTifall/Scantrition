<script setup lang="ts">
import type { NutritionResult, MealItem } from '~/types/nutrition'

const props = defineProps<{
  result: NutritionResult & { productName?: string, brand?: string, image?: string }
  loading?: boolean
}>()

const emit = defineEmits<{ add: [result: NutritionResult] }>()
const { t } = useI18n()
const toast = useToast()

// Barcode results are always per 100g (confidence === 1 + productName)
const isBarcode = computed(() => !!props.result.productName)

const portionGrams = ref(100)
const portionMultiplier = ref(1)

const multiplier = computed(() =>
  isBarcode.value ? portionGrams.value / 100 : portionMultiplier.value
)

const scaledResult = computed<NutritionResult & { productName?: string, brand?: string, image?: string }>(() => {
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
      fiber: item.fiber !== undefined ? Math.round(item.fiber * m * 10) / 10 : undefined
    })),
    totalCalories: Math.round(props.result.totalCalories * m),
    totalProtein: Math.round(props.result.totalProtein * m * 10) / 10,
    totalCarbs: Math.round(props.result.totalCarbs * m * 10) / 10,
    totalFat: Math.round(props.result.totalFat * m * 10) / 10
  }
})

const showFavoriteForm = ref(false)
const favoriteName = ref(props.result.productName ?? props.result.items[0]?.name ?? '')
const savingFavorite = ref(false)

async function saveAsFavorite() {
  savingFavorite.value = true
  try {
    const r = scaledResult.value
    await $fetch('/api/favorites', {
      method: 'POST',
      body: {
        name: favoriteName.value || r.items.map((i: MealItem) => i.name).join(', '),
        items: r.items,
        totalCalories: r.totalCalories,
        totalProtein: r.totalProtein,
        totalCarbs: r.totalCarbs,
        totalFat: r.totalFat
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

    <!-- Product image (barcode) -->
    <img
      v-if="result.image"
      :src="result.image"
      :alt="result.productName"
      class="w-24 h-24 object-contain mx-auto mb-3 rounded-lg"
    >

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

    <!-- Totals -->
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
            {{ Math.round(scaledResult.totalProtein) }}g
          </p>
          <p class="text-xs text-[var(--ui-text-muted)]">
            {{ t('dashboard.protein') }}
          </p>
        </div>
        <div>
          <p class="text-lg font-bold">
            {{ Math.round(scaledResult.totalCarbs) }}g
          </p>
          <p class="text-xs text-[var(--ui-text-muted)]">
            {{ t('dashboard.carbs') }}
          </p>
        </div>
        <div>
          <p class="text-lg font-bold">
            {{ Math.round(scaledResult.totalFat) }}g
          </p>
          <p class="text-xs text-[var(--ui-text-muted)]">
            {{ t('dashboard.fat') }}
          </p>
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
