<script setup lang="ts">
import type { RecipeIngredient } from '~/components/RecipeIngredientPicker.vue'

const { t } = useI18n()
const router = useRouter()
const toast = useToast()

interface Ingredient extends RecipeIngredient {}

const name = ref('')
const description = ref('')
const ingredients = ref<Ingredient[]>([])
const saving = ref(false)

const totalWeight = computed(() => ingredients.value.reduce((s, ing) => s + ing.quantityGrams, 0))

const nutrition100g = computed(() => {
  if (totalWeight.value === 0) return null
  const f = 100 / totalWeight.value
  return {
    calories: Math.round(ingredients.value.reduce((s, ing) => s + ing.calories * ing.quantityGrams / 100, 0) * f),
    protein: Math.round(ingredients.value.reduce((s, ing) => s + ing.protein * ing.quantityGrams / 100, 0) * f * 10) / 10,
    carbs: Math.round(ingredients.value.reduce((s, ing) => s + ing.carbs * ing.quantityGrams / 100, 0) * f * 10) / 10,
    fat: Math.round(ingredients.value.reduce((s, ing) => s + ing.fat * ing.quantityGrams / 100, 0) * f * 10) / 10
  }
})

function addIngredient(ing: RecipeIngredient) {
  // Merge quantity if same product already added
  const existing = ingredients.value.find(i => i.productId === ing.productId)
  if (existing) {
    existing.quantityGrams += ing.quantityGrams
  } else {
    ingredients.value.push({ ...ing })
  }
}

function removeIngredient(idx: number) {
  ingredients.value.splice(idx, 1)
}

async function save() {
  if (!name.value.trim()) {
    toast.add({ title: t('recipes.name'), color: 'warning' })
    return
  }
  saving.value = true
  try {
    const recipe = await $fetch('/api/recipes', {
      method: 'POST',
      body: {
        name: name.value.trim(),
        description: description.value.trim() || null,
        ingredients: ingredients.value.map(ing => ({
          productId: ing.productId,
          quantityGrams: ing.quantityGrams
        }))
      }
    })
    toast.add({ title: t('recipes.saved'), color: 'success', icon: 'i-lucide-check-circle' })
    await router.push(`/recipes/${(recipe as { id: string }).id}`)
  } catch {
    toast.add({ title: t('common.error'), color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="max-w-xl mx-auto pb-8">
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
      <h1 class="font-bold text-base flex-1">
        {{ t('recipes.new') }}
      </h1>
      <UButton
        :loading="saving"
        icon="i-lucide-check"
        @click="save"
      >
        {{ t('common.save') }}
      </UButton>
    </div>

    <div class="px-4 pt-4 space-y-5">
      <!-- Name & description -->
      <UFormField
        :label="t('recipes.name')"
        name="name"
        required
      >
        <UInput
          v-model="name"
          :placeholder="t('recipes.namePlaceholder')"
          class="w-full"
        />
      </UFormField>

      <UFormField
        :label="t('recipes.description')"
        name="description"
      >
        <UInput
          v-model="description"
          :placeholder="t('recipes.descriptionPlaceholder')"
          class="w-full"
        />
      </UFormField>

      <!-- Nutrition preview -->
      <div
        v-if="nutrition100g"
        class="rounded-2xl bg-[var(--ui-bg-elevated)] p-4"
      >
        <p class="text-xs text-[var(--ui-text-muted)] mb-2">
          {{ t('nutrition.per100g') }} · {{ t('recipes.totalWeight') }}: {{ totalWeight }}g
        </p>
        <div class="grid grid-cols-4 gap-2 text-center">
          <div>
            <p class="text-lg font-bold text-primary">
              {{ nutrition100g.calories }}
            </p>
            <p class="text-xs text-[var(--ui-text-muted)]">
              kcal
            </p>
          </div>
          <div>
            <p class="text-base font-semibold">
              {{ nutrition100g.protein }}g
            </p>
            <p class="text-xs text-[var(--ui-text-muted)]">
              {{ t('dashboard.protein') }}
            </p>
          </div>
          <div>
            <p class="text-base font-semibold">
              {{ nutrition100g.carbs }}g
            </p>
            <p class="text-xs text-[var(--ui-text-muted)]">
              {{ t('dashboard.carbs') }}
            </p>
          </div>
          <div>
            <p class="text-base font-semibold">
              {{ nutrition100g.fat }}g
            </p>
            <p class="text-xs text-[var(--ui-text-muted)]">
              {{ t('dashboard.fat') }}
            </p>
          </div>
        </div>
      </div>

      <!-- Ingredients section -->
      <div>
        <h2 class="font-semibold text-sm mb-3">
          {{ t('recipes.ingredients') }}
        </h2>

        <!-- Added ingredients list -->
        <div
          v-if="ingredients.length"
          class="space-y-2 mb-4"
        >
          <div
            v-for="(ing, idx) in ingredients"
            :key="ing.productId"
            class="flex items-center gap-3 p-3 rounded-xl border border-[var(--ui-border)]"
          >
            <img
              v-if="ing.image"
              :src="ing.image"
              :alt="ing.name"
              class="w-10 h-10 object-contain rounded-lg shrink-0"
            >
            <div
              v-else
              class="w-10 h-10 rounded-lg bg-[var(--ui-bg-elevated)] shrink-0 flex items-center justify-center"
            >
              <UIcon
                name="i-lucide-package"
                class="w-5 h-5 text-[var(--ui-text-muted)]"
              />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium truncate">
                {{ ing.name }}
              </p>
              <p class="text-xs text-[var(--ui-text-muted)]">
                {{ Math.round(ing.calories * ing.quantityGrams / 100) }} kcal
              </p>
            </div>
            <UInput
              v-model.number="ing.quantityGrams"
              type="number"
              min="1"
              max="5000"
              step="10"
              size="sm"
              class="w-20"
            />
            <span class="text-xs text-[var(--ui-text-muted)]">g</span>
            <UButton
              size="xs"
              variant="ghost"
              color="error"
              icon="i-lucide-trash-2"
              @click="removeIngredient(idx)"
            />
          </div>
        </div>

        <!-- Ingredient picker -->
        <RecipeIngredientPicker @add="addIngredient" />
      </div>
    </div>
  </div>
</template>
