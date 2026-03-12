import { db } from '../../db'
import { recipes, recipeProducts } from '../../db/schema'
import { and, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)

  const [recipe] = await db
    .select({ id: recipes.id })
    .from(recipes)
    .where(and(eq(recipes.id, id), eq(recipes.userId, session.user.id)))
    .limit(1)

  if (!recipe) throw createError({ statusCode: 404, message: 'Recipe not found' })

  await db.update(recipes).set({
    name: body.name,
    description: body.description ?? null
  }).where(eq(recipes.id, id))

  if (body.ingredients !== undefined) {
    await db.delete(recipeProducts).where(eq(recipeProducts.recipeId, id))
    if (body.ingredients.length > 0) {
      await db.insert(recipeProducts).values(
        body.ingredients.map((ing: { productId: string, quantityGrams: number }, i: number) => ({
          recipeId: id,
          productId: ing.productId,
          quantityGrams: ing.quantityGrams,
          order: i
        }))
      )
    }
  }

  return { success: true }
})
