import type { H3Event } from 'h3'
import { db } from '../db'
import { userApiKeys } from '../db/schema'
import { eq } from 'drizzle-orm'
import { getUserIdFromOAuthToken } from './oauth'

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(key)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export function generateApiKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
  return `sct_${hex}`
}

export async function hashApiKey(key: string): Promise<string> {
  return hashKey(key)
}

export async function getUserIdFromApiKey(rawKey: string): Promise<string | null> {
  const keyHash = await hashKey(rawKey)
  const apiKey = await db.query.userApiKeys.findFirst({
    where: eq(userApiKeys.keyHash, keyHash)
  })
  if (!apiKey) return null

  db.update(userApiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(userApiKeys.id, apiKey.id))
    .execute()
    .catch(() => {})

  return apiKey.userId
}

export interface AuthUser {
  id: string
  email: string
}

export interface AuthSession {
  user: AuthUser
}

export async function requireSession(event: H3Event): Promise<AuthSession> {
  const session = await requireUserSession(event)
  return session as unknown as AuthSession
}

export async function requireAuth(event: H3Event): Promise<string> {
  const auth = getHeader(event, 'authorization')
  if (auth?.startsWith('Bearer ')) {
    const rawToken = auth.slice(7)

    // Check OAuth access token first
    const oauthUserId = await getUserIdFromOAuthToken(rawToken)
    if (oauthUserId) return oauthUserId

    // Fall back to static API key
    const apiKeyUserId = await getUserIdFromApiKey(rawToken)
    if (apiKeyUserId) return apiKeyUserId

    throw createError({ statusCode: 401, message: 'Invalid token' })
  }

  const session = await requireSession(event)
  return session.user.id
}
