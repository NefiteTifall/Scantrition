import { db } from '../../db'
import { recipes, recipeProducts } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  const body = await readBody(event)

  if (!body.name) {
    throw createError({ statusCode: 400, message: 'Recipe name is required' })
  }

  const [recipe] = await db
    .insert(recipes)
    .values({
      userId: session.user.id,
      name: body.name,
      description: body.description ?? null
    })
    .returning()

  if (body.ingredients?.length) {
    await db.insert(recipeProducts).values(
      body.ingredients.map((ing: { productId: string, quantityGrams: number }, i: number) => ({
        recipeId: recipe.id,
        productId: ing.productId,
        quantityGrams: ing.quantityGrams,
        order: i
      }))
    )
  }

  return recipe
})
