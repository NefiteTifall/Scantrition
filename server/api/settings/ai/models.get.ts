import { db } from '../../../db'
import { aiSettings } from '../../../db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  const { provider, apiKey: queryApiKey } = getQuery(event)

  const settings = await db.query.aiSettings.findFirst({
    where: eq(aiSettings.userId, session.user.id)
  })

  const apiKey = (queryApiKey as string) || settings?.apiKey || ''

  try {
    switch (provider) {
      case 'gemini': {
        const key = apiKey || process.env.GEMINI_API_KEY || ''
        if (!key) return { models: [] }
        const data = await $fetch<{ models: Array<{ name: string, supportedGenerationMethods?: string[] }> }>(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
        )
        return {
          models: data.models
            .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
            .map(m => m.name.replace('models/', ''))
        }
      }

      case 'openai': {
        const key = apiKey || process.env.OPENAI_API_KEY || ''
        if (!key) return { models: [] }
        const data = await $fetch<{ data: Array<{ id: string }> }>(
          'https://api.openai.com/v1/models',
          { headers: { Authorization: `Bearer ${key}` } }
        )
        return {
          models: data.data
            .map(m => m.id)
            .filter(id => id.startsWith('gpt-'))
            .sort()
        }
      }

      case 'anthropic': {
        const key = apiKey || process.env.ANTHROPIC_API_KEY || ''
        if (!key) return { models: [] }
        const data = await $fetch<{ data: Array<{ id: string }> }>(
          'https://api.anthropic.com/v1/models',
          {
            headers: {
              'x-api-key': key,
              'anthropic-version': '2023-06-01'
            }
          }
        )
        return { models: data.data.map(m => m.id) }
      }

      case 'openrouter': {
        const data = await $fetch<{ data: Array<{ id: string }> }>(
          'https://openrouter.ai/api/v1/models'
        )
        return { models: data.data.map(m => m.id).sort() }
      }

      default:
        return { models: [] }
    }
  } catch {
    return { models: [] }
  }
})
