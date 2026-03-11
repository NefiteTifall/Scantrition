import { Resend } from 'resend'
import { db } from '../../db'
import { users, passwordResetTokens } from '../../db/schema'
import { eq, and, gt, isNull } from 'drizzle-orm'
import { checkRateLimit, getClientIp } from '../../utils/rateLimit'

export default defineEventHandler(async (event) => {
  checkRateLimit(`forgot:${getClientIp(event)}`, 5, 15 * 60 * 1000)

  const { email } = await readBody(event)

  if (!email?.trim()) {
    throw createError({ statusCode: 400, message: 'Email requis' })
  }

  const user = await db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase().trim())
  })

  // Always return success to avoid email enumeration
  if (!user) return { success: true }

  // Invalidate existing tokens for this user
  await db.update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(and(
      eq(passwordResetTokens.userId, user.id),
      isNull(passwordResetTokens.usedAt),
      gt(passwordResetTokens.expiresAt, new Date())
    ))

  // Generate secure token
  const rawToken = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0')).join('')

  const encoder = new TextEncoder()
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(rawToken))
  const tokenHash = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0')).join('')

  const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

  await db.insert(passwordResetTokens).values({
    userId: user.id,
    tokenHash,
    expiresAt
  })

  // Build reset URL — use APP_URL env var in production, fallback to request host in dev
  const appUrl = process.env.APP_URL
    ?? (() => {
      const host = getHeader(event, 'host') ?? 'localhost:3000'
      const proto = getHeader(event, 'x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
      return `${proto}://${host}`
    })()
  const resetUrl = `${appUrl}/reset-password?token=${rawToken}`

  const resend = new Resend(process.env.RESEND_KEY)

  await resend.emails.send({
    from: 'Scantrition <scantrition@nguillaume.fr>',
    to: user.email,
    subject: 'Réinitialisation de votre mot de passe',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #22c55e; margin-bottom: 8px;">Scantrition</h2>
        <h3 style="margin-bottom: 16px;">Réinitialisation de mot de passe</h3>
        <p style="color: #64748b; margin-bottom: 24px;">
          Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous.
          Ce lien est valable <strong>1 heure</strong>.
        </p>
        <a href="${resetUrl}"
           style="display: inline-block; background: #22c55e; color: white; padding: 12px 24px;
                  border-radius: 8px; text-decoration: none; font-weight: 600; margin-bottom: 24px;">
          Réinitialiser mon mot de passe
        </a>
        <p style="color: #94a3b8; font-size: 13px;">
          Si vous n'avez pas fait cette demande, ignorez cet email. Votre mot de passe ne sera pas modifié.
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
        <p style="color: #94a3b8; font-size: 12px;">Scantrition · Nutrition tracker open source</p>
      </div>
    `
  })

  return { success: true }
})
