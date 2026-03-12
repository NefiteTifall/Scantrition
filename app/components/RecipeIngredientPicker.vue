<script setup lang="ts">
import type { NutritionResult } from '~/types/nutrition'

export interface RecipeIngredient {
  productId: string
  name: string
  brand: string | null
  image: string | null
  calories: number
  protein: number
  carbs: number
  fat: number
  quantityGrams: number
}

const emit = defineEmits<{ add: [ingredient: RecipeIngredient] }>()
const { t } = useI18n()
const toast = useToast()

type Mode = 'barcode' | 'search'
const mode = ref<Mode>('barcode')

// Pending product after scan/search — waiting for quantity confirmation
interface PendingProduct {
  productId: string
  name: string
  brand: string | null
  image: string | null
  calories: number
  protein: number
  carbs: number
  fat: number
  servingGrams: number | null
}

const pending = ref<PendingProduct | null>(null)
const quantityGrams = ref(100)
const upserting = ref(false)

// DB search state
const searchQuery = ref('')
const searchResults = ref<Array<{ id: string, name: string, brand: string | null, image: string | null, calories: number, protein: number, carbs: number, fat: number, servingSize: string | null }>>([])
const searching = ref(false)
let searchTimeout: ReturnType<typeof setTimeout> | null = null

watch(searchQuery, (q) => {
  if (searchTimeout) clearTimeout(searchTimeout)
  if (q.trim().length < 2) {
    searchResults.value = []
    return
  }
  searchTimeout = setTimeout(async () => {
    searching.value = true
    try {
      const data = await $fetch<typeof searchResults.value>('/api/products/search', { query: { q } })
      searchResults.value = data
    } catch {
      searchResults.value = []
    } finally {
      searching.value = false
    }
  }, 300)
})

function selectFromSearch(p: typeof searchResults.value[0]) {
  const sg = p.servingSize?.match(/(\d+(?:\.\d+)?)\s*g/i)?.[1]
  pending.value = {
    productId: p.id,
    name: p.name,
    brand: p.brand,
    image: p.image,
    calories: p.calories,
    protein: p.protein,
    carbs: p.carbs,
    fat: p.fat,
    servingGrams: sg ? parseFloat(sg) : null
  }
  quantityGrams.value = sg ? Math.round(parseFloat(sg)) : 100
  searchQuery.value = ''
  searchResults.value = []
}

async function onBarcodeResult(result: NutritionResult) {
  upserting.value = true
  try {
    const item = result.items?.[0]
    if (!item) return

    // If the item already has a productId in our DB, use it directly
    if (item.productId) {
      pending.value = {
        productId: item.productId,
        name: result.productName ?? item.name,
        brand: result.brand ?? null,
        image: result.image ?? null,
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat,
        servingGrams: result.servingGrams ?? null
      }
      quantityGrams.value = result.servingGrams ? Math.round(result.servingGrams) : 100
      return
    }

    // Upsert the product in DB to get an ID
    const product = await $fetch('/api/products', {
      method: 'POST',
      body: {
        name: result.productName ?? item.name,
        barcode: result.barcode,
        brand: result.brand,
        image: result.image,
        servingSize: result.servingSize,
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat,
        fiber: item.fiber,
        sugar: item.sugar,
        saturatedFat: item.saturatedFat,
        salt: item.salt,
        novaGroup: result.novaGroup,
        nutriScore: result.nutriScore,
        nutriscoreScore: result.nutriscoreScore,
        origins: result.origins,
        ingredients: result.ingredients,
        labelsTags: result.labelsTags,
        additivesTags: result.additivesTags,
        fattyAcids: result.fattyAcids,
        sugarsDetail: result.sugarsDetail,
        aminoAcids: result.aminoAcids,
        mineralsDetail: result.mineralsDetail
      }
    }) as { id: string, name: string, brand: string | null, image: string | null, calories: number, protein: number, carbs: number, fat: number }

    pending.value = {
      productId: product.id,
      name: product.name,
      brand: product.brand,
      image: product.image,
      calories: product.calories,
      protein: product.protein,
      carbs: product.carbs,
      fat: product.fat,
      servingGrams: result.servingGrams ?? null
    }
    quantityGrams.value = result.servingGrams ? Math.round(result.servingGrams) : 100
  } catch {
    toast.add({ title: t('common.error'), color: 'error' })
  } finally {
    upserting.value = false
  }
}

