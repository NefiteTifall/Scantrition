<script setup lang="ts">
import type { NutritionResult } from '~/server/utils/ai'

const emit = defineEmits<{ result: [result: NutritionResult] }>()
const { t } = useI18n()

const videoRef = ref<HTMLVideoElement>()
const scanning = ref(false)
const scannedCode = ref<string | null>(null)
const result = ref<(NutritionResult & { productName?: string, brand?: string, image?: string }) | null>(null)
const error = ref('')
const loading = ref(false)

let stream: MediaStream | null = null
let animFrameId: number | null = null
let zxingControls: { stop: () => void } | null = null

async function startScan() {
  error.value = ''
  scanning.value = true
  await nextTick()

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
    })
    videoRef.value!.srcObject = stream
    await videoRef.value!.play()

    if ('BarcodeDetector' in window) {
      await startNativeDetection()
    } else {
      await startZxingDetection()
    }
  } catch (err: unknown) {
    scanning.value = false
    stopStream()
    error.value = err instanceof Error ? err.message : t('add.barcodePermission')
  }
}

async function startNativeDetection() {
  // @ts-expect-error BarcodeDetector not yet in TS types
  const detector = new BarcodeDetector({
    formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code', 'upc_a', 'upc_e', 'data_matrix']
  })

  async function tick() {
    if (!scanning.value || !videoRef.value) return
    try {
      const barcodes = await detector.detect(videoRef.value)
      if (barcodes.length > 0) {
        await handleCode(barcodes[0].rawValue)
        return
      }
    } catch { /* frame error, continue */ }
    animFrameId = requestAnimationFrame(tick)
  }

  animFrameId = requestAnimationFrame(tick)
}

async function startZxingDetection() {
  const { BrowserMultiFormatReader } = await import('@zxing/browser')
  const reader = new BrowserMultiFormatReader()

  const controls = await reader.decodeFromVideoElement(videoRef.value!, async (scanResult) => {
    if (scanResult) {
      await handleCode(scanResult.getText())
    }
  })
  zxingControls = controls
}

async function handleCode(code: string) {
  stopStream()
  scanning.value = false
  scannedCode.value = code
  await lookup(code)
}

function stopStream() {
  if (animFrameId) {
    cancelAnimationFrame(animFrameId)
    animFrameId = null
  }
  zxingControls?.stop()
  zxingControls = null
  stream?.getTracks().forEach(t => t.stop())
  stream = null
}

async function lookup(code: string) {
  loading.value = true
  error.value = ''
  result.value = null
  try {
    result.value = await $fetch(`/api/meals/barcode/${code}`)
  } catch {
    error.value = t('add.barcodeNotFound')
  } finally {
    loading.value = false
  }
}

function reset() {
  stopStream()
  scanning.value = false
  scannedCode.value = null
  result.value = null
  error.value = ''
}

onUnmounted(stopStream)
</script>

<template>
  <div class="space-y-3">
    <!-- Video preview -->
    <div
      v-if="scanning"
      class="relative rounded-xl overflow-hidden bg-black"
    >
      <video
        ref="videoRef"
        class="w-full max-h-72 object-cover"
        muted
        playsinline
      />
      <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div class="w-48 h-32 border-2 border-primary rounded-lg opacity-80" />
      </div>
      <div class="absolute bottom-3 left-0 right-0 text-center">
        <UBadge
          color="primary"
          variant="solid"
        >
          {{ t('add.barcodeScanning') }}
        </UBadge>
      </div>
    </div>

    <!-- Start scan -->
    <div
      v-if="!scanning && !result"
      class="border-2 border-dashed border-[var(--ui-border)] rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer hover:border-primary transition-colors"
      @click="startScan"
    >
      <UIcon
        name="i-lucide-scan-barcode"
        class="w-10 h-10 text-[var(--ui-text-muted)]"
      />
      <div class="text-center">
        <p class="font-medium">
          {{ t('add.scanBarcode') }}
        </p>
        <p class="text-sm text-[var(--ui-text-muted)]">
          {{ t('add.barcodePermission') }}
        </p>
      </div>
    </div>

    <UButton
      v-if="scanning"
      block
      variant="outline"
      color="neutral"
      icon="i-lucide-x"
      @click="reset"
    >
      {{ t('common.cancel') }}
    </UButton>

    <UButton
      v-if="result || (error && scannedCode)"
      block
      variant="outline"
      color="neutral"
      icon="i-lucide-scan-barcode"
      @click="reset"
    >
      {{ t('add.scanAgain') }}
    </UButton>

    <div
      v-if="loading"
      class="text-center py-4 text-[var(--ui-text-muted)]"
    >
      <UIcon
        name="i-lucide-loader-circle"
        class="w-6 h-6 animate-spin mx-auto mb-1"
      />
      {{ t('common.loading') }}
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
