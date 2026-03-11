<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'

definePageMeta({ layout: false })

const { t } = useI18n()

const fields = [{
  name: 'email',
  type: 'email',
  label: 'Email',
  placeholder: 'votre@email.com',
  required: true
}]

const loading = ref(false)
const sent = ref(false)
const error = ref('')

async function submit(event: FormSubmitEvent<{ email: string }>) {
  loading.value = true
  error.value = ''
  try {
    await $fetch('/api/auth/forgot-password', {
      method: 'POST',
      body: { email: event.data.email }
    })
    sent.value = true
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
    <div
      v-if="sent"
      class="w-full max-w-sm text-center space-y-4"
    >
      <UIcon
        name="i-lucide-mail-check"
        class="w-14 h-14 mx-auto text-primary"
      />
      <h2 class="text-xl font-bold">
        {{ t('auth.resetEmailSent') }}
      </h2>
      <p class="text-sm text-[var(--ui-text-muted)]">
        {{ t('auth.resetEmailSentDesc') }}
      </p>
      <UButton
        to="/login"
        variant="outline"
        color="neutral"
        block
      >
        {{ t('auth.backToLogin') }}
      </UButton>
    </div>

    <UAuthForm
      v-else
      :fields="fields"
      :title="t('auth.forgotTitle')"
      :description="t('auth.forgotSubtitle')"
      icon="i-lucide-key-round"
      :submit="{ label: t('auth.sendResetLink'), block: true }"
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
      <template #footer>
        <p class="text-center text-sm text-[var(--ui-text-muted)]">
          <NuxtLink
            to="/login"
            class="text-primary font-medium hover:underline"
          >
            {{ t('auth.backToLogin') }}
          </NuxtLink>
        </p>
      </template>
    </UAuthForm>
  </div>
</template>
