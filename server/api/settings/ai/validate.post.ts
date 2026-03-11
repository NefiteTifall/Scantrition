import { db } from '../../../db'
import { aiSettings } from '../../../db/schema'
import { eq } from 'drizzle-orm'
import { extractProviderError } from '../../../utils/ai'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)

  const settings = await db.query.aiSettings.findFirst({
    where: eq(aiSettings.userId, session.user.id)
  })

  const provider = settings?.provider ?? 'gemini'
  const apiKey = settings?.apiKey || ''

  try {
    switch (provider) {
      case 'gemini': {
        const key = apiKey || process.env.GEMINI_API_KEY || ''
        if (!key) return { valid: false, error: 'Aucune clé API configurée' }
        await $fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`)
        break
      }
      case 'openai': {
        const key = apiKey || process.env.OPENAI_API_KEY || ''
        if (!key) return { valid: false, error: 'Aucune clé API configurée' }
        await $fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${key}` }
        })
        break
      }
      case 'anthropic': {
        const key = apiKey || process.env.ANTHROPIC_API_KEY || ''
        if (!key) return { valid: false, error: 'Aucune clé API configurée' }
        await $fetch('https://api.anthropic.com/v1/models', {
          headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' }
        })
        break
      }
      case 'openrouter': {
        const key = apiKey || process.env.OPENROUTER_API_KEY || ''
        if (!key) return { valid: false, error: 'Aucune clé API configurée' }
        await $fetch('https://openrouter.ai/api/v1/auth/key', {
          headers: { Authorization: `Bearer ${key}` }
        })
        break
      }
    }
    return { valid: true }
  } catch (err: unknown) {
    return { valid: false, error: extractProviderError(err, provider) }
  }
})
