<script setup lang="ts">
const { t } = useI18n()
const router = useRouter()
const toast = useToast()

interface RecipeIngredient {
  id: string
  productId: string
  quantityGrams: number
  name: string
  brand: string | null
  image: string | null
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number | null
  sugar: number | null
  saturatedFat: number | null
  salt: number | null
}

interface Recipe {
  id: string
  name: string
  description: string | null
  createdAt: string
  ingredients: RecipeIngredient[]
  totalWeightGrams: number
  nutrition100g: {
    calories: number
    protein: number
    carbs: number
    fat: number
    fiber: number
    sugar: number
    saturatedFat: number
    salt: number
  }
}

const { data: recipes, refresh } = await useFetch<Recipe[]>('/api/recipes')

const deleting = ref<string | null>(null)

async function deleteRecipe(id: string) {
  deleting.value = id
  try {
    await $fetch(`/api/recipes/${id}`, { method: 'DELETE' })
    toast.add({ title: t('recipes.deleted'), color: 'success', icon: 'i-lucide-check-circle' })
    await refresh()
  } catch {
    toast.add({ title: t('common.error'), color: 'error' })
  } finally {
    deleting.value = null
  }
}
</script>

<template>
  <div class="max-w-xl mx-auto pb-8">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-4">
      <h1 class="font-bold text-xl">
        {{ t('recipes.title') }}
      </h1>
      <UButton
        icon="i-lucide-plus"
        @click="router.push('/recipes/new')"
      >
        {{ t('recipes.new') }}
      </UButton>
    </div>

    <!-- Empty state -->
    <div
      v-if="!recipes?.length"
      class="px-4 py-12 text-center"
    >
      <UIcon
        name="i-lucide-chef-hat"
        class="w-12 h-12 mx-auto text-[var(--ui-text-muted)] mb-3"
      />
      <p class="font-medium text-[var(--ui-text-muted)]">
        {{ t('recipes.noRecipes') }}
      </p>
      <p class="text-sm text-[var(--ui-text-muted)] mt-1">
        {{ t('recipes.createFirst') }}
      </p>
      <UButton
        class="mt-4"
        icon="i-lucide-plus"
        @click="router.push('/recipes/new')"
      >
        {{ t('recipes.new') }}
      </UButton>
    </div>

    <!-- Recipe list -->
    <div
      v-else
      class="px-4 space-y-3"
    >
      <div
        v-for="recipe in recipes"
        :key="recipe.id"
        class="rounded-2xl border border-[var(--ui-border)] overflow-hidden"
      >
        <!-- Recipe header -->
        <NuxtLink
          :to="`/recipes/${recipe.id}`"
          class="flex items-start gap-3 px-4 py-3 hover:bg-[var(--ui-bg-elevated)] transition-colors"
        >
          <div
            class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-primary/10"
          >
            <UIcon
              name="i-lucide-chef-hat"
              class="w-5 h-5 text-primary"
            />
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-semibold text-sm">
              {{ recipe.name }}
            </p>
            <p
              v-if="recipe.description"
              class="text-xs text-[var(--ui-text-muted)] truncate"
            >
              {{ recipe.description }}
            </p>
            <p class="text-xs text-[var(--ui-text-muted)] mt-0.5">
              {{ recipe.ingredients.length }} ingr. · {{ recipe.totalWeightGrams }}g total
            </p>
          </div>
          <div class="shrink-0 text-right">
            <p class="font-bold text-primary text-sm">
              {{ recipe.nutrition100g.calories }} kcal
            </p>
            <p class="text-xs text-[var(--ui-text-muted)]">
              {{ t('nutrition.per100g') }}
            </p>
          </div>
        </NuxtLink>

        <!-- Macro bar -->
        <div
          v-if="recipe.nutrition100g.protein + recipe.nutrition100g.carbs + recipe.nutrition100g.fat > 0"
          class="border-t border-[var(--ui-border)] px-4 py-2"
        >
          <div class="flex h-1.5 rounded-full overflow-hidden gap-px mb-1.5">
            <div
              class="bg-blue-400 h-full transition-all"
              :style="`width: ${recipe.nutrition100g.protein / (recipe.nutrition100g.protein + recipe.nutrition100g.carbs + recipe.nutrition100g.fat) * 100}%`"
            />
            <div
              class="bg-amber-400 h-full transition-all"
              :style="`width: ${recipe.nutrition100g.carbs / (recipe.nutrition100g.protein + recipe.nutrition100g.carbs + recipe.nutrition100g.fat) * 100}%`"
            />
            <div
              class="bg-purple-400 h-full transition-all"
              :style="`width: ${recipe.nutrition100g.fat / (recipe.nutrition100g.protein + recipe.nutrition100g.carbs + recipe.nutrition100g.fat) * 100}%`"
            />
          </div>
          <div class="flex gap-3 text-xs text-[var(--ui-text-muted)] justify-between">
            <span>P {{ Math.round(recipe.nutrition100g.protein * 10) / 10 }}g</span>
            <span>G {{ Math.round(recipe.nutrition100g.carbs * 10) / 10 }}g</span>
            <span>L {{ Math.round(recipe.nutrition100g.fat * 10) / 10 }}g</span>
            <div class="flex gap-1 ml-auto">
              <UButton
                size="xs"
                variant="ghost"
                color="neutral"
                icon="i-lucide-pencil"
                :to="`/recipes/${recipe.id}`"
              />
              <UButton
                size="xs"
                variant="ghost"
                color="error"
                icon="i-lucide-trash-2"
                :loading="deleting === recipe.id"
                @click.prevent="deleteRecipe(recipe.id)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
