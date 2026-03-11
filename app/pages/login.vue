<script setup lang="ts">
import type { FormSubmitEvent, AuthFormField } from '@nuxt/ui'

const { t } = useI18n()
const { fetch: refreshSession } = useUserSession()
const route = useRoute()

const loading = ref(false)
const error = ref('')

const fields: AuthFormField[] = [{
  name: 'email',
  type: 'email',
  label: 'Email',
  placeholder: 'Enter your email',
  required: true
}, {
  name: 'password',
  label: 'Password',
  type: 'password',
  placeholder: 'Enter your password',
  required: true
}, {
  name: 'remember',
  label: 'Remember me',
  type: 'checkbox'
}]

async function login(event: FormSubmitEvent<{ email: string, password: string }>) {
  loading.value = true
  error.value = ''

  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: { email: event.data.email, password: event.data.password }
    })
    await refreshSession()
    const redirect = route.query.redirect as string | undefined
    await navigateTo(redirect || '/dashboard')
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } }
    if (e.data?.message === 'Invalid credentials') {
      error.value = t('auth.invalidCredentials')
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
      :title="t('auth.loginTitle')"
      :description="t('auth.loginSubtitle')"
      icon="i-lucide-leaf"
      :submit="{ label: t('auth.login'), block: true }"
      :loading="loading"
      class="w-full max-w-sm white-section"
      @submit="login"
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
        <div class="space-y-2 text-center text-sm text-[var(--ui-text-muted)]">
          <p>
            <NuxtLink
              to="/forgot-password"
              class="text-primary font-medium hover:underline"
            >
              {{ t('auth.forgotPassword') }}
            </NuxtLink>
          </p>
          <p>
            {{ t('auth.noAccount') }}
            <NuxtLink
              to="/register"
              class="text-primary font-medium hover:underline ml-1"
            >
              {{ t('auth.registerHere') }}
            </NuxtLink>
          </p>
        </div>
      </template>
    </UAuthForm>
  </div>
</template>
