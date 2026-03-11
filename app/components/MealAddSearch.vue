<script setup lang="ts">
import type { NutritionResult } from '~/server/utils/ai'

const emit = defineEmits<{ result: [result: NutritionResult] }>()
const { t } = useI18n()

interface FoodResult {
  code?: string
  name: string
  brand: string | null
  image: string | null
  per100g: { calories: number; protein: number; carbs: number; fat: number; fiber: number }
}

const query = ref('')
const results = ref<FoodResult[]>([])
const loading = ref(false)
const selected = ref<FoodResult | null>(null)
const quantity = ref(100)
const error = ref('')

async function search() {
  if (query.value.trim().length < 2) return
  loading.value = true
  error.value = ''
  results.value = []
  selected.value = null

  try {
    results.value = await $fetch<FoodResult[]>('/api/search/food', { query: { q: query.value } })
  } catch {
    error.value = t('common.error')
  } finally {
    loading.value = false
  }
}

function select(item: FoodResult) {
  selected.value = item
  quantity.value = 100
}

const scaled = computed(() => {
  if (!selected.value) return null
  const ratio = quantity.value / 100
  const p = selected.value.per100g
  return {
    calories: Math.round(p.calories * ratio),
    protein: Math.round(p.protein * ratio * 10) / 10,
    carbs: Math.round(p.carbs * ratio * 10) / 10,
    fat: Math.round(p.fat * ratio * 10) / 10,
    fiber: Math.round(p.fiber * ratio * 10) / 10
  }
})

function addToJournal() {
  if (!selected.value || !scaled.value) return
  const result: NutritionResult = {
    items: [{
      name: selected.value.name,
      quantity: `${quantity.value}g`,
      calories: scaled.value.calories,
      protein: scaled.value.protein,
      carbs: scaled.value.carbs,
      fat: scaled.value.fat,
      fiber: scaled.value.fiber
    }],
    totalCalories: scaled.value.calories,
    totalProtein: scaled.value.protein,
    totalCarbs: scaled.value.carbs,
    totalFat: scaled.value.fat,
    confidence: 1
  }
  emit('result', result)
}
</script>

<template>
  <div class="space-y-3">
    <!-- Search input -->
    <div class="flex gap-2">
      <UInput
        v-model="query"
        :placeholder="t('search.placeholder')"
        class="flex-1"
        @keydown.enter="search"
      />
      <UButton :loading="loading" icon="i-lucide-search" @click="search">
        {{ t('common.search') }}
      </UButton>
    </div>

    <UAlert v-if="error" color="error" variant="subtle" :description="error" icon="i-lucide-alert-circle" />

    <!-- Results list -->
    <div v-if="results.length && !selected" class="space-y-2">
      <div
        v-for="item in results"
        :key="item.code ?? item.name"
        class="flex items-center gap-3 p-3 rounded-xl border border-[var(--ui-border)] hover:border-primary cursor-pointer transition-colors"
        @click="select(item)"
      >
        <img
          v-if="item.image"
          :src="item.image"
          :alt="item.name"
          class="w-10 h-10 object-contain rounded shrink-0"
        >
        <div v-else class="w-10 h-10 rounded bg-[var(--ui-border)] shrink-0 flex items-center justify-center">
          <UIcon name="i-lucide-package" class="w-5 h-5 text-[var(--ui-text-muted)]" />
        </div>
        <div class="flex-1 min-w-0">
          <p class="font-medium truncate text-sm">{{ item.name }}</p>
          <p v-if="item.brand" class="text-xs text-[var(--ui-text-muted)] truncate">{{ item.brand }}</p>
        </div>
        <div class="text-right shrink-0">
          <p class="text-sm font-bold text-primary">{{ item.per100g.calories }} kcal</p>
          <p class="text-xs text-[var(--ui-text-muted)]">pour 100g</p>
        </div>
      </div>
    </div>

    <p v-else-if="!loading && query && !results.length" class="text-center text-sm text-[var(--ui-text-muted)] py-4">
      {{ t('search.noResults') }}
    </p>

    <!-- Selected product detail -->
    <div v-if="selected" class="space-y-3">
      <div class="flex items-center gap-2">
        <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-arrow-left" @click="selected = null" />
        <p class="font-medium">{{ selected.name }}</p>
      </div>

      <UFormField :label="t('search.quantity')" name="quantity">
        <UInput v-model.number="quantity" type="number" min="1" max="2000" class="w-full" />
      </UFormField>

      <div v-if="scaled" class="grid grid-cols-4 gap-2 text-center p-3 rounded-xl bg-[var(--ui-bg-elevated)]">
        <div>
          <p class="font-bold text-primary">{{ scaled.calories }}</p>
          <p class="text-xs text-[var(--ui-text-muted)]">kcal</p>
        </div>
        <div>
          <p class="font-bold">{{ scaled.protein }}g</p>
          <p class="text-xs text-[var(--ui-text-muted)]">{{ t('dashboard.protein') }}</p>
        </div>
        <div>
          <p class="font-bold">{{ scaled.carbs }}g</p>
          <p class="text-xs text-[var(--ui-text-muted)]">{{ t('dashboard.carbs') }}</p>
        </div>
        <div>
          <p class="font-bold">{{ scaled.fat }}g</p>
          <p class="text-xs text-[var(--ui-text-muted)]">{{ t('dashboard.fat') }}</p>
        </div>
      </div>

      <UButton block icon="i-lucide-plus" @click="addToJournal">
        {{ t('add.addToJournal') }}
      </UButton>
    </div>
  </div>
</template>
