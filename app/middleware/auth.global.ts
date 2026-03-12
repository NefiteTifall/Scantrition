const sessionReady = import.meta.client ? useState('session-ready', () => false) : null

export default defineNuxtRouteMiddleware(async (to) => {
  const { loggedIn, fetch: fetchSession } = useUserSession()
  const publicRoutes = ['/login', '/register', '/forgot-password', '/reset-password']

  // On client-side (PWA/SPA), fetch the session once before checking auth
  // to avoid flashing the login page while the session cookie is being verified
  if (import.meta.client && sessionReady && !sessionReady.value) {
    await fetchSession()
    sessionReady.value = true
  }

  if (!loggedIn.value && !publicRoutes.includes(to.path)) {
    if (to.path === '/oauth/authorize') {
      return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
    }
    return navigateTo('/login')
  }

  if (loggedIn.value && publicRoutes.includes(to.path)) {
    return navigateTo('/dashboard')
  }

  // Block access until AI is configured (check only on client after hydration)
  if (import.meta.client && loggedIn.value && to.path !== '/settings' && to.path !== '/oauth/authorize') {
    const isConfigured = useState<boolean | null>('ai-configured')
    if (isConfigured.value === false) {
      return navigateTo('/settings?setup=true')
    }
  }
})
