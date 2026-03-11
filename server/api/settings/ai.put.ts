import { db } from '../../db'
import { aiSettings } from '../../db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const { provider, apiKey, model } = await readBody(event)

  const existing = await db.query.aiSettings.findFirst({
    where: eq(aiSettings.userId, session.user.id)
  })

  // Preserve existing API key if none provided
  const finalApiKey = apiKey || existing?.apiKey || null

  const [result] = await db
    .insert(aiSettings)
    .values({
      userId: session.user.id,
      provider,
      apiKey: finalApiKey,
      model: model || null
    })
    .onConflictDoUpdate({
      target: aiSettings.userId,
      set: {
        provider,
        apiKey: finalApiKey,
        model: model || null,
        updatedAt: new Date()
      }
    })
    .returning()

  return { provider: result.provider, model: result.model, hasApiKey: !!result.apiKey }
})