const scaledNutrition = computed(() => {
  if (!pending.value) return null
  const m = quantityGrams.value / 100
  return {
    calories: Math.round(pending.value.calories * m),
    protein: Math.round(pending.value.protein * m * 10) / 10,
    carbs: Math.round(pending.value.carbs * m * 10) / 10,
    fat: Math.round(pending.value.fat * m * 10) / 10
  }
})

function confirm() {
  if (!pending.value) return
  emit('add', {
    productId: pending.value.productId,
    name: pending.value.name,
    brand: pending.value.brand,
    image: pending.value.image,
    calories: pending.value.calories,
    protein: pending.value.protein,
    carbs: pending.value.carbs,
    fat: pending.value.fat,
    quantityGrams: quantityGrams.value
  })
  pending.value = null
  quantityGrams.value = 100
}

function cancel() {
  pending.value = null
}
</script>

<template>
  <div class="space-y-3">
    <!-- Confirmation step (after scan or search selection) -->
    <div
      v-if="pending"
      class="rounded-2xl border border-primary/40 bg-[var(--ui-bg-elevated)] p-4 space-y-3"
    >
      <!-- Product header -->
      <div class="flex items-center gap-3">
        <img
          v-if="pending.image"
          :src="pending.image"
          :alt="pending.name"
          class="w-12 h-12 object-contain rounded-xl bg-white shrink-0"
        >
        <div
          v-else
          class="w-12 h-12 rounded-xl bg-[var(--ui-border)] shrink-0"
        />
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-sm truncate">
            {{ pending.name }}
          </p>
          <p
            v-if="pending.brand"
            class="text-xs text-[var(--ui-text-muted)]"
          >
            {{ pending.brand }}
          </p>
        </div>
        <UButton
          size="xs"
          variant="ghost"
          color="neutral"
          icon="i-lucide-x"
          @click="cancel"
        />
      </div>

      <!-- Quantity input -->
      <div class="space-y-1.5">
        <div class="flex items-center gap-3">
          <label class="text-sm font-medium flex-1">{{ t('recipes.quantity') }}</label>
          <div class="flex items-center gap-2">
            <UInput
              v-model.number="quantityGrams"
              type="number"
              min="1"
              max="5000"
              step="10"
              size="sm"
              class="w-24"
            />
            <span class="text-sm text-[var(--ui-text-muted)]">g</span>
          </div>
        </div>
        <!-- Raw weight note -->
        <p class="text-xs text-[var(--ui-text-muted)] flex items-center gap-1">
          <UIcon
            name="i-lucide-info"
            class="w-3 h-3 shrink-0"
          />
          {{ t('recipes.rawWeightHint') }}
          <button
            v-if="pending.servingGrams && pending.servingGrams !== quantityGrams"
            class="text-primary underline ml-1"
            @click="quantityGrams = Math.round(pending.servingGrams!)"
          >
            {{ pending.servingGrams }}g
          </button>
        </p>
      </div>

      <!-- Nutrition preview -->
      <div
        v-if="scaledNutrition"
        class="grid grid-cols-4 gap-2 text-center py-2 rounded-xl bg-[var(--ui-bg)] text-sm"
      >
        <div>
          <p class="font-bold text-primary">
            {{ scaledNutrition.calories }}
          </p>
          <p class="text-xs text-[var(--ui-text-muted)]">
            kcal
          </p>
        </div>
        <div>
          <p class="font-semibold">
            {{ scaledNutrition.protein }}g
          </p>
          <p class="text-xs text-[var(--ui-text-muted)]">
            P
          </p>
        </div>
        <div>
          <p class="font-semibold">
            {{ scaledNutrition.carbs }}g
          </p>
          <p class="text-xs text-[var(--ui-text-muted)]">
            G
          </p>
        </div>
        <div>
          <p class="font-semibold">
            {{ scaledNutrition.fat }}g
          </p>
          <p class="text-xs text-[var(--ui-text-muted)]">
            L
          </p>
        </div>
      </div>

      <UButton
        block
        icon="i-lucide-plus"
        @click="confirm"
      >
        {{ t('recipes.addIngredient') }}
      </UButton>
    </div>

    <!-- Picker (hidden while confirming) -->
    <template v-else>
      <!-- Mode tabs -->
      <div class="flex gap-2">
        <button
          class="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all"
          :class="mode === 'barcode'
            ? 'bg-primary text-white'
            : 'bg-[var(--ui-bg-elevated)] text-[var(--ui-text-muted)]'"
          @click="mode = 'barcode'"
        >
          <UIcon
            name="i-lucide-scan-barcode"
            class="w-4 h-4"
          />
          {{ t('add.barcodeMode') }}
        </button>
        <button
          class="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all"
          :class="mode === 'search'
            ? 'bg-primary text-white'
            : 'bg-[var(--ui-bg-elevated)] text-[var(--ui-text-muted)]'"
          @click="mode = 'search'"
        >
          <UIcon
            name="i-lucide-search"
            class="w-4 h-4"
          />
          {{ t('add.searchMode') }}
        </button>
      </div>

      <!-- Barcode scanner -->
      <div
        v-if="mode === 'barcode'"
        class="relative"
      >
        <div
          v-if="upserting"
          class="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-[var(--ui-bg)]/80"
        >
          <UIcon
            name="i-lucide-loader-2"
            class="w-6 h-6 animate-spin text-primary"
          />
        </div>
        <MealAddBarcode @result="onBarcodeResult" />
      </div>

      <!-- DB search -->
      <div
        v-else
        class="space-y-2"
      >
        <div class="relative">
          <UInput
            v-model="searchQuery"
            :placeholder="t('recipes.searchProduct')"
            icon="i-lucide-search"
            :loading="searching"
            class="w-full"
          />
          <!-- Dropdown -->
          <div
            v-if="searchResults.length"
            class="absolute top-full left-0 right-0 z-20 mt-1 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-bg)] shadow-lg overflow-hidden"
          >
            <button
              v-for="result in searchResults.slice(0, 8)"
              :key="result.id"
              class="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-[var(--ui-bg-elevated)] transition-colors text-left"
              @click="selectFromSearch(result)"
            >
              <img
                v-if="result.image"
                :src="result.image"
                :alt="result.name"
                class="w-8 h-8 object-contain rounded shrink-0"
              >
              <div
                v-else
                class="w-8 h-8 rounded bg-[var(--ui-bg-elevated)] shrink-0 flex items-center justify-center"
              >
                <UIcon
                  name="i-lucide-package"
                  class="w-4 h-4 text-[var(--ui-text-muted)]"
                />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium truncate">
                  {{ result.name }}
                </p>
                <p
                  v-if="result.brand"
                  class="text-xs text-[var(--ui-text-muted)]"
                >
                  {{ result.brand }}
                </p>
              </div>
              <span class="text-xs text-primary font-semibold shrink-0">
                {{ Math.round(result.calories) }} kcal/100g
              </span>
            </button>
          </div>
        </div>
        <p
          v-if="searchQuery.length >= 2 && !searching && !searchResults.length"
          class="text-xs text-[var(--ui-text-muted)] text-center py-2"
        >
          {{ t('search.noResults') }} — {{ t('recipes.scanToAdd') }}
        </p>
      </div>
    </template>
  </div>
</template>
