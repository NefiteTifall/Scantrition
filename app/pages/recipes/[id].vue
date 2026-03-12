<script setup lang="ts">
import type { RecipeIngredient as PickedIngredient } from '~/components/RecipeIngredientPicker.vue'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const toast = useToast()

interface RecipeIngredient {
  id: string
  productId: string
  quantityGrams: number
  order: number
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
  servingSize: string | null
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

const { data: recipe, error, refresh } = await useFetch<Recipe>(`/api/recipes/${route.params.id}`)

if (error.value) {
  await navigateTo('/recipes')
}

const isEditing = ref(false)
const saving = ref(false)
const deleting = ref(false)

// Edit form state (mirrors API data)
const editName = ref(recipe.value?.name ?? '')
const editDescription = ref(recipe.value?.description ?? '')
const editIngredients = ref<Array<{ productId: string, name: string, brand: string | null, image: string | null, calories: number, protein: number, carbs: number, fat: number, quantityGrams: number }>>(
  (recipe.value?.ingredients ?? []).map(ing => ({
    productId: ing.productId,
    name: ing.name,
    brand: ing.brand,
    image: ing.image,
    calories: ing.calories,
    protein: ing.protein,
    carbs: ing.carbs,
    fat: ing.fat,
    quantityGrams: ing.quantityGrams
  }))
)

function startEditing() {
  editName.value = recipe.value?.name ?? ''
  editDescription.value = recipe.value?.description ?? ''
  editIngredients.value = (recipe.value?.ingredients ?? []).map(ing => ({
    productId: ing.productId,
    name: ing.name,
    brand: ing.brand,
    image: ing.image,
    calories: ing.calories,
    protein: ing.protein,
    carbs: ing.carbs,
    fat: ing.fat,
    quantityGrams: ing.quantityGrams
  }))
  isEditing.value = true
}

function cancelEditing() {
  isEditing.value = false
}

function addIngredient(ing: PickedIngredient) {
  const existing = editIngredients.value.find(i => i.productId === ing.productId)
  if (existing) {
    existing.quantityGrams += ing.quantityGrams
  } else {
    editIngredients.value.push({ ...ing })
  }
}

function removeIngredient(idx: number) {
  editIngredients.value.splice(idx, 1)
}

const previewNutrition = computed(() => {
  const ings = isEditing.value ? editIngredients.value : (recipe.value?.ingredients ?? [])
  const total = ings.reduce((s, ing) => s + ing.quantityGrams, 0)
  if (total === 0) return recipe.value?.nutrition100g ?? null
  const factor = 100 / total
  return {
    calories: Math.round(ings.reduce((s, ing) => s + ing.calories * ing.quantityGrams / 100, 0) * factor),
    protein: Math.round(ings.reduce((s, ing) => s + ing.protein * ing.quantityGrams / 100, 0) * factor * 10) / 10,
    carbs: Math.round(ings.reduce((s, ing) => s + ing.carbs * ing.quantityGrams / 100, 0) * factor * 10) / 10,
    fat: Math.round(ings.reduce((s, ing) => s + ing.fat * ing.quantityGrams / 100, 0) * factor * 10) / 10
  }
})

async function saveChanges() {
  saving.value = true
  try {
    await $fetch(`/api/recipes/${route.params.id}`, {
      method: 'PUT',
      body: {
        name: editName.value.trim(),
        description: editDescription.value.trim() || null,
        ingredients: editIngredients.value.map(ing => ({
          productId: ing.productId,
          quantityGrams: ing.quantityGrams
        }))
      }
    })
    toast.add({ title: t('recipes.saved'), color: 'success', icon: 'i-lucide-check-circle' })
    isEditing.value = false
    await refresh()
  } catch {
    toast.add({ title: t('common.error'), color: 'error' })
  } finally {
    saving.value = false
  }
}

async function deleteRecipe() {
  deleting.value = true
  try {
    await $fetch(`/api/recipes/${route.params.id}`, { method: 'DELETE' })
    toast.add({ title: t('recipes.deleted'), color: 'success' })
    await router.push('/recipes')
  } catch {
    toast.add({ title: t('common.error'), color: 'error' })
  } finally {
    deleting.value = false
  }
}

// Add to journal (use a portion of this recipe)
const portionGrams = ref(100)
const showAddToJournal = ref(false)

const portionNutrition = computed(() => {
  const n = recipe.value?.nutrition100g
  if (!n) return null
  const m = portionGrams.value / 100
  return {
    calories: Math.round(n.calories * m),
    protein: Math.round(n.protein * m * 10) / 10,
    carbs: Math.round(n.carbs * m * 10) / 10,
    fat: Math.round(n.fat * m * 10) / 10,
    fiber: Math.round(n.fiber * m * 10) / 10,
    sugar: Math.round(n.sugar * m * 10) / 10,
    saturatedFat: Math.round(n.saturatedFat * m * 10) / 10,
    salt: Math.round(n.salt * m * 100) / 100
  }
})

const mealCategories = ['breakfast', 'lunch', 'snack', 'dinner'] as const
const selectedCategory = ref<typeof mealCategories[number]>('lunch')
const addingToJournal = ref(false)

async function addToJournal() {
  if (!recipe.value || !portionNutrition.value) return
  addingToJournal.value = true
  const n = portionNutrition.value
  try {
    await $fetch('/api/meals', {
      method: 'POST',
      body: {
        date: new Date().toISOString().split('T')[0],
        type: 'recipe',
        mealCategory: selectedCategory.value,
        items: [{
          recipeId: recipe.value.id,
          name: recipe.value.name,
          quantity: `${portionGrams.value}g`,
          calories: n.calories,
          protein: n.protein,
          carbs: n.carbs,
          fat: n.fat,
          fiber: n.fiber,
          sugar: n.sugar,
          saturatedFat: n.saturatedFat,
          salt: n.salt
        }],
        totalCalories: n.calories,
        totalProtein: n.protein,
        totalCarbs: n.carbs,
        totalFat: n.fat,
        totalFiber: n.fiber,
        totalSugar: n.sugar,
        totalSaturatedFat: n.saturatedFat,
        totalSalt: n.salt,
        confidence: 1
      }
    })
    toast.add({ title: t('add.mealAdded'), color: 'success', icon: 'i-lucide-check-circle' })
    showAddToJournal.value = false
    await router.push('/dashboard')
  } catch {
    toast.add({ title: t('common.error'), color: 'error' })
  } finally {
    addingToJournal.value = false
  }
}
</script>

<template>
  <div
    v-if="recipe"
    class="max-w-xl mx-auto pb-8"
  >
    <!-- Header -->
    <div class="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 bg-[var(--ui-bg)] border-b border-[var(--ui-border)]">
      <button
        class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[var(--ui-bg-elevated)] transition-colors shrink-0"
        @click="isEditing ? cancelEditing() : router.back()"
      >
        <UIcon
          :name="isEditing ? 'i-lucide-x' : 'i-lucide-arrow-left'"
          class="w-5 h-5"
        />
      </button>
      <h1 class="font-bold text-base flex-1 truncate">
        {{ isEditing ? editName || t('recipes.edit') : recipe.name }}
      </h1>
      <div class="flex items-center gap-1.5">
        <UButton
          v-if="isEditing"
          :loading="saving"
          icon="i-lucide-check"
          size="sm"
          @click="saveChanges"
        >
          {{ t('common.save') }}
        </UButton>
        <template v-else>
          <UButton
            size="sm"
            variant="outline"
            color="neutral"
            icon="i-lucide-pencil"
            @click="startEditing"
          />
          <UButton
            size="sm"
            variant="ghost"
            color="error"
            icon="i-lucide-trash-2"
            :loading="deleting"
            @click="deleteRecipe"
          />
        </template>
      </div>
    </div>

