import { db } from '../../db'
import { users, passwordResetTokens } from '../../db/schema'
import { eq, and, gt, isNull } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { token, password } = await readBody(event)

  if (!token || !password) {
    throw createError({ statusCode: 400, message: 'Token et mot de passe requis' })
  }

  if (password.length < 8) {
    throw createError({ statusCode: 400, message: 'Mot de passe trop court (min. 8 caractères)' })
  }

  // Hash the incoming token to compare with DB
  const encoder = new TextEncoder()
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(token))
  const tokenHash = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0')).join('')

  const resetToken = await db.query.passwordResetTokens.findFirst({
    where: and(
      eq(passwordResetTokens.tokenHash, tokenHash),
      isNull(passwordResetTokens.usedAt),
      gt(passwordResetTokens.expiresAt, new Date())
    )
  })

  if (!resetToken) {
    throw createError({ statusCode: 400, message: 'Lien invalide ou expiré' })
  }

  // Mark token as used
  await db.update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokens.id, resetToken.id))

  // Update password
  const passwordHash = await hashPassword(password)
  await db.update(users)
    .set({ passwordHash })
    .where(eq(users.id, resetToken.userId))

  return { success: true }
})
