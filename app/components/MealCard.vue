<script setup lang="ts">
import type { MealItem } from '~/types/nutrition'

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
  totalFiber?: number | null
  totalSugar?: number | null
  totalSaturatedFat?: number | null
  totalSalt?: number | null
  nutriScore?: 'A' | 'B' | 'C' | 'D' | 'E' | null
  healthScore?: number | null
  healthLabel?: 'excellent' | 'good' | 'limit' | 'avoid' | null
  confidence: number | null
  source: string | null
  createdAt: string
}

const props = defineProps<{ meal: Meal, borderless?: boolean }>()
const emit = defineEmits<{ delete: [id: string], updated: [id: string] }>()

const { t } = useI18n()
const toast = useToast()

const mealCategories: Array<{ key: MealCategory, icon: string }> = [
  { key: 'breakfast', icon: 'i-lucide-sunrise' },
  { key: 'lunch', icon: 'i-lucide-sun' },
  { key: 'snack', icon: 'i-lucide-apple' },
  { key: 'dinner', icon: 'i-lucide-moon' }
]

const itemNames = computed(() => props.meal.items.map(i => i.name).join(', '))

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const macros = computed(() => [
  {
    key: 'protein',
    label: t('dashboard.protein'),
    value: props.meal.totalProtein,
    max: 150,
    color: 'bg-blue-400'
  },
  {
    key: 'carbs',
    label: t('dashboard.carbs'),
    value: props.meal.totalCarbs,
    max: 250,
    color: 'bg-amber-400'
  },
  {
    key: 'fat',
    label: t('dashboard.fat'),
    value: props.meal.totalFat,
    max: 70,
    color: 'bg-purple-400'
  }
])

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
  <div class="px-4 py-3">
    <!-- Header: name + kcal + actions -->
    <div class="flex items-start justify-between gap-2 mb-3">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <p class="font-semibold text-sm leading-snug">
            {{ itemNames }}
          </p>
          <span
            v-if="meal.nutriScore"
            class="text-[10px] font-bold px-1.5 py-0.5 rounded text-white shrink-0"
            :class="{
              'bg-green-500': meal.nutriScore === 'A',
              'bg-lime-500': meal.nutriScore === 'B',
              'bg-yellow-500': meal.nutriScore === 'C',
              'bg-orange-500': meal.nutriScore === 'D',
              'bg-red-500': meal.nutriScore === 'E'
            }"
          >{{ meal.nutriScore }}</span>
          <span
            v-if="meal.healthLabel"
            class="text-[10px] font-bold px-1.5 py-0.5 rounded text-white shrink-0"
            :class="{
              'bg-green-500': meal.healthLabel === 'excellent',
              'bg-lime-500': meal.healthLabel === 'good',
              'bg-orange-500': meal.healthLabel === 'limit',
              'bg-red-500': meal.healthLabel === 'avoid'
            }"
          >{{ t('healthLabel.' + meal.healthLabel) }}{{ meal.healthScore != null ? ` (${meal.healthScore})` : '' }}</span>
        </div>
        <p class="text-xs text-[var(--ui-text-muted)] mt-0.5">
          {{ formatTime(meal.createdAt) }}
        </p>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <span class="font-bold text-primary">{{ Math.round(meal.totalCalories) }} kcal</span>
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

    <!-- Macro rows -->
    <div class="space-y-2">
      <div
        v-for="macro in macros"
        :key="macro.key"
      >
        <div class="flex justify-between text-xs mb-1">
          <span class="text-[var(--ui-text-muted)]">{{ macro.label }}</span>
          <span class="font-medium">{{ Math.round(macro.value) }}g</span>
        </div>
        <div class="h-1.5 rounded-full bg-[var(--ui-bg-elevated)] overflow-hidden">
          <div
            class="h-full rounded-full transition-all"
            :class="macro.color"
            :style="`width: ${Math.min(macro.value / macro.max * 100, 100)}%`"
          />
        </div>
      </div>
    </div>

    <!-- Extended details -->
    <div
      v-if="meal.totalFiber || meal.totalSugar || meal.totalSaturatedFat || meal.totalSalt"
      class="flex flex-wrap gap-x-3 gap-y-0.5 mt-2 pt-2 border-t border-[var(--ui-border)]"
    >
      <span
        v-if="meal.totalFiber"
        class="text-xs text-[var(--ui-text-muted)]"
      >Fibres {{ Math.round((meal.totalFiber ?? 0) * 10) / 10 }}g</span>
      <span
        v-if="meal.totalSugar"
        class="text-xs text-[var(--ui-text-muted)]"
      >Sucres {{ Math.round((meal.totalSugar ?? 0) * 10) / 10 }}g</span>
      <span
        v-if="meal.totalSaturatedFat"
        class="text-xs text-[var(--ui-text-muted)]"
      >AG sat. {{ Math.round((meal.totalSaturatedFat ?? 0) * 10) / 10 }}g</span>
      <span
        v-if="meal.totalSalt"
        class="text-xs text-[var(--ui-text-muted)]"
      >Sel {{ Math.round((meal.totalSalt ?? 0) * 10) / 10 }}g</span>
    </div>
  </div>

  <!-- Edit modal -->
  <UModal
    v-model:open="showEdit"
    :title="t('edit.meal')"
  >
    <template #body>
      <div class="space-y-3">
        <div>
          <p class="text-sm font-medium mb-1.5">
            {{ t('mealCategory.label') }}
          </p>
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
              <UIcon
                :name="cat.icon"
                class="w-4 h-4"
              />
              {{ t(`mealCategory.${cat.key}`) }}
            </button>
          </div>
        </div>
        <UFormField
          :label="t('edit.calories')"
          name="calories"
        >
          <UInput
            v-model.number="editForm.totalCalories"
            type="number"
            min="0"
            class="w-full"
          />
        </UFormField>
        <UFormField
          :label="t('edit.protein')"
          name="protein"
        >
          <UInput
            v-model.number="editForm.totalProtein"
            type="number"
            min="0"
            step="0.1"
            class="w-full"
          />
        </UFormField>
        <UFormField
          :label="t('edit.carbs')"
          name="carbs"
        >
          <UInput
            v-model.number="editForm.totalCarbs"
            type="number"
            min="0"
            step="0.1"
            class="w-full"
          />
        </UFormField>
        <UFormField
          :label="t('edit.fat')"
          name="fat"
        >
          <UInput
            v-model.number="editForm.totalFat"
            type="number"
            min="0"
            step="0.1"
            class="w-full"
          />
        </UFormField>
      </div>
    </template>
    <template #footer>
      <div class="flex gap-2 w-full">
        <UButton
          variant="outline"
          color="neutral"
          class="flex-1"
          @click="showEdit = false"
        >
          {{ t('common.cancel') }}
        </UButton>
        <UButton
          class="flex-1"
          :loading="saving"
          @click="saveEdit"
        >
          {{ t('common.save') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
