import { db } from '../../db'
import { meals } from '../../db/schema'
import { upsertProduct } from '../../utils/products'

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  const body = await readBody(event)

  if (!body.date || !body.type || !body.items) {
    throw createError({ statusCode: 400, message: 'Missing required fields' })
  }

  const source = body.type === 'barcode' ? 'barcode' : body.type === 'search' ? 'search' : body.type === 'photo' ? 'photo' : 'ai'

  const itemsWithProductIds = await Promise.all(
    (body.items as Array<{
      productId?: string
      name: string
      quantity: string
      calories: number
      protein: number
      carbs: number
      fat: number
      fiber?: number
      sugar?: number
      saturatedFat?: number
      salt?: number
    }>).map(async (item) => {
      if (item.productId) return item
      const productId = await upsertProduct({
        userId: session.user.id,
        name: item.name,
        barcode: body.productBarcode ?? null,
        brand: body.productBrand ?? null,
        image: body.productImage ?? null,
        source,
        servingSize: item.quantity,
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat,
        fiber: item.fiber ?? null,
        sugar: item.sugar ?? null,
        saturatedFat: item.saturatedFat ?? null,
        salt: item.salt ?? null,
        nutriScore: body.nutriScore ?? null
      })
      return { ...item, productId }
    })
  )

  const [meal] = await db
    .insert(meals)
    .values({
      userId: session.user.id,
      date: body.date,
      type: body.type,
      mealCategory: body.mealCategory ?? null,
      label: body.label ?? null,
      items: itemsWithProductIds,
      totalCalories: Math.round(body.totalCalories),
      totalProtein: Math.round(body.totalProtein * 10) / 10,
      totalCarbs: Math.round(body.totalCarbs * 10) / 10,
      totalFat: Math.round(body.totalFat * 10) / 10,
      totalFiber: body.totalFiber != null ? Math.round(body.totalFiber * 10) / 10 : 0,
      totalSugar: body.totalSugar != null ? Math.round(body.totalSugar * 10) / 10 : 0,
      totalSaturatedFat: body.totalSaturatedFat != null ? Math.round(body.totalSaturatedFat * 10) / 10 : 0,
      totalSalt: body.totalSalt != null ? Math.round(body.totalSalt * 10) / 10 : 0,
      nutriScore: body.nutriScore ?? null,
      healthScore: body.healthScore != null ? Math.round(body.healthScore) : null,
      healthLabel: body.healthLabel ?? null,
      confidence: body.confidence ?? 1,
      source: body.source ?? null
    })
    .returning()

  return meal
})
