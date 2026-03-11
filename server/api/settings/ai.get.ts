import { db } from '../../db'
import { aiSettings } from '../../db/schema'
import { eq } from 'drizzle-orm'

const envKeys: Record<string, string | undefined> = {
  gemini: process.env.GEMINI_API_KEY,
  openai: process.env.OPENAI_API_KEY,
  anthropic: process.env.ANTHROPIC_API_KEY,
  openrouter: process.env.OPENROUTER_API_KEY
}

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)

  const settings = await db.query.aiSettings.findFirst({
    where: eq(aiSettings.userId, session.user.id)
  })

  const provider = settings?.provider ?? 'gemini'
  const hasUserKey = !!(settings?.apiKey)
  const hasEnvKey = !!(envKeys[provider])
  const isConfigured = hasUserKey || hasEnvKey

  return {
    provider,
    hasApiKey: hasUserKey,
    isConfigured,
    model: settings?.model ?? ''
  }
})
