<script setup lang="ts">
definePageMeta({ layout: false })

const { t } = useI18n()
const { loggedIn } = useUserSession()
const route = useRoute()

const clientId = route.query.client_id as string
const redirectUri = route.query.redirect_uri as string
const state = route.query.state as string | undefined
const responseType = route.query.response_type as string
const scope = route.query.scope as string | undefined
const codeChallenge = route.query.code_challenge as string | undefined
const codeChallengeMethod = route.query.code_challenge_method as string | undefined

const loading = ref(false)
const error = ref('')

const isValid = computed(() => !!(clientId && redirectUri && responseType === 'code'))

onMounted(() => {
  if (!loggedIn.value) {
    navigateTo(`/login?redirect=${encodeURIComponent(route.fullPath)}`)
  }
})

async function approve() {
  loading.value = true
  error.value = ''
  try {
    const result = await $fetch<{ redirect_uri: string }>('/api/oauth/authorize', {
      method: 'POST',
      body: {
        client_id: clientId,
        redirect_uri: redirectUri,
        state,
        scope,
        code_challenge: codeChallenge,
        code_challenge_method: codeChallengeMethod
      }
    })
    window.location.href = result.redirect_uri
  } catch (err: unknown) {
    const fe = err as { data?: { message?: string } }
    error.value = fe.data?.message ?? t('common.error')
    loading.value = false
  }
}

function deny() {
  if (!redirectUri) return
  const url = new URL(redirectUri)
  url.searchParams.set('error', 'access_denied')
  if (state) url.searchParams.set('state', state)
  window.location.href = url.toString()
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center px-4 py-12 bg-[var(--ui-bg)]">
    <UCard class="w-full max-w-sm">
      <template #header>
        <div class="text-center space-y-3 py-2">
          <div class="flex items-center justify-center gap-2">
            <UIcon
              name="i-lucide-leaf"
              class="w-8 h-8 text-primary"
            />
            <span class="text-xl font-bold">Scantrition</span>
          </div>
          <h1 class="text-lg font-semibold">
            {{ t('oauth.title') }}
          </h1>
        </div>
      </template>

      <div
        v-if="!isValid"
        class="text-center py-6 text-[var(--ui-text-muted)]"
      >
        <UIcon
          name="i-lucide-alert-triangle"
          class="w-10 h-10 mx-auto mb-2 text-warning"
        />
        <p>{{ t('oauth.invalidRequest') }}</p>
      </div>

      <div
        v-else
        class="space-y-4"
      >
        <div class="p-3 bg-[var(--ui-bg-elevated)] rounded-xl">
          <p class="text-xs text-[var(--ui-text-muted)] mb-0.5">
            {{ t('oauth.clientLabel') }}
          </p>
          <p class="font-mono text-sm font-medium break-all">
            {{ clientId }}
          </p>
        </div>

        <div class="space-y-2">
          <p class="text-sm font-medium">
            {{ t('oauth.permissionsTitle') }}
          </p>
          <div class="space-y-1.5">
            <div class="flex items-center gap-2 text-sm text-[var(--ui-text-muted)]">
              <UIcon
                name="i-lucide-check-circle"
                class="w-4 h-4 text-success shrink-0"
              />
              <span>{{ t('oauth.permRead') }}</span>
            </div>
            <div class="flex items-center gap-2 text-sm text-[var(--ui-text-muted)]">
              <UIcon
                name="i-lucide-check-circle"
                class="w-4 h-4 text-success shrink-0"
              />
              <span>{{ t('oauth.permWrite') }}</span>
            </div>
          </div>
        </div>

        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          :description="error"
          icon="i-lucide-alert-circle"
        />

        <div class="flex gap-2 pt-1">
          <UButton
            block
            variant="outline"
            color="neutral"
            :disabled="loading"
            @click="deny"
          >
            {{ t('oauth.deny') }}
          </UButton>
          <UButton
            block
            :loading="loading"
            icon="i-lucide-check"
            @click="approve"
          >
            {{ t('oauth.approve') }}
          </UButton>
        </div>

        <p class="text-xs text-center text-[var(--ui-text-muted)]">
          {{ t('oauth.warning') }}
        </p>
      </div>
    </UCard>
  </div>
</template>
