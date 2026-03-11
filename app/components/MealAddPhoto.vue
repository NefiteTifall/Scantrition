<script setup lang="ts">
import type { NutritionResult } from '~/server/utils/ai'

const emit = defineEmits<{ result: [result: NutritionResult] }>()
const { t } = useI18n()

const fileInput = ref<HTMLInputElement>()
const preview = ref<string | null>(null)
const imageBase64 = ref<string | null>(null)
const imageMime = ref<string>('image/jpeg')
const loading = ref(false)
const result = ref<NutritionResult | null>(null)
const error = ref('')

function triggerUpload() {
  fileInput.value?.click()
}

function handleFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  imageMime.value = file.type
  result.value = null
  error.value = ''

  const reader = new FileReader()
  reader.onload = (e) => {
    const dataUrl = e.target?.result as string
    preview.value = dataUrl
    imageBase64.value = dataUrl.split(',')[1]
  }
  reader.readAsDataURL(file)
}

async function analyze() {
  if (!imageBase64.value) return
  loading.value = true
  error.value = ''
  result.value = null

  try {
    result.value = await $fetch<NutritionResult>('/api/meals/analyze-image', {
      method: 'POST',
      body: { image: imageBase64.value, mimeType: imageMime.value }
    })
  } catch (err: unknown) {
    const fe = err as { data?: { message?: string } }
    error.value = fe.data?.message || (err instanceof Error ? err.message : t('common.error'))
  } finally {
    loading.value = false
  }
}

function reset() {
  preview.value = null
  imageBase64.value = null
  result.value = null
  error.value = ''
}
</script>

<template>
  <div class="space-y-3">
    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      capture="environment"
      class="hidden"
      @change="handleFile"
    >

    <!-- Preview -->
    <div
      v-if="preview"
      class="relative rounded-xl overflow-hidden bg-[var(--ui-border)]"
    >
      <img :src="preview" alt="meal photo" class="w-full max-h-72 object-contain">
      <UButton
        icon="i-lucide-x"
        variant="solid"
        color="neutral"
        size="xs"
        class="absolute top-2 right-2"
        @click="reset"
      />
    </div>

    <!-- Upload zone -->
    <div
      v-else
      class="border-2 border-dashed border-[var(--ui-border)] rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer hover:border-primary transition-colors"
      @click="triggerUpload"
    >
      <UIcon name="i-lucide-camera" class="w-10 h-10 text-[var(--ui-text-muted)]" />
      <div class="text-center">
        <p class="font-medium">{{ t('add.takePhoto') }}</p>
        <p class="text-sm text-[var(--ui-text-muted)]">{{ t('add.orUpload') }}</p>
      </div>
    </div>

    <div v-if="preview" class="flex gap-2">
      <UButton
        variant="outline"
        color="neutral"
        icon="i-lucide-image"
        @click="triggerUpload"
      >
        {{ t('add.changePhoto') }}
      </UButton>
      <UButton
        class="flex-1"
        :loading="loading"
        icon="i-lucide-sparkles"
        @click="analyze"
      >
        {{ loading ? t('add.analyzing') : t('add.analyze') }}
      </UButton>
    </div>

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
      @add="emit('result', $event)"
    />
  </div>
</template>
