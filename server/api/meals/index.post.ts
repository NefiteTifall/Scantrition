import { db } from '../../db'
import { meals, mealItems, userGoals } from '../../db/schema'
import { upsertProduct } from '../../utils/products'
import { eq } from 'drizzle-orm'

function calcNutritionScore(item: {
  calories: number, protein: number, carbs: number, fat: number,
  fiber?: number, sugar?: number, saturatedFat?: number, salt?: number
}, healthGoal: string): { score: number, label: 'excellent' | 'good' | 'limit' | 'avoid' } {
  // Score 0–100 based on health goal
  let score = 50

  if (healthGoal === 'muscle') {
    score += Math.min(item.protein / 30 * 20, 20)
    score += Math.min(item.calories / 600 * 10, 10)
    score -= Math.min((item.sugar ?? 0) / 20 * 10, 10)
    score -= Math.min((item.salt ?? 0) / 2 * 10, 10)
  } else if (healthGoal === 'weightloss') {
    score -= Math.min(item.calories / 500 * 20, 20)
    score += Math.min(item.protein / 25 * 15, 15)
    score += Math.min((item.fiber ?? 0) / 8 * 10, 10)
    score -= Math.min((item.sugar ?? 0) / 15 * 15, 15)
  } else if (healthGoal === 'healthy') {
    score += Math.min((item.fiber ?? 0) / 6 * 15, 15)
    score -= Math.min((item.sugar ?? 0) / 15 * 15, 15)
    score -= Math.min((item.salt ?? 0) / 1.5 * 10, 10)
    score -= Math.min((item.saturatedFat ?? 0) / 5 * 10, 10)
  } else if (healthGoal === 'performance') {
    score += Math.min(item.carbs / 50 * 15, 15)
    score += Math.min(item.calories / 500 * 10, 10)
    score += Math.min(item.protein / 20 * 10, 10)
    score -= Math.min((item.salt ?? 0) / 2 * 10, 10)
  } else {
    // balance
    score += Math.min((item.fiber ?? 0) / 5 * 10, 10)
    score -= Math.min((item.sugar ?? 0) / 20 * 10, 10)
    score -= Math.min((item.salt ?? 0) / 2 * 10, 10)
    score -= Math.min((item.saturatedFat ?? 0) / 5 * 10, 10)
  }

  score = Math.max(0, Math.min(100, Math.round(score)))

  let label: 'excellent' | 'good' | 'limit' | 'avoid'
  if (score >= 75) label = 'excellent'
  else if (score >= 50) label = 'good'
  else if (score >= 25) label = 'limit'
  else label = 'avoid'

  return { score, label }
}

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  const body = await readBody(event)

  if (!body.date || !body.type || !body.items) {
    throw createError({ statusCode: 400, message: 'Missing required fields' })
  }

  // Get user health goal for nutrition scoring
  const [goalsRow] = await db.select().from(userGoals).where(eq(userGoals.userId, session.user.id)).limit(1)
  const healthGoal = goalsRow?.healthGoal ?? 'balance'

  const source = body.type === 'barcode' ? 'barcode'
    : body.type === 'search' ? 'search'
    : body.type === 'photo' ? 'photo'
    : 'ai'

  // Insert meal first
  const [meal] = await db
    .insert(meals)
    .values({
      userId: session.user.id,
      date: body.date,
      type: body.type,
      mealCategory: body.mealCategory ?? null,
      label: body.label ?? null,
      totalCalories: Math.round(body.totalCalories),
      totalProtein: Math.round(body.totalProtein * 10) / 10,
      totalCarbs: Math.round(body.totalCarbs * 10) / 10,
      totalFat: Math.round(body.totalFat * 10) / 10,
      totalFiber: body.totalFiber != null ? Math.round(body.totalFiber * 10) / 10 : 0,
      totalSugar: body.totalSugar != null ? Math.round(body.totalSugar * 10) / 10 : 0,
      totalSaturatedFat: body.totalSaturatedFat != null ? Math.round(body.totalSaturatedFat * 10) / 10 : 0,
      totalSalt: body.totalSalt != null ? Math.round(body.totalSalt * 100) / 100 : 0,
      nutriScore: body.nutriScore ?? null,
      healthScore: body.healthScore != null ? Math.round(body.healthScore) : null,
      healthLabel: body.healthLabel ?? null,
      confidence: body.confidence ?? 1,
      source: body.source ?? null
    })
    .returning()

  // Insert meal_items
  type BodyItem = {
    productId?: string
    recipeId?: string
    name: string
    quantity: string
    quantityGrams?: number
    calories: number
    protein: number
    carbs: number
    fat: number
    fiber?: number
    sugar?: number
    saturatedFat?: number
    salt?: number
  }

  await Promise.all(
    (body.items as BodyItem[]).map(async (item) => {
      let productId: string | null = item.productId ?? null

      if (!productId && !item.recipeId) {
        // Normalize nutrition to per-100g before storing in products table.
        // MealItem values are totals for the portion (e.g. 636 kcal for 600g),
        // but products.calories must always be per-100g (e.g. 106 kcal/100g).
        const qg = item.quantityGrams && item.quantityGrams > 0 ? item.quantityGrams : 100
        const to100g = (v: number) => Math.round(v * 100 / qg * 10) / 10

        productId = await upsertProduct({
          userId: session.user.id,
          name: item.name,
          barcode: body.productBarcode ?? null,
          brand: body.productBrand ?? null,
          image: body.productImage ?? null,
          source,
          servingSize: body.productServingSize ?? item.quantity,
          calories: Math.round(to100g(item.calories)),
          protein: to100g(item.protein),
          carbs: to100g(item.carbs),
          fat: to100g(item.fat),
          fiber: item.fiber != null ? to100g(item.fiber) : null,
          sugar: item.sugar != null ? to100g(item.sugar) : null,
          saturatedFat: item.saturatedFat != null ? to100g(item.saturatedFat) : null,
          salt: item.salt != null ? to100g(item.salt) : null,
          monounsaturatedFat: body.productMonounsaturatedFat ?? null,
          polyunsaturatedFat: body.productPolyunsaturatedFat ?? null,
          transFat: body.productTransFat ?? null,
          omega3Fat: body.productOmega3Fat ?? null,
          omega6Fat: body.productOmega6Fat ?? null,
          cholesterol: body.productCholesterol ?? null,
          sodium: body.productSodium ?? null,
          potassium: body.productPotassium ?? null,
          calcium: body.productCalcium ?? null,
          iron: body.productIron ?? null,
          magnesium: body.productMagnesium ?? null,
          zinc: body.productZinc ?? null,
          phosphorus: body.productPhosphorus ?? null,
          iodine: body.productIodine ?? null,
          selenium: body.productSelenium ?? null,
          vitaminA: body.productVitaminA ?? null,
          vitaminC: body.productVitaminC ?? null,
          vitaminD: body.productVitaminD ?? null,
          vitaminE: body.productVitaminE ?? null,
          vitaminB1: body.productVitaminB1 ?? null,
          vitaminB2: body.productVitaminB2 ?? null,
          vitaminB3: body.productVitaminB3 ?? null,
          vitaminB6: body.productVitaminB6 ?? null,
          vitaminB9: body.productVitaminB9 ?? null,
          vitaminB12: body.productVitaminB12 ?? null,
          caffeine: body.productCaffeine ?? null,
          alcohol: body.productAlcohol ?? null,
          nutriScore: body.nutriScore ?? null,
          novaGroup: body.productNovaGroup ?? null,
          nutriscoreScore: body.productNutriscoreScore ?? null,
          origins: body.productOrigins ?? null,
          quantity: body.productQuantity ?? null,
          categoriesFr: body.productCategoriesFr ?? null,
          ingredients: body.productIngredients ?? null,
          labelsTags: body.productLabelsTags ?? null,
          additivesTags: body.productAdditivesTags ?? null,
          fattyAcids: body.productFattyAcids ?? null,
          sugarsDetail: body.productSugarsDetail ?? null,
          aminoAcids: body.productAminoAcids ?? null,
          mineralsDetail: body.productMineralsDetail ?? null
        })
      }

      const { score, label } = calcNutritionScore({
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat,
        fiber: item.fiber,
        sugar: item.sugar,
        saturatedFat: item.saturatedFat,
        salt: item.salt
      }, healthGoal)

      const qg = item.quantityGrams
        ?? (item.quantity?.match(/(\d+(?:\.\d+)?)\s*g/i)?.[1] ? parseFloat(item.quantity.match(/(\d+(?:\.\d+)?)\s*g/i)![1]) : null)

      await db.insert(mealItems).values({
        mealId: meal.id,
        productId: productId ?? null,
        recipeId: item.recipeId ?? null,
        name: item.name,
        quantityText: item.quantity,
        quantityGrams: qg ?? null,
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat,
        fiber: item.fiber ?? null,
        sugar: item.sugar ?? null,
        saturatedFat: item.saturatedFat ?? null,
        salt: item.salt ?? null,
        nutritionScore: score,
        healthLabel: label
      })
    })
  )

  // Return meal with items
  const items = await db.select().from(mealItems).where(eq(mealItems.mealId, meal.id))
  return { ...meal, items }
})
