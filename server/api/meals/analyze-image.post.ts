import { db } from '../../db'
import { userGoals } from '../../db/schema'
import { eq } from 'drizzle-orm'

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  const { image, mimeType } = await readBody(event)

  if (!image || !mimeType) {
    throw createError({ statusCode: 400, message: 'Image and mimeType are required' })
  }
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw createError({ statusCode: 400, message: 'Unsupported image type. Use JPEG, PNG, WebP or GIF.' })
  }
  if (typeof image !== 'string' || image.length > 10 * 1024 * 1024) {
    throw createError({ statusCode: 400, message: 'Image too large (max 10MB base64)' })
  }

  const goals = await db.query.userGoals.findFirst({ where: eq(userGoals.userId, session.user.id) })
  const healthGoal = goals?.healthGoal ?? 'balance'

  const provider = await getAIProvider(session.user.id)
  try {
    return await provider.analyzeImage(image, mimeType, healthGoal)
  } catch (err: unknown) {
    throw createError({ statusCode: 500, message: extractProviderError(err, provider.providerName) })
  }
})
