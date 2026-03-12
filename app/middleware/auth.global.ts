export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn } = useUserSession()
  const publicRoutes = ['/login', '/register', '/forgot-password', '/reset-password']

  if (!loggedIn.value && !publicRoutes.includes(to.path)) {
    // For OAuth authorize, preserve the full URL as redirect param
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
