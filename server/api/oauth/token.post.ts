import { db } from '../../db'
import { oauthAuthorizationCodes, oauthAccessTokens, oauthRefreshTokens } from '../../db/schema'
import { eq, and, gt, isNull } from 'drizzle-orm'
import { generateOAuthToken, hashOAuthToken, verifyPKCE } from '../../utils/oauth'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  setResponseHeader(event, 'Access-Control-Allow-Origin', '*')

  const body = await readBody(event)
  const { grant_type, code, code_verifier, redirect_uri, client_id, refresh_token } = body

  if (grant_type === 'authorization_code') {
    if (!code || !client_id || !redirect_uri) {
      throw createError({ statusCode: 400, message: 'invalid_request' })
    }

    const authCode = await db.query.oauthAuthorizationCodes.findFirst({
      where: and(
        eq(oauthAuthorizationCodes.code, code),
        eq(oauthAuthorizationCodes.clientId, client_id),
        gt(oauthAuthorizationCodes.expiresAt, new Date()),
        isNull(oauthAuthorizationCodes.usedAt)
      )
    })

    if (!authCode) throw createError({ statusCode: 400, message: 'invalid_grant' })
    if (authCode.redirectUri !== redirect_uri) throw createError({ statusCode: 400, message: 'redirect_uri_mismatch' })

    // Verify PKCE
    if (authCode.codeChallenge) {
      if (!code_verifier) throw createError({ statusCode: 400, message: 'code_verifier required' })
      const valid = await verifyPKCE(code_verifier, authCode.codeChallenge)
      if (!valid) throw createError({ statusCode: 400, message: 'invalid_grant' })
    }

    // Mark code as used (single-use)
    await db.update(oauthAuthorizationCodes)
      .set({ usedAt: new Date() })
      .where(eq(oauthAuthorizationCodes.id, authCode.id))

    // Issue tokens
    const accessToken = generateOAuthToken('sct_at_')
    const refreshToken = generateOAuthToken('sct_rt_')
    const atHash = await hashOAuthToken(accessToken)
    const rtHash = await hashOAuthToken(refreshToken)

    const accessExpiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour
    const refreshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

    const [at] = await db.insert(oauthAccessTokens).values({
      tokenHash: atHash,
      clientId: client_id,
      userId: authCode.userId,
      scope: authCode.scope ?? 'mcp',
      expiresAt: accessExpiresAt
    }).returning()

    if (!at) throw createError({ statusCode: 500, message: 'Failed to create access token' })

    await db.insert(oauthRefreshTokens).values({
      tokenHash: rtHash,
      clientId: client_id,
      userId: authCode.userId,
      accessTokenId: at.id,
      expiresAt: refreshExpiresAt
    })

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: refreshToken,
      scope: authCode.scope ?? 'mcp'
    }
  }

  if (grant_type === 'refresh_token') {
    if (!refresh_token) throw createError({ statusCode: 400, message: 'invalid_request' })

    const rtHash = await hashOAuthToken(refresh_token)
    const rt = await db.query.oauthRefreshTokens.findFirst({
      where: and(
        eq(oauthRefreshTokens.tokenHash, rtHash),
        gt(oauthRefreshTokens.expiresAt, new Date()),
        isNull(oauthRefreshTokens.revokedAt)
      )
    })
    if (!rt) throw createError({ statusCode: 400, message: 'invalid_grant' })

    // Rotate: revoke old tokens
    await db.update(oauthRefreshTokens).set({ revokedAt: new Date() }).where(eq(oauthRefreshTokens.id, rt.id))
    if (rt.accessTokenId) {
      await db.update(oauthAccessTokens).set({ revokedAt: new Date() }).where(eq(oauthAccessTokens.id, rt.accessTokenId))
    }

    // Issue new tokens
    const newAt = generateOAuthToken('sct_at_')
    const newRt = generateOAuthToken('sct_rt_')
    const newAtHash = await hashOAuthToken(newAt)
    const newRtHash = await hashOAuthToken(newRt)

    const accessExpiresAt = new Date(Date.now() + 60 * 60 * 1000)
    const refreshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    const [newAtRecord] = await db.insert(oauthAccessTokens).values({
      tokenHash: newAtHash,
      clientId: rt.clientId,
      userId: rt.userId,
      scope: 'mcp',
      expiresAt: accessExpiresAt
    }).returning()

    if (!newAtRecord) throw createError({ statusCode: 500, message: 'Failed to rotate access token' })

    await db.insert(oauthRefreshTokens).values({
      tokenHash: newRtHash,
      clientId: rt.clientId,
      userId: rt.userId,
      accessTokenId: newAtRecord.id,
      expiresAt: refreshExpiresAt
    })

    return {
      access_token: newAt,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: newRt,
      scope: 'mcp'
    }
  }

  throw createError({ statusCode: 400, message: 'unsupported_grant_type' })
})
