<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'

const { t, locale, locales, setLocale } = useI18n()
const toast = useToast()
const route = useRoute()
const router = useRouter()

const isSetupMode = computed(() => route.query.setup === 'true')
const isAIConfigured = useState<boolean | null>('ai-configured')

// Goals
const { data: goalsData } = await useFetch('/api/goals')
const goals = reactive({
  calories: goalsData.value?.calories ?? 2000,
  protein: goalsData.value?.protein ?? 150,
  carbs: goalsData.value?.carbs ?? 250,
  fat: goalsData.value?.fat ?? 70
})
const savingGoals = ref(false)

async function saveGoals(_event: FormSubmitEvent<typeof goals>) {
  savingGoals.value = true
  try {
    await $fetch('/api/goals', { method: 'PUT', body: goals })
    toast.add({ title: t('settings.saved'), color: 'success', icon: 'i-lucide-check-circle' })
  } catch {
    toast.add({ title: t('common.error'), color: 'error' })
  } finally {
    savingGoals.value = false
  }
}

// AI settings
const { data: aiData } = await useFetch('/api/settings/ai')
const ai = reactive({
  provider: aiData.value?.provider ?? 'gemini',
  model: aiData.value?.model ?? ''
})
const hasApiKey = ref(aiData.value?.hasApiKey ?? false)
const apiKey = ref('')
const savingAI = ref(false)
const validating = ref(false)
const validationResult = ref<{ valid: boolean, error?: string } | null>(null)

const providers = [
  { label: 'Google Gemini', value: 'gemini' },
  { label: 'OpenAI', value: 'openai' },
  { label: 'Anthropic', value: 'anthropic' },
  { label: 'OpenRouter', value: 'openrouter' }
]

const apiKeyLinks: Record<string, { url: string, label: string, quotaUrl?: string }> = {
  gemini: { url: 'https://aistudio.google.com/app/apikey', label: 'Google AI Studio', quotaUrl: 'https://aistudio.google.com/rate-limit' },
  openai: { url: 'https://platform.openai.com/api-keys', label: 'OpenAI Platform' },
  anthropic: { url: 'https://console.anthropic.com/settings/keys', label: 'Anthropic Console' },
  openrouter: { url: 'https://openrouter.ai/settings/keys', label: 'OpenRouter' }
}

const currentApiKeyLink = computed(() => apiKeyLinks[ai.provider] ?? null)

const GEMINI_FREE_MODELS = new Map<string, { rpm: number, rpd: number }>([
  ['gemini-3.1-flash-lite-preview', { rpm: 15, rpd: 500 }],
  ['gemini-2.5-flash-lite', { rpm: 10, rpd: 20 }],
  ['gemini-2.5-flash', { rpm: 5, rpd: 20 }],
  ['gemini-3-flash-preview', { rpm: 5, rpd: 20 }]
])

// Models
interface ModelItem { label: string, value: string, quota?: { rpm: number, rpd: number } }
const models = ref<ModelItem[]>([])
const modelsLoading = ref(false)

async function fetchModels(provider: string) {
  modelsLoading.value = true
  models.value = []
  try {
    const query: Record<string, string> = { provider }
    if (apiKey.value) query.apiKey = apiKey.value
    const data = await $fetch<{ models: string[] }>('/api/settings/ai/models', { query })
    models.value = data.models.map(id => ({
      label: id,
      value: id,
      quota: provider === 'gemini' ? GEMINI_FREE_MODELS.get(id) : undefined
    }))
  } catch {
    models.value = []
  } finally {
    modelsLoading.value = false
  }
}

let modelsDebounce: ReturnType<typeof setTimeout> | null = null

watch(() => ai.provider, (provider) => {
  ai.model = ''
  fetchModels(provider)
})

watch(apiKey, () => {
  if (modelsDebounce) clearTimeout(modelsDebounce)
  modelsDebounce = setTimeout(() => fetchModels(ai.provider), 800)
})

// Initial fetch
fetchModels(ai.provider)

async function saveAI(_event: FormSubmitEvent<typeof ai>) {
  savingAI.value = true
  try {
    const body: Record<string, unknown> = {
      provider: ai.provider,
      model: ai.model
    }
    if (apiKey.value) body.apiKey = apiKey.value

    const result = await $fetch<{ hasApiKey: boolean }>('/api/settings/ai', { method: 'PUT', body })
    hasApiKey.value = result.hasApiKey
    apiKey.value = ''
    validationResult.value = null
    // Invalidate cached config state so it gets re-checked
    isAIConfigured.value = null
    toast.add({ title: t('settings.saved'), color: 'success', icon: 'i-lucide-check-circle' })
  } catch {
    toast.add({ title: t('common.error'), color: 'error' })
  } finally {
    savingAI.value = false
  }
}

