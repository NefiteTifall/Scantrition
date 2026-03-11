<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'

const { t } = useI18n()
const { fetch: refreshSession } = useUserSession()

const loading = ref(false)
const error = ref('')

const fields: AuthFormField[] = [{
  name: 'email',
  type: 'email',
  label: t('auth.email'),
  placeholder: t('auth.email'),
  required: true
}, {
  name: 'password',
  label: t('auth.password'),
  type: 'password',
  placeholder: t('auth.password'),
  required: true
}, {
  name: 'passwordConfirm',
  label: t('auth.passwordConfirm'),
  type: 'password',
  placeholder: t('auth.passwordConfirm'),
  required: true
}]

async function register(event: FormSubmitEvent<{ email: string, password: string, passwordConfirm: string }>) {
  error.value = ''

  const { email, password, passwordConfirm } = event.data

  if (password !== passwordConfirm) {
    error.value = t('auth.passwordMismatch')
    return
  }
  if (password.length < 8) {
    error.value = t('auth.passwordTooShort')
    return
  }

  loading.value = true

  try {
    await $fetch('/api/auth/register', {
      method: 'POST',
      body: { email, password }
    })
    await refreshSession()
    navigateTo('/dashboard')
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } }
    if (e.data?.message === 'Email already in use') {
      error.value = t('auth.emailInUse')
    } else {
      error.value = t('common.error')
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="h-full flex items-center justify-center px-4 py-12">
    <UAuthForm
      :fields="fields"
      :title="t('auth.registerTitle')"
      :description="t('auth.registerSubtitle')"
      icon="i-lucide-leaf"
      :submit="{ label: t('auth.register'), block: true }"
      :loading="loading"
      class="w-full max-w-sm white-section"
      @submit="register"
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
      <template #footer>
        <p class="text-center text-sm text-[var(--ui-text-muted)]">
          {{ t('auth.hasAccount') }}
          <NuxtLink to="/login" class="text-primary font-medium hover:underline ml-1">
            {{ t('auth.loginHere') }}
          </NuxtLink>
        </p>
      </template>
    </UAuthForm>
  </div>
</template>
