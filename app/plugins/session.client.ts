// Fetch the session before any route middleware runs.
// Without this, on PWA/SPA first load, loggedIn is false until the session
// cookie is verified, causing a flash redirect to /login.
export default defineNuxtPlugin(async () => {
  const { fetch: fetchSession } = useUserSession()
  try {
    await fetchSession()
  } catch {}
})
