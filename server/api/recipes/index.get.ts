import { db } from '../../db'
import { recipes, recipeProducts, products } from '../../db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)

  const recipeRows = await db
    .select()
    .from(recipes)
    .where(eq(recipes.userId, session.user.id))

  if (recipeRows.length === 0) return []

  // Fetch all recipe_products with product data
  const allRp = await db
    .select({
      recipeId: recipeProducts.recipeId,
      id: recipeProducts.id,
      productId: recipeProducts.productId,
      quantityGrams: recipeProducts.quantityGrams,
      order: recipeProducts.order,
      productName: products.name,
      productCalories: products.calories,
      productProtein: products.protein,
      productCarbs: products.carbs,
      productFat: products.fat,
      productFiber: products.fiber,
      productImage: products.image
    })
    .from(recipeProducts)
    .innerJoin(products, eq(recipeProducts.productId, products.id))
    .where(eq(products.userId, session.user.id))

  const rpByRecipe = new Map<string, typeof allRp>()
  for (const rp of allRp) {
    const list = rpByRecipe.get(rp.recipeId) ?? []
    list.push(rp)
    rpByRecipe.set(rp.recipeId, list)
  }

  return recipeRows.map(recipe => {
    const rps = rpByRecipe.get(recipe.id) ?? []
    const totalWeight = rps.reduce((s, rp) => s + rp.quantityGrams, 0)
    const factor = totalWeight > 0 ? 100 / totalWeight : 0
    return {
      ...recipe,
      ingredients: rps.sort((a, b) => a.order - b.order),
      nutrition100g: {
        calories: Math.round(rps.reduce((s, rp) => s + rp.productCalories * rp.quantityGrams / 100, 0) * factor),
        protein: Math.round(rps.reduce((s, rp) => s + rp.productProtein * rp.quantityGrams / 100, 0) * factor * 10) / 10,
        carbs: Math.round(rps.reduce((s, rp) => s + rp.productCarbs * rp.quantityGrams / 100, 0) * factor * 10) / 10,
        fat: Math.round(rps.reduce((s, rp) => s + rp.productFat * rp.quantityGrams / 100, 0) * factor * 10) / 10,
        fiber: Math.round(rps.reduce((s, rp) => s + (rp.productFiber ?? 0) * rp.quantityGrams / 100, 0) * factor * 10) / 10
      },
      totalWeightGrams: totalWeight
    }
  })
})