async function validateAI() {
  validating.value = true
  validationResult.value = null
  try {
    const result = await $fetch<{ valid: boolean, error?: string }>('/api/settings/ai/validate', { method: 'POST' })
    validationResult.value = result
    if (result.valid) {
      isAIConfigured.value = true
      toast.add({ title: t('settings.aiValid'), color: 'success', icon: 'i-lucide-check-circle' })
      if (isSetupMode.value) {
        await router.push('/dashboard')
      }
    }
  } catch {
    validationResult.value = { valid: false, error: t('common.error') }
  } finally {
    validating.value = false
  }
}

const availableLocales = computed(() =>
  (locales.value as Array<{ code: string, name: string }>).map(l => ({
    label: l.name,
    value: l.code
  }))
)

// API Keys
interface ApiKey {
  id: string
  name: string
  prefix: string
  createdAt: string
  lastUsedAt: string | null
}

const { data: apiKeys, refresh: refreshApiKeys } = await useFetch<ApiKey[]>('/api/user/api-keys')
const newKeyName = ref('')
const creatingKey = ref(false)
const newKeyValue = ref<string | null>(null)
const copied = ref(false)

async function createApiKey() {
  if (!newKeyName.value.trim()) return
  creatingKey.value = true
  try {
    const result = await $fetch<{ key: string }>('/api/user/api-keys', {
      method: 'POST',
      body: { name: newKeyName.value.trim() }
    })
    newKeyValue.value = result.key
    newKeyName.value = ''
    toast.add({ title: t('apiKeys.created'), color: 'success', icon: 'i-lucide-key' })
    await refreshApiKeys()
  } catch {
    toast.add({ title: t('common.error'), color: 'error' })
  } finally {
    creatingKey.value = false
  }
}

async function revokeApiKey(id: string) {
  await $fetch(`/api/user/api-keys/${id}`, { method: 'DELETE' })
  toast.add({ title: t('apiKeys.revoked'), color: 'success' })
  await refreshApiKeys()
}

async function copyKey(key: string) {
  await navigator.clipboard.writeText(key)
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 2000)
}

