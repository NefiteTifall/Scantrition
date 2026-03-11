<script setup lang="ts">
import type { MealItem } from '~/server/db/schema'

type MealCategory = 'breakfast' | 'lunch' | 'snack' | 'dinner'

interface Meal {
  id: string
  type: 'text' | 'photo' | 'barcode' | 'search' | 'favorite'
  mealCategory: MealCategory | null
  items: MealItem[]
  totalCalories: number
  totalProtein: number
  totalCarbs: number
  totalFat: number
  confidence: number | null
  source: string | null
  createdAt: string
}

const props = defineProps<{ meal: Meal; borderless?: boolean }>()
const emit = defineEmits<{ delete: [id: string]; updated: [id: string] }>()

const { t } = useI18n()
const toast = useToast()

const typeIcon: Record<string, string> = {
  text: 'i-lucide-message-square',
  photo: 'i-lucide-camera',
  barcode: 'i-lucide-scan-barcode',
  search: 'i-lucide-search',
  favorite: 'i-lucide-heart'
}

const categoryIcon: Record<string, string> = {
  breakfast: 'i-lucide-sunrise',
  lunch: 'i-lucide-sun',
  snack: 'i-lucide-apple',
  dinner: 'i-lucide-moon'
}

const mealCategories: Array<{ key: MealCategory; icon: string }> = [
  { key: 'breakfast', icon: 'i-lucide-sunrise' },
  { key: 'lunch', icon: 'i-lucide-sun' },
  { key: 'snack', icon: 'i-lucide-apple' },
  { key: 'dinner', icon: 'i-lucide-moon' }
]

const itemNames = computed(() => props.meal.items.map(i => i.name).join(', '))

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// Edit modal
const showEdit = ref(false)
const editForm = reactive({
  totalCalories: props.meal.totalCalories,
  totalProtein: props.meal.totalProtein,
  totalCarbs: props.meal.totalCarbs,
  totalFat: props.meal.totalFat,
  mealCategory: props.meal.mealCategory as MealCategory | null
})
const saving = ref(false)

function openEdit() {
  editForm.totalCalories = Math.round(props.meal.totalCalories)
  editForm.totalProtein = Math.round(props.meal.totalProtein * 10) / 10
  editForm.totalCarbs = Math.round(props.meal.totalCarbs * 10) / 10
  editForm.totalFat = Math.round(props.meal.totalFat * 10) / 10
  editForm.mealCategory = props.meal.mealCategory
  showEdit.value = true
}

async function saveEdit() {
  saving.value = true
  try {
    await $fetch(`/api/meals/${props.meal.id}`, {
      method: 'PUT',
      body: editForm
    })
    toast.add({ title: t('edit.saved'), color: 'success', icon: 'i-lucide-check-circle' })
    showEdit.value = false
    emit('updated', props.meal.id)
  } catch {
    toast.add({ title: t('common.error'), color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UCard :ui="borderless ? { body: 'px-4 py-3', root: 'rounded-none shadow-none border-0 ring-0' } : undefined">
    <div class="flex items-start gap-3">
      <div class="mt-0.5 p-2 rounded-lg bg-[var(--ui-border)] shrink-0">
        <UIcon :name="typeIcon[meal.type] ?? 'i-lucide-utensils'" class="w-4 h-4 text-[var(--ui-text-muted)]" />
      </div>

      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-1.5">
          <p class="font-medium truncate">{{ itemNames }}</p>
          <UBadge
            v-if="meal.mealCategory"
            color="neutral"
            variant="subtle"
            size="xs"
            class="shrink-0"
          >
            <UIcon :name="categoryIcon[meal.mealCategory]" class="w-3 h-3 mr-0.5" />
            {{ t(`mealCategory.${meal.mealCategory}`) }}
          </UBadge>
        </div>
        <p class="text-xs text-[var(--ui-text-muted)] mt-0.5">
          {{ formatTime(meal.createdAt) }}
          <template v-if="meal.confidence && meal.confidence < 1">
            · {{ Math.round(meal.confidence * 100) }}% {{ t('add.confidence') }}
          </template>
        </p>
        <div class="flex items-center gap-3 mt-2 text-xs text-[var(--ui-text-muted)]">
          <span>P {{ Math.round(meal.totalProtein) }}g</span>
          <span>G {{ Math.round(meal.totalCarbs) }}g</span>
          <span>L {{ Math.round(meal.totalFat) }}g</span>
        </div>
      </div>

      <div class="flex flex-col items-end gap-1 shrink-0">
        <span class="font-bold text-primary">{{ Math.round(meal.totalCalories) }} kcal</span>
        <div class="flex gap-1">
          <UButton
            icon="i-lucide-pencil"
            variant="ghost"
            color="neutral"
            size="xs"
            :aria-label="t('common.edit')"
            @click="openEdit"
          />
          <UButton
            icon="i-lucide-trash-2"
            variant="ghost"
            color="error"
            size="xs"
            :aria-label="t('common.delete')"
            @click="emit('delete', meal.id)"
          />
        </div>
      </div>
    </div>
  </UCard>

  <!-- Edit modal -->
  <UModal v-model:open="showEdit" :title="t('edit.meal')">
    <template #body>
      <div class="space-y-3">
        <div>
          <p class="text-sm font-medium mb-1.5">{{ t('mealCategory.label') }}</p>
          <div class="grid grid-cols-4 gap-1 bg-[var(--ui-border)] rounded-xl p-1">
            <button
              v-for="cat in mealCategories"
              :key="cat.key"
              class="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg text-xs font-medium transition-all"
              :class="editForm.mealCategory === cat.key
                ? 'bg-[var(--ui-bg)] shadow text-primary'
                : 'text-[var(--ui-text-muted)] hover:text-[var(--ui-text)]'"
              @click="editForm.mealCategory = cat.key"
            >
              <UIcon :name="cat.icon" class="w-4 h-4" />
              {{ t(`mealCategory.${cat.key}`) }}
            </button>
          </div>
        </div>
        <UFormField :label="t('edit.calories')" name="calories">
          <UInput v-model.number="editForm.totalCalories" type="number" min="0" class="w-full" />
        </UFormField>
        <UFormField :label="t('edit.protein')" name="protein">
          <UInput v-model.number="editForm.totalProtein" type="number" min="0" step="0.1" class="w-full" />
        </UFormField>
        <UFormField :label="t('edit.carbs')" name="carbs">
          <UInput v-model.number="editForm.totalCarbs" type="number" min="0" step="0.1" class="w-full" />
        </UFormField>
        <UFormField :label="t('edit.fat')" name="fat">
          <UInput v-model.number="editForm.totalFat" type="number" min="0" step="0.1" class="w-full" />
        </UFormField>
      </div>
    </template>
    <template #footer>
      <div class="flex gap-2 w-full">
        <UButton variant="outline" color="neutral" class="flex-1" @click="showEdit = false">
          {{ t('common.cancel') }}
        </UButton>
        <UButton class="flex-1" :loading="saving" @click="saveEdit">
          {{ t('common.save') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
