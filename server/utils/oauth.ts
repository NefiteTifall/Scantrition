import { db } from '../db'
import { oauthAccessTokens } from '../db/schema'
import { eq, and, gt, isNull } from 'drizzle-orm'

export function generateOAuthToken(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
  return `${prefix}${hex}`
}

export async function hashOAuthToken(token: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(token)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export function generateClientId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

export function generateAuthCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function verifyPKCE(codeVerifier: string, codeChallenge: string): Promise<boolean> {
  const encoder = new TextEncoder()
  const data = encoder.encode(codeVerifier)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = new Uint8Array(hashBuffer)
  const base64 = btoa(String.fromCharCode(...Array.from(hashArray)))
  const base64url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  return base64url === codeChallenge
}

export async function getUserIdFromOAuthToken(rawToken: string): Promise<string | null> {
  if (!rawToken.startsWith('sct_at_')) return null
  const hash = await hashOAuthToken(rawToken)
  const token = await db.query.oauthAccessTokens.findFirst({
    where: and(
      eq(oauthAccessTokens.tokenHash, hash),
      gt(oauthAccessTokens.expiresAt, new Date()),
      isNull(oauthAccessTokens.revokedAt)
    )
  })
  return token?.userId ?? null
}
