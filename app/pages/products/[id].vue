<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const { t } = useI18n()

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
  nutriScore: 'A' | 'B' | 'C' | 'D' | 'E' | null
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
  A: 'bg-green-500',
  B: 'bg-lime-500',
  C: 'bg-yellow-500',
  D: 'bg-orange-500',
  E: 'bg-red-500'
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
      <span
        v-if="product.nutriScore"
        class="shrink-0 text-xs font-bold px-2 py-1 rounded text-white"
        :class="nutriScoreColors[product.nutriScore]"
      >{{ product.nutriScore }}</span>
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
        <div class="flex items-center gap-2 mt-2">
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
        </div>
      </div>
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
  </div>
</template>