    <div class="px-4 pt-4 space-y-4">
      <!-- Edit form: name & description -->
      <div
        v-if="isEditing"
        class="space-y-3"
      >
        <UFormField
          :label="t('recipes.name')"
          name="name"
        >
          <UInput
            v-model="editName"
            :placeholder="t('recipes.namePlaceholder')"
            class="w-full"
          />
        </UFormField>
        <UFormField
          :label="t('recipes.description')"
          name="description"
        >
          <UInput
            v-model="editDescription"
            :placeholder="t('recipes.descriptionPlaceholder')"
            class="w-full"
          />
        </UFormField>
      </div>

      <!-- View mode: description -->
      <p
        v-else-if="recipe.description"
        class="text-sm text-[var(--ui-text-muted)]"
      >
        {{ recipe.description }}
      </p>

      <!-- Nutrition per 100g -->
      <div
        v-if="previewNutrition"
        class="rounded-2xl bg-[var(--ui-bg-elevated)] p-4"
      >
        <p class="text-xs text-[var(--ui-text-muted)] mb-2">
          {{ t('nutrition.per100g') }} · {{ recipe.totalWeightGrams }}g total
        </p>
        <div class="grid grid-cols-4 gap-2 text-center">
          <div>
            <p class="text-xl font-bold text-primary">
              {{ previewNutrition.calories }}
            </p>
            <p class="text-xs text-[var(--ui-text-muted)]">
              kcal
            </p>
          </div>
          <div>
            <p class="text-base font-semibold">
              {{ previewNutrition.protein }}g
            </p>
            <p class="text-xs text-[var(--ui-text-muted)]">
              {{ t('dashboard.protein') }}
            </p>
          </div>
          <div>
            <p class="text-base font-semibold">
              {{ previewNutrition.carbs }}g
            </p>
            <p class="text-xs text-[var(--ui-text-muted)]">
              {{ t('dashboard.carbs') }}
            </p>
          </div>
          <div>
            <p class="text-base font-semibold">
              {{ previewNutrition.fat }}g
            </p>
            <p class="text-xs text-[var(--ui-text-muted)]">
              {{ t('dashboard.fat') }}
            </p>
          </div>
        </div>
        <div
          v-if="recipe.nutrition100g.fiber || recipe.nutrition100g.sugar || recipe.nutrition100g.salt"
          class="flex gap-4 mt-3 pt-3 border-t border-[var(--ui-border)] text-xs text-[var(--ui-text-muted)] justify-center"
        >
          <span v-if="recipe.nutrition100g.fiber">{{ t('nutrition.fiber') }} {{ recipe.nutrition100g.fiber }}g</span>
          <span v-if="recipe.nutrition100g.sugar">{{ t('nutrition.sugar') }} {{ recipe.nutrition100g.sugar }}g</span>
          <span v-if="recipe.nutrition100g.salt">{{ t('nutrition.salt') }} {{ recipe.nutrition100g.salt }}g</span>
        </div>
      </div>

