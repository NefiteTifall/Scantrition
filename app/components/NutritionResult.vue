<script setup lang="ts">
import type { NutritionResult } from '~/server/utils/ai'

const props = defineProps<{
  result: NutritionResult & { productName?: string, brand?: string, image?: string }
  loading?: boolean
}>()

const emit = defineEmits<{ add: [result: NutritionResult] }>()
const { t } = useI18n()
const toast = useToast()

const showFavoriteForm = ref(false)
const favoriteName = ref(props.result.productName ?? props.result.items[0]?.name ?? '')
const savingFavorite = ref(false)

async function saveAsFavorite() {
  savingFavorite.value = true
  try {
    await $fetch('/api/favorites', {
      method: 'POST',
      body: {
        name: favoriteName.value || props.result.items.map(i => i.name).join(', '),
        items: props.result.items,
        totalCalories: props.result.totalCalories,
        totalProtein: props.result.totalProtein,
        totalCarbs: props.result.totalCarbs,
        totalFat: props.result.totalFat
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

    <!-- Items list -->
    <div class="space-y-2 mb-4">
      <div
        v-for="(item, i) in result.items"
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
            {{ Math.round(result.totalCalories) }}
          </p>
          <p class="text-xs text-[var(--ui-text-muted)]">
            kcal
          </p>
        </div>
        <div>
          <p class="text-lg font-bold">
            {{ Math.round(result.totalProtein) }}g
          </p>
          <p class="text-xs text-[var(--ui-text-muted)]">
            {{ t('dashboard.protein') }}
          </p>
        </div>
        <div>
          <p class="text-lg font-bold">
            {{ Math.round(result.totalCarbs) }}g
          </p>
          <p class="text-xs text-[var(--ui-text-muted)]">
            {{ t('dashboard.carbs') }}
          </p>
        </div>
        <div>
          <p class="text-lg font-bold">
            {{ Math.round(result.totalFat) }}g
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
        @click="emit('add', result)"
      >
        {{ t('add.addToJournal') }}
      </UButton>
    </template>
  </UCard>
</template>
