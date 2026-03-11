export function usePwaInstall() {
  const installPrompt = ref<Event | null>(null)
  const isInstalled = ref(false)
  const isIos = ref(false)

  onMounted(() => {
    // Already running as installed PWA
    isInstalled.value = window.matchMedia('(display-mode: standalone)').matches

    // iOS detection
    isIos.value = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as Window & { MSStream?: unknown }).MSStream

    // Android/Chrome: capture the install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault()
      installPrompt.value = e
    })

    // Detect if installed after prompt
    window.addEventListener('appinstalled', () => {
      isInstalled.value = true
      installPrompt.value = null
    })
  })

  async function install() {
    if (!installPrompt.value) return
    const prompt = installPrompt.value as Event & { prompt: () => void, userChoice: Promise<{ outcome: string }> }
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') {
      installPrompt.value = null
    }
  }

  const canInstall = computed(() => !isInstalled.value && (!!installPrompt.value || isIos.value))

  return { canInstall, isIos, isInstalled, install }
}