function formatLastUsed(dateStr: string | null) {
  if (!dateStr) return t('apiKeys.never')
  return new Date(dateStr).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

const mcpEndpoint = computed(() => `${window?.location?.origin ?? ''}/api/mcp`)
const mcpConfig = computed(() => JSON.stringify({
  mcpServers: {
    scantrition: {
      url: mcpEndpoint.value
    }
  }
}, null, 2))
</script>

<template>
  <div class="max-w-xl mx-auto px-4 py-6 space-y-6">
    <h1 class="text-xl font-bold">
      {{ t('settings.title') }}
    </h1>

    <!-- Setup required banner -->
    <UAlert
      v-if="isSetupMode"
      color="warning"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="t('settings.setupRequired')"
      :description="t('settings.setupRequiredDesc')"
    />

    <!-- Goals -->
    <UCard>
      <template #header>
        <div>
          <p class="font-semibold">
            {{ t('settings.goalsTitle') }}
          </p>
          <p class="text-sm text-[var(--ui-text-muted)]">
            {{ t('settings.goalsSubtitle') }}
          </p>
        </div>
      </template>

      <UForm
        :state="goals"
        class="space-y-4"
        @submit="saveGoals"
      >
        <div class="grid grid-cols-2 gap-3">
          <UFormField
            :label="t('settings.caloriesGoal')"
            name="calories"
          >
            <UInput
              v-model.number="goals.calories"
              type="number"
              min="500"
              max="10000"
              class="w-full"
            />
          </UFormField>
          <UFormField
            :label="t('settings.proteinGoal')"
            name="protein"
          >
            <UInput
              v-model.number="goals.protein"
              type="number"
              min="0"
              max="500"
              class="w-full"
            />
          </UFormField>
          <UFormField
            :label="t('settings.carbsGoal')"
            name="carbs"
          >
            <UInput
              v-model.number="goals.carbs"
              type="number"
              min="0"
              max="1000"
              class="w-full"
            />
          </UFormField>
          <UFormField
            :label="t('settings.fatGoal')"
            name="fat"
          >
            <UInput
              v-model.number="goals.fat"
              type="number"
              min="0"
              max="300"
              class="w-full"
            />
          </UFormField>
        </div>

        <UButton
          type="submit"
          block
          :loading="savingGoals"
          icon="i-lucide-target"
        >
          {{ t('settings.saveGoals') }}
        </UButton>
      </UForm>
    </UCard>

    <!-- AI Provider -->
    <UCard>
      <template #header>
        <div>
          <p class="font-semibold">
            {{ t('settings.aiTitle') }}
          </p>
          <p class="text-sm text-[var(--ui-text-muted)]">
            {{ t('settings.aiSubtitle') }}
          </p>
        </div>
      </template>

      <UForm
        :state="ai"
        class="space-y-4"
        @submit="saveAI"
      >
        <UFormField
          :label="t('settings.provider')"
          name="provider"
        >
          <USelect
            v-model="ai.provider"
            :items="providers"
            value-key="value"
            class="w-full"
          />
        </UFormField>

        <div
          v-if="currentApiKeyLink"
          class="flex items-center gap-3 -mt-2"
        >
          <a
            :href="currentApiKeyLink.url"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <UIcon
              name="i-lucide-key-round"
              class="w-3.5 h-3.5"
            />
            {{ t('settings.getApiKey', { provider: currentApiKeyLink.label }) }}
            <UIcon
              name="i-lucide-external-link"
              class="w-3 h-3 opacity-60"
            />
          </a>
          <a
            v-if="currentApiKeyLink.quotaUrl"
            :href="currentApiKeyLink.quotaUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-1 text-xs text-[var(--ui-text-muted)] hover:underline"
          >
            <UIcon
              name="i-lucide-gauge"
              class="w-3.5 h-3.5"
            />
            {{ t('settings.viewQuotas') }}
            <UIcon
              name="i-lucide-external-link"
              class="w-3 h-3 opacity-60"
            />
          </a>
        </div>

        <UFormField
          :label="t('settings.apiKey')"
          name="apiKey"
        >
          <div class="space-y-1.5">
            <div
              v-if="hasApiKey"
              class="flex items-center gap-1.5 text-xs text-success"
            >
              <UIcon
                name="i-lucide-check-circle"
                class="w-3.5 h-3.5"
              />
              {{ t('settings.apiKeySet') }}
            </div>
            <UInput
              v-model="apiKey"
              type="password"
              :placeholder="hasApiKey ? t('settings.apiKeyChangePlaceholder') : t('settings.apiKeyPlaceholder')"
              class="w-full"
            />
          </div>
        </UFormField>

        <UFormField
          :label="t('settings.model')"
          name="model"
        >
          <USelectMenu
            v-model="ai.model"
            :items="models"
            value-key="value"
            :loading="modelsLoading"
            :disabled="modelsLoading"
            :placeholder="modelsLoading ? t('common.loading') : t('settings.modelPlaceholder')"
            class="w-full"
          >
            <template #item="{ item }">
              <span class="flex-1 truncate">{{ item.label }}</span>
              <span
                v-if="item.quota"
                class="text-xs text-[var(--ui-text-muted)] shrink-0"
              >
                {{ item.quota.rpm }}/min · {{ item.quota.rpd }}/j
              </span>
              <UBadge
                v-if="item.quota"
                color="success"
                variant="subtle"
                size="xs"
              >
                Free
              </UBadge>
            </template>
          </USelectMenu>
        </UFormField>

        <UButton
          type="submit"
          block
          :loading="savingAI"
          icon="i-lucide-cpu"
        >
          {{ t('settings.saveAI') }}
        </UButton>

        <UButton
          block
          variant="outline"
          :loading="validating"
          icon="i-lucide-plug"
          @click="validateAI"
        >
          {{ t('settings.aiValidate') }}
        </UButton>

        <UAlert
          v-if="validationResult"
          :color="validationResult.valid ? 'success' : 'error'"
          variant="subtle"
          :icon="validationResult.valid ? 'i-lucide-check-circle' : 'i-lucide-alert-circle'"
          :title="validationResult.valid ? t('settings.aiValid') : t('settings.aiInvalid')"
          :description="validationResult.error"
        />
      </UForm>
    </UCard>

    <!-- Language -->
    <UCard>
      <template #header>
        <p class="font-semibold">
          {{ t('settings.languageTitle') }}
        </p>
      </template>

      <div class="flex gap-2">
        <UButton
          v-for="loc in availableLocales"
          :key="loc.value"
          :variant="locale === loc.value ? 'solid' : 'outline'"
          :color="locale === loc.value ? 'primary' : 'neutral'"
          @click="setLocale(loc.value)"
        >
          {{ loc.label }}
        </UButton>
      </div>
    </UCard>

    <!-- API Keys -->
    <UCard>
      <template #header>
        <div>
          <p class="font-semibold">
            {{ t('apiKeys.title') }}
          </p>
          <p class="text-sm text-[var(--ui-text-muted)]">
            {{ t('apiKeys.subtitle') }}
          </p>
        </div>
      </template>

      <div class="space-y-4">
        <!-- New key created banner -->
        <UAlert
          v-if="newKeyValue"
          color="success"
          variant="subtle"
          icon="i-lucide-key"
          :title="t('apiKeys.copyWarning')"
        >
          <template #description>
            <div class="flex items-center gap-2 mt-1">
              <code class="text-xs bg-[var(--ui-bg)] px-2 py-1 rounded flex-1 truncate">{{ newKeyValue }}</code>
              <UButton
                size="xs"
                :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
                @click="copyKey(newKeyValue!)"
              >
                {{ copied ? t('common.copied') : t('common.copy') }}
              </UButton>
            </div>
          </template>
        </UAlert>

        <!-- Existing keys -->
        <div
          v-if="apiKeys?.length"
          class="space-y-2"
        >
          <div
            v-for="key in apiKeys"
            :key="key.id"
            class="flex items-center justify-between gap-3 p-3 rounded-xl border border-[var(--ui-border)]"
          >
            <div class="flex-1 min-w-0">
              <p class="font-medium text-sm">
                {{ key.name }}
              </p>
              <p class="text-xs text-[var(--ui-text-muted)] font-mono">
                {{ key.prefix }}…
              </p>
              <p class="text-xs text-[var(--ui-text-muted)]">
                {{ t('apiKeys.lastUsed') }} : {{ formatLastUsed(key.lastUsedAt) }}
              </p>
            </div>
            <UButton
              size="xs"
              variant="ghost"
              color="error"
              icon="i-lucide-trash-2"
              @click="revokeApiKey(key.id)"
            >
              {{ t('apiKeys.revoke') }}
            </UButton>
          </div>
        </div>

        <p
          v-else-if="!newKeyValue"
          class="text-sm text-[var(--ui-text-muted)]"
        >
          {{ t('apiKeys.noKeys') }}
        </p>

        <!-- Create new key -->
        <div class="flex gap-2">
          <UInput
            v-model="newKeyName"
            :placeholder="t('apiKeys.namePlaceholder')"
            class="flex-1"
            @keydown.enter="createApiKey"
          />
          <UButton
            :loading="creatingKey"
            icon="i-lucide-plus"
            @click="createApiKey"
          >
            {{ t('apiKeys.create') }}
          </UButton>
        </div>
      </div>
    </UCard>

    <!-- MCP Server -->
    <UCard>
      <template #header>
        <div>
          <p class="font-semibold">
            {{ t('mcp.title') }}
          </p>
          <p class="text-sm text-[var(--ui-text-muted)]">
            {{ t('mcp.subtitle') }}
          </p>
        </div>
      </template>

      <div class="space-y-4">
        <div>
          <p class="text-sm font-medium mb-1">
            {{ t('mcp.endpoint') }}
          </p>
          <code class="text-xs bg-[var(--ui-bg-elevated)] px-3 py-2 rounded-lg block truncate">{{ mcpEndpoint }}</code>
        </div>

        <UAlert
          color="success"
          variant="subtle"
          icon="i-lucide-shield-check"
          :title="t('mcp.oauthTitle')"
          :description="t('mcp.oauthDesc')"
        />

        <div>
          <p class="text-sm font-medium mb-1">
            {{ t('mcp.configTitle') }}
          </p>
          <p class="text-xs text-[var(--ui-text-muted)] mb-2">
            {{ t('mcp.configHint') }}
          </p>
          <pre class="text-xs bg-[var(--ui-bg-elevated)] px-3 py-2 rounded-lg overflow-x-auto">{{ mcpConfig }}</pre>
        </div>
      </div>
    </UCard>
  </div>
</template>
