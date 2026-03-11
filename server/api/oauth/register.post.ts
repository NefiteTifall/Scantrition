import { db } from '../../db'
import { oauthClients } from '../../db/schema'
import { generateClientId } from '../../utils/oauth'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Access-Control-Allow-Origin', '*')
  const body = await readBody(event)
  const { client_name, redirect_uris, grant_types, response_types, scope, token_endpoint_auth_method } = body

  if (!Array.isArray(redirect_uris) || redirect_uris.length === 0) {
    throw createError({ statusCode: 400, message: 'redirect_uris is required' })
  }

  const clientId = generateClientId()
  const name = client_name ?? 'MCP Client'

  await db.insert(oauthClients).values({
    clientId,
    name,
    redirectUris: redirect_uris,
    scope: scope ?? 'mcp'
  })

  return {
    client_id: clientId,
    client_name: name,
    redirect_uris,
    grant_types: grant_types ?? ['authorization_code'],
    response_types: response_types ?? ['code'],
    scope: scope ?? 'mcp',
    token_endpoint_auth_method: token_endpoint_auth_method ?? 'none',
    client_id_issued_at: Math.floor(Date.now() / 1000),
    client_secret_expires_at: 0
  }
})
