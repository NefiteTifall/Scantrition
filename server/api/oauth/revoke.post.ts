import { db } from '../../db'
import { oauthAccessTokens, oauthRefreshTokens } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { hashOAuthToken } from '../../utils/oauth'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Access-Control-Allow-Origin', '*')
  const { token } = await readBody(event)
  if (!token) return {}

  const hash = await hashOAuthToken(token)

  const at = await db.query.oauthAccessTokens.findFirst({ where: eq(oauthAccessTokens.tokenHash, hash) })
  if (at) {
    await db.update(oauthAccessTokens).set({ revokedAt: new Date() }).where(eq(oauthAccessTokens.id, at.id))
    return {}
  }

  const rt = await db.query.oauthRefreshTokens.findFirst({ where: eq(oauthRefreshTokens.tokenHash, hash) })
  if (rt) {
    await db.update(oauthRefreshTokens).set({ revokedAt: new Date() }).where(eq(oauthRefreshTokens.id, rt.id))
  }

  return {} // RFC 7009: always 200
})
