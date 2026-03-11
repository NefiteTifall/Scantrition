export default defineEventHandler((event) => {
  const host = getHeader(event, 'host') ?? 'localhost:3000'
  const proto = getHeader(event, 'x-forwarded-proto') ?? 'http'
  const baseUrl = `${proto}://${host}`

  setResponseHeader(event, 'Access-Control-Allow-Origin', '*')

  if (event.path === '/.well-known/oauth-authorization-server') {
    setResponseHeader(event, 'Content-Type', 'application/json')
    return {
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/oauth/authorize`,
      token_endpoint: `${baseUrl}/api/oauth/token`,
      registration_endpoint: `${baseUrl}/api/oauth/register`,
      revocation_endpoint: `${baseUrl}/api/oauth/revoke`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
      scopes_supported: ['mcp']
    }
  }

  if (event.path === '/.well-known/oauth-protected-resource') {
    setResponseHeader(event, 'Content-Type', 'application/json')
    return {
      resource: `${baseUrl}/api/mcp`,
      authorization_servers: [baseUrl],
      bearer_methods_supported: ['header'],
      scopes_supported: ['mcp']
    }
  }
})
