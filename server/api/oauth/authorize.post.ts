import { db } from '../../db'
import { oauthClients, oauthAuthorizationCodes } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { generateAuthCode } from '../../utils/oauth'

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  const { client_id, redirect_uri, state, scope, code_challenge, code_challenge_method } = await readBody(event)

  if (!client_id || !redirect_uri) {
    throw createError({ statusCode: 400, message: 'client_id and redirect_uri are required' })
  }

  const client = await db.query.oauthClients.findFirst({
    where: eq(oauthClients.clientId, client_id)
  })
  if (!client) throw createError({ statusCode: 400, message: 'Invalid client_id' })
  if (!client.redirectUris.includes(redirect_uri)) {
    throw createError({ statusCode: 400, message: 'Invalid redirect_uri' })
  }

  const code = generateAuthCode()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

  await db.insert(oauthAuthorizationCodes).values({
    code,
    clientId: client_id,
    userId: session.user.id,
    redirectUri: redirect_uri,
    scope: scope ?? 'mcp',
    codeChallenge: code_challenge ?? null,
    codeChallengeMethod: code_challenge_method ?? null,
    expiresAt
  })

  const redirectUrl = new URL(redirect_uri)
  redirectUrl.searchParams.set('code', code)
  if (state) redirectUrl.searchParams.set('state', state)

  return { redirect_uri: redirectUrl.toString() }
})
