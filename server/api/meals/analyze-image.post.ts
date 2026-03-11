const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
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

  const provider = await getAIProvider(session.user.id)
  try {
    return await provider.analyzeImage(image, mimeType)
  } catch (err: unknown) {
    throw createError({ statusCode: 500, message: extractProviderError(err, provider.providerName) })
  }
})
