import { db } from '../../db'
import { recipes, recipeProducts, products } from '../../db/schema'
import { and, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  const id = getRouterParam(event, 'id')!

  const [recipe] = await db
    .select()
    .from(recipes)
    .where(and(eq(recipes.id, id), eq(recipes.userId, session.user.id)))
    .limit(1)

  if (!recipe) throw createError({ statusCode: 404, message: 'Recipe not found' })

  const rps = await db
    .select({
      id: recipeProducts.id,
      productId: recipeProducts.productId,
      quantityGrams: recipeProducts.quantityGrams,
      order: recipeProducts.order,
      name: products.name,
      brand: products.brand,
      image: products.image,
      calories: products.calories,
      protein: products.protein,
      carbs: products.carbs,
      fat: products.fat,
      fiber: products.fiber,
      sugar: products.sugar,
      saturatedFat: products.saturatedFat,
      salt: products.salt,
      servingSize: products.servingSize
    })
    .from(recipeProducts)
    .innerJoin(products, eq(recipeProducts.productId, products.id))
    .where(eq(recipeProducts.recipeId, id))

  const sorted = rps.sort((a, b) => a.order - b.order)
  const totalWeight = sorted.reduce((s, rp) => s + rp.quantityGrams, 0)
  const factor = totalWeight > 0 ? 100 / totalWeight : 0

  return {
    ...recipe,
    ingredients: sorted,
    totalWeightGrams: totalWeight,
    nutrition100g: {
      calories: Math.round(sorted.reduce((s, rp) => s + rp.calories * rp.quantityGrams / 100, 0) * factor),
      protein: Math.round(sorted.reduce((s, rp) => s + rp.protein * rp.quantityGrams / 100, 0) * factor * 10) / 10,
      carbs: Math.round(sorted.reduce((s, rp) => s + rp.carbs * rp.quantityGrams / 100, 0) * factor * 10) / 10,
      fat: Math.round(sorted.reduce((s, rp) => s + rp.fat * rp.quantityGrams / 100, 0) * factor * 10) / 10,
      fiber: Math.round(sorted.reduce((s, rp) => s + (rp.fiber ?? 0) * rp.quantityGrams / 100, 0) * factor * 10) / 10,
      sugar: Math.round(sorted.reduce((s, rp) => s + (rp.sugar ?? 0) * rp.quantityGrams / 100, 0) * factor * 10) / 10,
      saturatedFat: Math.round(sorted.reduce((s, rp) => s + (rp.saturatedFat ?? 0) * rp.quantityGrams / 100, 0) * factor * 10) / 10,
      salt: Math.round(sorted.reduce((s, rp) => s + (rp.salt ?? 0) * rp.quantityGrams / 100, 0) * factor * 100) / 100
    }
  }
})
