export default defineNuxtPlugin(async () => {
  const { loggedIn } = useUserSession()
  const isConfigured = useState<boolean | null>('ai-configured', () => null)

  if (loggedIn.value && isConfigured.value === null) {
    try {
      const data = await $fetch<{ isConfigured: boolean }>('/api/settings/ai')
      isConfigured.value = data.isConfigured
    } catch {
      isConfigured.value = null
    }
  }
})