      <!-- Add to journal button (view mode only) -->
      <UButton
        v-if="!isEditing"
        block
        icon="i-lucide-plus"
        @click="showAddToJournal = true"
      >
        {{ t('recipes.useInMeal') }}
      </UButton>

      <!-- Ingredients section -->
      <div>
        <h2 class="font-semibold text-sm mb-3">
          {{ t('recipes.ingredients') }} ({{ isEditing ? editIngredients.length : recipe.ingredients.length }})
        </h2>

        <!-- Ingredient picker (edit mode only) -->
        <RecipeIngredientPicker
          v-if="isEditing"
          class="mb-3"
          @add="addIngredient"
        />

        <!-- Edit mode ingredient list -->
        <div
          v-if="isEditing"
          class="space-y-2"
        >
          <div
            v-for="(ing, idx) in editIngredients"
            :key="ing.productId"
            class="flex items-center gap-3 p-3 rounded-xl border border-[var(--ui-border)]"
          >
            <img
              v-if="ing.image"
              :src="ing.image"
              :alt="ing.name"
              class="w-10 h-10 object-contain rounded-lg shrink-0"
            >
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

        <!-- View mode ingredient list -->
        <div
          v-else
          class="rounded-2xl border border-[var(--ui-border)] overflow-hidden divide-y divide-[var(--ui-border)]"
        >
          <div
            v-for="ing in recipe.ingredients"
            :key="ing.id"
            class="flex items-center gap-3 px-4 py-3"
          >
            <img
              v-if="ing.image"
              :src="ing.image"
              :alt="ing.name"
              class="w-10 h-10 object-contain rounded-lg shrink-0"
            >
            <div
              v-else
              class="w-10 h-10 rounded-lg bg-[var(--ui-bg-elevated)] shrink-0"
            />
            <div class="flex-1 min-w-0">
              <NuxtLink
                :to="`/products/${ing.productId}`"
                class="text-sm font-medium truncate hover:underline"
              >
                {{ ing.name }}
              </NuxtLink>
              <p
                v-if="ing.brand"
                class="text-xs text-[var(--ui-text-muted)]"
              >
                {{ ing.brand }}
              </p>
            </div>
            <div class="text-right shrink-0">
              <p class="text-sm font-semibold">
                {{ ing.quantityGrams }}g
              </p>
              <p class="text-xs text-[var(--ui-text-muted)]">
                {{ Math.round(ing.calories * ing.quantityGrams / 100) }} kcal
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add to journal modal -->
    <UModal
      :open="showAddToJournal"
      :title="t('recipes.useInMeal')"
      @update:open="(v) => { if (!v) showAddToJournal = false }"
    >
      <template #body>
        <div class="space-y-4">
          <!-- Category picker -->
          <div>
            <p class="text-sm font-medium mb-2">
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

          <!-- Portion -->
          <div class="flex items-center gap-3">
            <span class="text-sm text-[var(--ui-text-muted)] shrink-0">
              {{ t('recipes.portionGrams') }}
            </span>
            <UInput
              v-model.number="portionGrams"
              type="number"
              min="1"
              max="5000"
              step="50"
              size="sm"
              class="w-24"
            />
            <span class="text-sm text-[var(--ui-text-muted)]">g</span>
          </div>

          <!-- Preview -->
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
            @click="showAddToJournal = false"
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
