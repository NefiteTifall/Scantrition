<script setup lang="ts">
import type { NutritionResult } from '~/server/utils/ai'

const emit = defineEmits<{ result: [result: NutritionResult] }>()
const { t } = useI18n()

const description = ref('')
const loading = ref(false)
const result = ref<NutritionResult | null>(null)
const error = ref('')
const saving = ref(false)

async function analyze() {
  if (!description.value.trim()) return
  loading.value = true
  error.value = ''
  result.value = null

  try {
    result.value = await $fetch<NutritionResult>('/api/meals/analyze-text', {
      method: 'POST',
      body: { description: description.value }
    })
  } catch (err: unknown) {
    const fe = err as { data?: { message?: string } }
    error.value = fe.data?.message || (err instanceof Error ? err.message : t('common.error'))
  } finally {
    loading.value = false
  }
}

function onAdd(r: NutritionResult) {
  emit('result', r)
}
</script>

<template>
  <div class="space-y-3">
    <UTextarea
      v-model="description"
      :placeholder="t('add.textPlaceholder')"
      :rows="4"
      :disabled="loading"
      autoresize
      class="w-full"
      @keydown.ctrl.enter="analyze"
    />

    <UButton
      block
      :loading="loading"
      :disabled="!description.trim()"
      icon="i-lucide-sparkles"
      @click="analyze"
    >
      {{ loading ? t('add.analyzing') : t('add.analyze') }}
    </UButton>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      :description="error"
      icon="i-lucide-alert-circle"
    />

    <NutritionResult
      v-if="result"
      :result="result"
      :loading="saving"
      @add="onAdd"
    />
  </div>
</template>
