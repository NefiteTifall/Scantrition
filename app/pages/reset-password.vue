<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'

definePageMeta({ layout: false })

const { t } = useI18n()
const route = useRoute()
const token = route.query.token as string

const fields = [
  {
    name: 'password',
    type: 'password',
    label: t('auth.password'),
    placeholder: '••••••••',
    required: true
  },
  {
    name: 'passwordConfirm',
    type: 'password',
    label: t('auth.passwordConfirm'),
    placeholder: '••••••••',
    required: true
  }
]

const loading = ref(false)
const success = ref(false)
const error = ref('')

async function submit(event: FormSubmitEvent<{ password: string, passwordConfirm: string }>) {
  error.value = ''

  if (event.data.password !== event.data.passwordConfirm) {
    error.value = t('auth.passwordMismatch')
    return
  }
  if (event.data.password.length < 8) {
    error.value = t('auth.passwordTooShort')
    return
  }

  loading.value = true
  try {
    await $fetch('/api/auth/reset-password', {
      method: 'POST',
      body: { token, password: event.data.password }
    })
    success.value = true
  } catch (err: unknown) {
    const fe = err as { data?: { message?: string } }
    error.value = fe.data?.message ?? t('common.error')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center px-4 py-12 bg-[var(--ui-bg)]">
    <!-- No token -->
    <div
      v-if="!token"
      class="w-full max-w-sm text-center space-y-4"
    >
      <UIcon
        name="i-lucide-alert-triangle"
        class="w-14 h-14 mx-auto text-warning"
      />
      <p class="text-[var(--ui-text-muted)]">
        {{ t('auth.invalidResetLink') }}
      </p>
      <UButton
        to="/forgot-password"
        block
      >
        {{ t('auth.requestNewLink') }}
      </UButton>
    </div>

    <!-- Success -->
    <div
      v-else-if="success"
      class="w-full max-w-sm text-center space-y-4"
    >
      <UIcon
        name="i-lucide-check-circle"
        class="w-14 h-14 mx-auto text-primary"
      />
      <h2 class="text-xl font-bold">
        {{ t('auth.resetSuccess') }}
      </h2>
      <p class="text-sm text-[var(--ui-text-muted)]">
        {{ t('auth.resetSuccessDesc') }}
      </p>
      <UButton
        to="/login"
        block
      >
        {{ t('auth.login') }}
      </UButton>
    </div>

    <!-- Form -->
    <UAuthForm
      v-else
      :fields="fields"
      :title="t('auth.resetTitle')"
      :description="t('auth.resetSubtitle')"
      icon="i-lucide-lock-keyhole"
      :submit="{ label: t('auth.resetConfirm'), block: true }"
      :loading="loading"
      class="w-full max-w-sm white-section"
      @submit="submit"
    >
      <template #validation>
        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          :description="error"
          icon="i-lucide-alert-circle"
        />
      </template>
    </UAuthForm>
  </div>
</template>
