export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  const { description } = await readBody(event)

  if (!description?.trim()) {
    throw createError({ statusCode: 400, message: 'Description is required' })
  }

  const provider = await getAIProvider(session.user.id)
  try {
    return await provider.analyzeText(description)
  } catch (err: unknown) {
    throw createError({ statusCode: 500, message: extractProviderError(err, provider.providerName) })
  }
})
