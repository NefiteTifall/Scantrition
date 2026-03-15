import { createEventStream } from 'h3'
import { requireAuth } from '../utils/apiAuth'
import { getAIProvider, extractProviderError } from '../utils/ai'
import { createMCPSession, getMCPSession, purgeExpiredSessions } from '../utils/mcpSessions'
import { db } from '../db'
import { meals, mealItems, userGoals, weightEntries, userFavoriteProducts, products, recipes, recipeProducts } from '../db/schema'
import { eq, sql, desc, and, inArray, ilike, or } from 'drizzle-orm'

const MCP_VERSION = '2025-11-25'

const TOOLS = [
  {
    name: 'get_today',
    description: 'Get today\'s full nutrition summary: calories and macros consumed vs goals, plus the list of meals logged.',
    inputSchema: { type: 'object', properties: {} },
    annotations: {
      title: 'Today\'s Summary',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  {
    name: 'get_history',
    description: 'Get daily nutrition summaries for the last N days (default 7, max 30).',
    inputSchema: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Number of days to fetch (default 7, max 30)' }
      }
    },
    annotations: {
      title: 'Nutrition History',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  {
    name: 'get_goals',
    description: 'Get the user\'s daily nutrition goals (calories, protein, carbs, fat, fiber targets) and their health goal (muscle/healthy/weightloss/performance/balance).',
    inputSchema: { type: 'object', properties: {} },
    annotations: {
      title: 'Daily Goals',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  {
    name: 'set_goals',
    description: 'Update the user\'s daily nutrition goals and/or health goal. All fields are optional — only provided fields will be updated.',
    inputSchema: {
      type: 'object',
      properties: {
        calories: { type: 'number', description: 'Daily calorie goal (kcal)' },
        protein: { type: 'number', description: 'Daily protein goal (g)' },
        carbs: { type: 'number', description: 'Daily carbs goal (g)' },
        fat: { type: 'number', description: 'Daily fat goal (g)' },
        fiber: { type: 'number', description: 'Daily fiber goal (g, default 25)' },
        health_goal: {
          type: 'string',
          enum: ['muscle', 'healthy', 'weightloss', 'performance', 'balance'],
          description: 'Health goal that adjusts the meal health score: muscle (high protein), healthy (fiber/low sugar), weightloss (low cal), performance (high carbs), balance (general)'
        }
      }
    },
    annotations: {
      title: 'Set Daily Goals',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  {
    name: 'log_meal',
    description: 'Log a meal from a text description using AI analysis. Returns the full nutrition breakdown and saves it to the journal.',
    inputSchema: {
      type: 'object',
      properties: {
        description: {
          type: 'string',
          description: 'Natural language meal description (e.g. "bowl of oatmeal with banana and honey")'
        },
        meal_category: {
          type: 'string',
          enum: ['breakfast', 'lunch', 'snack', 'dinner'],
          description: 'Meal category (optional)'
        }
      },
      required: ['description']
    },
    annotations: {
      title: 'Log a Meal',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true
    }
  },
  {
    name: 'delete_meal',
    description: 'Delete a meal from the journal by its ID. Use get_today to find meal IDs.',
    inputSchema: {
      type: 'object',
      properties: {
        meal_id: { type: 'string', description: 'The UUID of the meal to delete' }
      },
      required: ['meal_id']
    },
    annotations: {
      title: 'Delete a Meal',
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  {
    name: 'get_date',
    description: 'Get the current date and day of the week in the server\'s timezone.',
    inputSchema: { type: 'object', properties: {} },
    annotations: {
      title: 'Get Current Date',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false
    }
  },
  {
    name: 'get_weekly_summary',
    description: 'Get a weekly nutrition summary with daily averages and totals for the past 7 days.',
    inputSchema: { type: 'object', properties: {} },
    annotations: {
      title: 'Weekly Summary',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  {
    name: 'log_weight',
    description: 'Log the user\'s body weight for today (or a specific date).',
    inputSchema: {
      type: 'object',
      properties: {
        weight: { type: 'number', description: 'Weight value (kg)' },
        date: { type: 'string', description: 'Date in YYYY-MM-DD format (defaults to today)' },
        note: { type: 'string', description: 'Optional note (e.g. "after workout")' }
      },
      required: ['weight']
    },
    annotations: {
      title: 'Log Weight',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false
    }
  },
  {
    name: 'suggest_meal',
    description: 'Ask the AI to suggest a meal based on remaining daily calories/macros and optional preferences.',
    inputSchema: {
      type: 'object',
      properties: {
        preferences: { type: 'string', description: 'Optional meal preferences or constraints (e.g. "high protein", "vegetarian", "quick to prepare")' },
        meal_category: {
          type: 'string',
          enum: ['breakfast', 'lunch', 'snack', 'dinner'],
          description: 'Meal category to suggest for (optional)'
        }
      }
    },
    annotations: {
      title: 'Suggest a Meal',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true
    }
  },
  {
    name: 'get_favorite_meals',
    description: 'Get the user\'s saved favorite meals list.',
    inputSchema: { type: 'object', properties: {} },
    annotations: {
      title: 'Favorite Meals',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  {
    name: 'log_favorite',
    description: 'Log a saved favorite meal to today\'s journal.',
    inputSchema: {
      type: 'object',
      properties: {
        favorite_id: { type: 'string', description: 'The UUID of the favorite meal to log' },
        meal_category: {
          type: 'string',
          enum: ['breakfast', 'lunch', 'snack', 'dinner'],
          description: 'Meal category to assign (optional)'
        }
      },
      required: ['favorite_id']
    },
    annotations: {
      title: 'Log Favorite Meal',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false
    }
  },
  {
    name: 'search_products',
    description: 'Search products in the user\'s database by name or brand. Returns matching products with their nutrition info (per 100g).',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query (min 2 characters) — matches product name or brand' }
      },
      required: ['query']
    },
    annotations: {
      title: 'Search Products',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  {
    name: 'get_recipes',
    description: 'Get the user\'s saved recipes with their ingredients and nutrition info (per 100g).',
    inputSchema: { type: 'object', properties: {} },
    annotations: {
      title: 'My Recipes',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  {
    name: 'create_recipe',
    description: 'Create a new recipe from a list of product ingredients. Each ingredient references a product by its ID and specifies a quantity in grams. Use search_products first to find product IDs.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Recipe name (e.g. "Salade niçoise")' },
        description: { type: 'string', description: 'Optional recipe description' },
        ingredients: {
          type: 'array',
          description: 'List of ingredients with product IDs and quantities',
          items: {
            type: 'object',
            properties: {
              product_id: { type: 'string', description: 'UUID of the product (use search_products to find)' },
              quantity_grams: { type: 'number', description: 'Quantity in grams' }
            },
            required: ['product_id', 'quantity_grams']
          }
        }
      },
      required: ['name', 'ingredients']
    },
    annotations: {
      title: 'Create Recipe',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false
    }
  },
  {
    name: 'log_recipe',
    description: 'Log a recipe to today\'s journal with a specified portion size in grams. Nutrition is calculated proportionally from the recipe\'s per-100g values.',
    inputSchema: {
      type: 'object',
      properties: {
        recipe_id: { type: 'string', description: 'UUID of the recipe to log (use get_recipes to find)' },
        portion_grams: { type: 'number', description: 'Portion size in grams (e.g. 300 for a 300g serving)' },
        meal_category: {
          type: 'string',
          enum: ['breakfast', 'lunch', 'snack', 'dinner'],
          description: 'Meal category (optional)'
        }
      },
      required: ['recipe_id', 'portion_grams']
    },
    annotations: {
      title: 'Log Recipe',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false
    }
  }
]

function getBaseUrl(event: Parameters<typeof getHeader>[0]): string {
  const host = getHeader(event, 'host') ?? 'localhost:3000'
  const proto = getHeader(event, 'x-forwarded-proto')
    ?? (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https')
  return `${proto}://${host}`
}

async function executeTool(name: string, args: Record<string, unknown>, userId: string): Promise<unknown> {
  const today = new Date().toISOString().split('T')[0] ?? ''

  if (name === 'get_goals') {
    const goals = await db.query.userGoals.findFirst({ where: eq(userGoals.userId, userId) })
    const g = goals ?? { calories: 2000, protein: 150, carbs: 250, fat: 70, healthGoal: 'balance' }
    return g
  }

  if (name === 'get_today') {
    const [goals, dayMeals] = await Promise.all([
      db.query.userGoals.findFirst({ where: eq(userGoals.userId, userId) }),
      db.query.meals.findMany({
        where: sql`${meals.userId} = ${userId} AND ${meals.date} = ${today}`
      })
    ])
    const g = goals ?? { calories: 2000, protein: 150, carbs: 250, fat: 70 }
    const consumed = dayMeals.reduce(
      (acc, m) => ({
        calories: acc.calories + m.totalCalories,
        protein: acc.protein + m.totalProtein,
        carbs: acc.carbs + m.totalCarbs,
        fat: acc.fat + m.totalFat,
        fiber: acc.fiber + (m.totalFiber ?? 0),
        sugar: acc.sugar + (m.totalSugar ?? 0),
        saturatedFat: acc.saturatedFat + (m.totalSaturatedFat ?? 0),
        salt: acc.salt + (m.totalSalt ?? 0)
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, saturatedFat: 0, salt: 0 }
    )
    // Fetch meal_items for all today's meals
    const mealIds = dayMeals.map(m => m.id)
    const allItems = mealIds.length
      ? await db.select().from(mealItems).where(inArray(mealItems.mealId, mealIds))
      : []
    const itemsByMeal = new Map<string, typeof allItems>()
    for (const item of allItems) {
      if (!itemsByMeal.has(item.mealId)) itemsByMeal.set(item.mealId, [])
      itemsByMeal.get(item.mealId)!.push(item)
    }
    return {
      date: today,
      consumed: {
        calories: Math.round(consumed.calories),
        protein: Math.round(consumed.protein * 10) / 10,
        carbs: Math.round(consumed.carbs * 10) / 10,
        fat: Math.round(consumed.fat * 10) / 10,
        fiber: Math.round(consumed.fiber * 10) / 10,
        sugar: Math.round(consumed.sugar * 10) / 10,
        saturatedFat: Math.round(consumed.saturatedFat * 10) / 10,
        salt: Math.round(consumed.salt * 10) / 10
      },
      goals: g,
      remaining: {
        calories: Math.max(0, g.calories - Math.round(consumed.calories)),
        protein: Math.max(0, Math.round((g.protein - consumed.protein) * 10) / 10),
        carbs: Math.max(0, Math.round((g.carbs - consumed.carbs) * 10) / 10),
        fat: Math.max(0, Math.round((g.fat - consumed.fat) * 10) / 10),
        fiber: Math.max(0, Math.round(((g.fiber ?? 25) - consumed.fiber) * 10) / 10)
      },
      meals: dayMeals.map(m => ({
        id: m.id,
        type: m.type,
        mealCategory: m.mealCategory,
        nutriScore: m.nutriScore,
        healthScore: m.healthScore,
        healthLabel: m.healthLabel,
        items: (itemsByMeal.get(m.id) ?? []).map(i => ({ name: i.name, quantity: i.quantityText, calories: i.calories, protein: i.protein, carbs: i.carbs, fat: i.fat })),
        calories: Math.round(m.totalCalories),
        protein: Math.round(m.totalProtein * 10) / 10,
        carbs: Math.round(m.totalCarbs * 10) / 10,
        fat: Math.round(m.totalFat * 10) / 10,
        fiber: Math.round((m.totalFiber ?? 0) * 10) / 10,
        sugar: Math.round((m.totalSugar ?? 0) * 10) / 10,
        saturatedFat: Math.round((m.totalSaturatedFat ?? 0) * 10) / 10,
        salt: Math.round((m.totalSalt ?? 0) * 10) / 10,
        loggedAt: m.createdAt
      }))
    }
  }

  if (name === 'get_history') {
    const days = Math.min(Number(args.days) || 7, 30)
    const since = new Date()
    since.setDate(since.getDate() - days)
    const sinceStr = since.toISOString().split('T')[0]
    const data = await db
      .select({
        date: meals.date,
        calories: sql<number>`ROUND(SUM(${meals.totalCalories}))`,
        protein: sql<number>`ROUND(SUM(${meals.totalProtein})::numeric, 1)`,
        carbs: sql<number>`ROUND(SUM(${meals.totalCarbs})::numeric, 1)`,
        fat: sql<number>`ROUND(SUM(${meals.totalFat})::numeric, 1)`,
        fiber: sql<number>`ROUND(SUM(COALESCE(${meals.totalFiber}, 0))::numeric, 1)`,
        sugar: sql<number>`ROUND(SUM(COALESCE(${meals.totalSugar}, 0))::numeric, 1)`,
        saturatedFat: sql<number>`ROUND(SUM(COALESCE(${meals.totalSaturatedFat}, 0))::numeric, 1)`,
        salt: sql<number>`ROUND(SUM(COALESCE(${meals.totalSalt}, 0))::numeric, 1)`,
        mealCount: sql<number>`COUNT(*)`
      })
      .from(meals)
      .where(sql`${meals.userId} = ${userId} AND ${meals.date} >= ${sinceStr}`)
      .groupBy(meals.date)
      .orderBy(desc(meals.date))
    return { days: data, count: data.length, period: `Last ${days} days` }
  }

  if (name === 'set_goals') {
    const update: Record<string, number | string> = {}
    if (args.calories !== undefined) update.calories = Math.round(Number(args.calories))
    if (args.protein !== undefined) update.protein = Math.round(Number(args.protein))
    if (args.carbs !== undefined) update.carbs = Math.round(Number(args.carbs))
    if (args.fat !== undefined) update.fat = Math.round(Number(args.fat))
    if (args.fiber !== undefined) update.fiber = Math.round(Number(args.fiber))
    const validHealthGoals = ['muscle', 'healthy', 'weightloss', 'performance', 'balance']
    if (args.health_goal !== undefined && validHealthGoals.includes(String(args.health_goal))) {
      update.healthGoal = String(args.health_goal)
    }
    if (!Object.keys(update).length) throw new Error('Provide at least one goal to update')

    const existing = await db.query.userGoals.findFirst({ where: eq(userGoals.userId, userId) })
    if (existing) {
      await db.update(userGoals).set({ ...update, updatedAt: new Date() }).where(eq(userGoals.userId, userId))
    } else {
      await db.insert(userGoals).values({ userId, calories: 2000, protein: 150, carbs: 250, fat: 70, ...update })
    }
    const updated = await db.query.userGoals.findFirst({ where: eq(userGoals.userId, userId) })
    return { updated: true, goals: updated }
  }

  if (name === 'delete_meal') {
    const mealId = String(args.meal_id ?? '')
    if (!mealId) throw new Error('meal_id is required')
    const deleted = await db.delete(meals).where(and(eq(meals.id, mealId), eq(meals.userId, userId))).returning()
    if (!deleted.length) throw new Error('Meal not found or does not belong to you')
    return { deleted: true, meal_id: mealId }
  }

  if (name === 'log_meal') {
    const description = String(args.description ?? '')
    if (!description) throw new Error('description is required')
    const validCategories = ['breakfast', 'lunch', 'snack', 'dinner']
    const mealCategory = validCategories.includes(String(args.meal_category ?? ''))
      ? String(args.meal_category) as 'breakfast' | 'lunch' | 'snack' | 'dinner'
      : null
    const [provider, goalsForMeal] = await Promise.all([
      getAIProvider(userId),
      db.query.userGoals.findFirst({ where: eq(userGoals.userId, userId) })
    ])
    const healthGoalForMeal = goalsForMeal?.healthGoal ?? 'balance'
    try {
      const result = await provider.analyzeText(description, healthGoalForMeal)
      const [meal] = await db.insert(meals).values({
        userId,
        date: today,
        type: 'text',
        mealCategory,
        totalCalories: result.totalCalories,
        totalProtein: result.totalProtein,
        totalCarbs: result.totalCarbs,
        totalFat: result.totalFat,
        totalFiber: result.totalFiber ?? 0,
        totalSugar: result.totalSugar ?? 0,
        totalSaturatedFat: result.totalSaturatedFat ?? 0,
        totalSalt: result.totalSalt ?? 0,
        nutriScore: result.nutriScore ?? null,
        healthScore: result.healthScore ?? null,
        healthLabel: result.healthLabel ?? null,
        confidence: result.confidence
      }).returning()
      if (meal && result.items?.length) {
        await db.insert(mealItems).values(
          result.items.map((item: { name: string, quantity: string, calories: number, protein: number, carbs: number, fat: number, fiber?: number, sugar?: number, saturatedFat?: number, salt?: number }) => ({
            mealId: meal.id,
            name: item.name,
            quantityText: item.quantity,
            quantityGrams: item.quantity?.match(/(\d+(?:\.\d+)?)\s*g/i)?.[1] ? parseFloat(item.quantity.match(/(\d+(?:\.\d+)?)\s*g/i)![1]) : null,
            calories: item.calories,
            protein: item.protein,
            carbs: item.carbs,
            fat: item.fat,
            fiber: item.fiber ?? null,
            sugar: item.sugar ?? null,
            saturatedFat: item.saturatedFat ?? null,
            salt: item.salt ?? null
          }))
        )
      }
      return { logged: true, result }
    } catch (err) {
      throw new Error(extractProviderError(err, provider.providerName))
    }
  }

  if (name === 'get_date') {
    const now = new Date()
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    return {
      date: today,
      dayOfWeek: weekdays[now.getDay()],
      isoString: now.toISOString()
    }
  }

  if (name === 'get_weekly_summary') {
    const since = new Date()
    since.setDate(since.getDate() - 6)
    const sinceStr = since.toISOString().split('T')[0]
    const [data, goals] = await Promise.all([
      db.select({
        date: meals.date,
        calories: sql<number>`ROUND(SUM(${meals.totalCalories}))`,
        protein: sql<number>`ROUND(SUM(${meals.totalProtein})::numeric, 1)`,
        carbs: sql<number>`ROUND(SUM(${meals.totalCarbs})::numeric, 1)`,
        fat: sql<number>`ROUND(SUM(${meals.totalFat})::numeric, 1)`,
        fiber: sql<number>`ROUND(SUM(COALESCE(${meals.totalFiber}, 0))::numeric, 1)`,
        sugar: sql<number>`ROUND(SUM(COALESCE(${meals.totalSugar}, 0))::numeric, 1)`,
        saturatedFat: sql<number>`ROUND(SUM(COALESCE(${meals.totalSaturatedFat}, 0))::numeric, 1)`,
        salt: sql<number>`ROUND(SUM(COALESCE(${meals.totalSalt}, 0))::numeric, 1)`,
        mealCount: sql<number>`COUNT(*)`
      })
        .from(meals)
        .where(sql`${meals.userId} = ${userId} AND ${meals.date} >= ${sinceStr}`)
        .groupBy(meals.date)
        .orderBy(desc(meals.date)),
      db.query.userGoals.findFirst({ where: eq(userGoals.userId, userId) })
    ])
    const g = goals ?? { calories: 2000, protein: 150, carbs: 250, fat: 70 }
    const daysWithData = data.length
    const avg = daysWithData
      ? {
          calories: Math.round(data.reduce((s, d) => s + d.calories, 0) / daysWithData),
          protein: Math.round(data.reduce((s, d) => s + d.protein, 0) / daysWithData * 10) / 10,
          carbs: Math.round(data.reduce((s, d) => s + d.carbs, 0) / daysWithData * 10) / 10,
          fat: Math.round(data.reduce((s, d) => s + d.fat, 0) / daysWithData * 10) / 10,
          fiber: Math.round(data.reduce((s, d) => s + (d.fiber ?? 0), 0) / daysWithData * 10) / 10
        }
      : { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
    return { period: `${sinceStr} → ${today}`, daysLogged: daysWithData, dailyAverage: avg, goals: g, days: data }
  }

  if (name === 'log_weight') {
    const weightVal = Number(args.weight)
    if (!weightVal || isNaN(weightVal)) throw new Error('weight is required and must be a number')
    const dateStr = String(args.date ?? today)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(dateStr)) throw new Error('date must be in YYYY-MM-DD format')
    const note = args.note ? String(args.note) : null
    const [entry] = await db.insert(weightEntries).values({
      userId,
      weight: weightVal,
      date: dateStr,
      note
    }).returning()
    if (!entry) throw new Error('Failed to log weight')
    return { logged: true, entry }
  }

  if (name === 'suggest_meal') {
    const [dayMeals, goals] = await Promise.all([
      db.query.meals.findMany({ where: sql`${meals.userId} = ${userId} AND ${meals.date} = ${today}` }),
      db.query.userGoals.findFirst({ where: eq(userGoals.userId, userId) })
    ])
    const g = goals ?? { calories: 2000, protein: 150, carbs: 250, fat: 70 }
    const consumed = dayMeals.reduce(
      (acc, m) => ({
        calories: acc.calories + m.totalCalories,
        protein: acc.protein + m.totalProtein,
        carbs: acc.carbs + m.totalCarbs,
        fat: acc.fat + m.totalFat
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    )
    const remaining = {
      calories: Math.max(0, g.calories - Math.round(consumed.calories)),
      protein: Math.max(0, Math.round((g.protein - consumed.protein) * 10) / 10),
      carbs: Math.max(0, Math.round((g.carbs - consumed.carbs) * 10) / 10),
      fat: Math.max(0, Math.round((g.fat - consumed.fat) * 10) / 10)
    }
    const category = args.meal_category ? `for ${args.meal_category}` : ''
    const preferences = args.preferences ? ` Preferences: ${args.preferences}.` : ''
    const prompt = `Suggest a healthy meal ${category} for someone with ${remaining.calories} kcal remaining today (protein: ${remaining.protein}g, carbs: ${remaining.carbs}g, fat: ${remaining.fat}g remaining).${preferences} Return a JSON object with: name, description, estimated_calories, estimated_protein, estimated_carbs, estimated_fat, and preparation_tips.`
    const provider = await getAIProvider(userId)
    try {
      const result = await provider.analyzeText(prompt)
      return { remaining, suggestion: result }
    } catch (err) {
      throw new Error(extractProviderError(err, provider.providerName))
    }
  }

  if (name === 'get_favorite_meals') {
    const rows = await db
      .select()
      .from(userFavoriteProducts)
      .innerJoin(products, eq(userFavoriteProducts.productId, products.id))
      .where(eq(userFavoriteProducts.userId, userId))
    return {
      favorites: rows.map(r => ({
        id: r.user_favorite_products.id,
        name: r.user_favorite_products.name,
        productId: r.products.id,
        calories: Math.round(r.products.calories),
        protein: Math.round(r.products.protein * 10) / 10,
        carbs: Math.round(r.products.carbs * 10) / 10,
        fat: Math.round(r.products.fat * 10) / 10,
        fiber: r.products.fiber != null ? Math.round(r.products.fiber * 10) / 10 : null,
        nutriScore: r.products.nutriScore
      }))
    }
  }

  if (name === 'log_favorite') {
    const favoriteId = String(args.favorite_id ?? '')
    if (!favoriteId) throw new Error('favorite_id is required')
    const rows = await db
      .select()
      .from(userFavoriteProducts)
      .innerJoin(products, eq(userFavoriteProducts.productId, products.id))
      .where(and(eq(userFavoriteProducts.id, favoriteId), eq(userFavoriteProducts.userId, userId)))
      .limit(1)
    const row = rows[0]
    if (!row) throw new Error('Favorite not found or does not belong to you')
    const p = row.products
    const favName = row.user_favorite_products.name
    const validCategories = ['breakfast', 'lunch', 'snack', 'dinner']
    const mealCategory = validCategories.includes(String(args.meal_category ?? ''))
      ? String(args.meal_category) as 'breakfast' | 'lunch' | 'snack' | 'dinner'
      : null
    const [logged] = await db.insert(meals).values({
      userId,
      date: today,
      type: 'favorite',
      mealCategory,
      label: favName,
      totalCalories: p.calories,
      totalProtein: p.protein,
      totalCarbs: p.carbs,
      totalFat: p.fat,
      totalFiber: p.fiber ?? 0,
      confidence: 1
    }).returning()
    if (!logged) throw new Error('Failed to log favorite')
    await db.insert(mealItems).values({
      mealId: logged.id,
      productId: p.id,
      name: p.name,
      quantityText: p.servingSize ?? '1 portion',
      quantityGrams: p.servingSize?.match(/(\d+(?:\.\d+)?)\s*g/i)?.[1] ? parseFloat(p.servingSize.match(/(\d+(?:\.\d+)?)\s*g/i)![1]) : null,
      calories: p.calories,
      protein: p.protein,
      carbs: p.carbs,
      fat: p.fat,
      fiber: p.fiber ?? null
    })
    return { logged: true, meal_id: logged.id, name: favName, calories: Math.round(p.calories) }
  }

  if (name === 'search_products') {
    const query = String(args.query ?? '').trim()
    if (query.length < 2) throw new Error('Query must be at least 2 characters')
    const results = await db
      .select({
        id: products.id,
        name: products.name,
        brand: products.brand,
        image: products.image,
        barcode: products.barcode,
        servingSize: products.servingSize,
        calories: products.calories,
        protein: products.protein,
        carbs: products.carbs,
        fat: products.fat,
        fiber: products.fiber,
        sugar: products.sugar,
        saturatedFat: products.saturatedFat,
        salt: products.salt,
        nutriScore: products.nutriScore,
        novaGroup: products.novaGroup
      })
      .from(products)
      .where(and(
        eq(products.userId, userId),
        or(
          ilike(products.name, `%${query}%`),
          ilike(products.brand, `%${query}%`)
        )
      ))
      .limit(20)
    return {
      query,
      count: results.length,
      products: results.map(p => ({
        ...p,
        calories: Math.round(p.calories),
        protein: Math.round(p.protein * 10) / 10,
        carbs: Math.round(p.carbs * 10) / 10,
        fat: Math.round(p.fat * 10) / 10,
        fiber: p.fiber != null ? Math.round(p.fiber * 10) / 10 : null,
        note: 'Nutrition values are per 100g'
      }))
    }
  }

  if (name === 'get_recipes') {
    const recipeRows = await db.select().from(recipes).where(eq(recipes.userId, userId))
    if (!recipeRows.length) return { recipes: [], count: 0 }

    const allRp = await db
      .select({
        recipeId: recipeProducts.recipeId,
        productId: recipeProducts.productId,
        quantityGrams: recipeProducts.quantityGrams,
        order: recipeProducts.order,
        productName: products.name,
        productCalories: products.calories,
        productProtein: products.protein,
        productCarbs: products.carbs,
        productFat: products.fat,
        productFiber: products.fiber
      })
      .from(recipeProducts)
      .innerJoin(products, eq(recipeProducts.productId, products.id))
      .where(eq(products.userId, userId))

    const rpByRecipe = new Map<string, typeof allRp>()
    for (const rp of allRp) {
      const list = rpByRecipe.get(rp.recipeId) ?? []
      list.push(rp)
      rpByRecipe.set(rp.recipeId, list)
    }

    return {
      count: recipeRows.length,
      recipes: recipeRows.map(recipe => {
        const rps = rpByRecipe.get(recipe.id) ?? []
        const totalWeight = rps.reduce((s, rp) => s + rp.quantityGrams, 0)
        const factor = totalWeight > 0 ? 100 / totalWeight : 0
        return {
          id: recipe.id,
          name: recipe.name,
          description: recipe.description,
          totalWeightGrams: totalWeight,
          ingredients: rps.sort((a, b) => a.order - b.order).map(rp => ({
            productId: rp.productId,
            name: rp.productName,
            quantityGrams: rp.quantityGrams
          })),
          nutrition100g: {
            calories: Math.round(rps.reduce((s, rp) => s + rp.productCalories * rp.quantityGrams / 100, 0) * factor),
            protein: Math.round(rps.reduce((s, rp) => s + rp.productProtein * rp.quantityGrams / 100, 0) * factor * 10) / 10,
            carbs: Math.round(rps.reduce((s, rp) => s + rp.productCarbs * rp.quantityGrams / 100, 0) * factor * 10) / 10,
            fat: Math.round(rps.reduce((s, rp) => s + rp.productFat * rp.quantityGrams / 100, 0) * factor * 10) / 10,
            fiber: Math.round(rps.reduce((s, rp) => s + (rp.productFiber ?? 0) * rp.quantityGrams / 100, 0) * factor * 10) / 10
          }
        }
      })
    }
  }

  if (name === 'create_recipe') {
    const recipeName = String(args.name ?? '').trim()
    if (!recipeName) throw new Error('name is required')
    const ingredients = args.ingredients as Array<{ product_id: string, quantity_grams: number }> | undefined
    if (!ingredients?.length) throw new Error('At least one ingredient is required')

    // Validate all product IDs belong to the user
    const productIds = ingredients.map(i => String(i.product_id))
    const foundProducts = await db
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(and(eq(products.userId, userId), inArray(products.id, productIds)))
    const foundIds = new Set(foundProducts.map(p => p.id))
    const missing = productIds.filter(id => !foundIds.has(id))
    if (missing.length) throw new Error(`Products not found: ${missing.join(', ')}. Use search_products to find valid product IDs.`)

    const [recipe] = await db.insert(recipes).values({
      userId,
      name: recipeName,
      description: args.description ? String(args.description) : null
    }).returning()
    if (!recipe) throw new Error('Failed to create recipe')

    await db.insert(recipeProducts).values(
      ingredients.map((ing, idx) => ({
        recipeId: recipe.id,
        productId: String(ing.product_id),
        quantityGrams: Number(ing.quantity_grams),
        order: idx
      }))
    )

    return {
      created: true,
      recipe_id: recipe.id,
      name: recipeName,
      ingredient_count: ingredients.length
    }
  }

  if (name === 'log_recipe') {
    const recipeId = String(args.recipe_id ?? '')
    if (!recipeId) throw new Error('recipe_id is required')
    const portionGrams = Number(args.portion_grams)
    if (!portionGrams || portionGrams <= 0) throw new Error('portion_grams must be a positive number')

    // Fetch recipe + ingredients
    const recipe = await db.query.recipes.findFirst({
      where: and(eq(recipes.id, recipeId), eq(recipes.userId, userId))
    })
    if (!recipe) throw new Error('Recipe not found or does not belong to you')

    const rps = await db
      .select({
        quantityGrams: recipeProducts.quantityGrams,
        productCalories: products.calories,
        productProtein: products.protein,
        productCarbs: products.carbs,
        productFat: products.fat,
        productFiber: products.fiber,
        productSugar: products.sugar,
        productSaturatedFat: products.saturatedFat,
        productSalt: products.salt
      })
      .from(recipeProducts)
      .innerJoin(products, eq(recipeProducts.productId, products.id))
      .where(eq(recipeProducts.recipeId, recipeId))

    if (!rps.length) throw new Error('Recipe has no ingredients')

    const totalWeight = rps.reduce((s, rp) => s + rp.quantityGrams, 0)
    const factor = totalWeight > 0 ? 100 / totalWeight : 0

    // Nutrition per 100g
    const n100 = {
      calories: rps.reduce((s, rp) => s + rp.productCalories * rp.quantityGrams / 100, 0) * factor,
      protein: rps.reduce((s, rp) => s + rp.productProtein * rp.quantityGrams / 100, 0) * factor,
      carbs: rps.reduce((s, rp) => s + rp.productCarbs * rp.quantityGrams / 100, 0) * factor,
      fat: rps.reduce((s, rp) => s + rp.productFat * rp.quantityGrams / 100, 0) * factor,
      fiber: rps.reduce((s, rp) => s + (rp.productFiber ?? 0) * rp.quantityGrams / 100, 0) * factor,
      sugar: rps.reduce((s, rp) => s + (rp.productSugar ?? 0) * rp.quantityGrams / 100, 0) * factor,
      saturatedFat: rps.reduce((s, rp) => s + (rp.productSaturatedFat ?? 0) * rp.quantityGrams / 100, 0) * factor,
      salt: rps.reduce((s, rp) => s + (rp.productSalt ?? 0) * rp.quantityGrams / 100, 0) * factor
    }

    // Scale to portion
    const m = portionGrams / 100
    const portion = {
      calories: Math.round(n100.calories * m),
      protein: Math.round(n100.protein * m * 10) / 10,
      carbs: Math.round(n100.carbs * m * 10) / 10,
      fat: Math.round(n100.fat * m * 10) / 10,
      fiber: Math.round(n100.fiber * m * 10) / 10,
      sugar: Math.round(n100.sugar * m * 10) / 10,
      saturatedFat: Math.round(n100.saturatedFat * m * 10) / 10,
      salt: Math.round(n100.salt * m * 100) / 100
    }

    const validCategories = ['breakfast', 'lunch', 'snack', 'dinner']
    const mealCategory = validCategories.includes(String(args.meal_category ?? ''))
      ? String(args.meal_category) as 'breakfast' | 'lunch' | 'snack' | 'dinner'
      : null

    const [logged] = await db.insert(meals).values({
      userId,
      date: today,
      type: 'recipe',
      mealCategory,
      totalCalories: portion.calories,
      totalProtein: portion.protein,
      totalCarbs: portion.carbs,
      totalFat: portion.fat,
      totalFiber: portion.fiber,
      totalSugar: portion.sugar,
      totalSaturatedFat: portion.saturatedFat,
      totalSalt: portion.salt,
      confidence: 1
    }).returning()
    if (!logged) throw new Error('Failed to log recipe')

    await db.insert(mealItems).values({
      mealId: logged.id,
      recipeId: recipe.id,
      name: recipe.name,
      quantityText: `${portionGrams}g`,
      quantityGrams: portionGrams,
      calories: portion.calories,
      protein: portion.protein,
      carbs: portion.carbs,
      fat: portion.fat,
      fiber: portion.fiber,
      sugar: portion.sugar,
      saturatedFat: portion.saturatedFat,
      salt: portion.salt
    })

    return {
      logged: true,
      meal_id: logged.id,
      recipe: recipe.name,
      portion: `${portionGrams}g`,
      calories: portion.calories,
      protein: portion.protein,
      carbs: portion.carbs,
      fat: portion.fat
    }
  }

  throw new Error(`Unknown tool: ${name}`)
}

export default defineEventHandler(async (event) => {
  const baseUrl = getBaseUrl(event)
  const mcpResource = `${baseUrl}/api/mcp`

  // Read body first so we have id for error responses
  const body = await readBody(event).catch(() => ({}))
  const { id, method, params } = body ?? {}

  // Authenticate
  let userId: string | null = null
  try {
    userId = await requireAuth(event)
  } catch {
    setResponseStatus(event, 401)
    setResponseHeader(event, 'WWW-Authenticate', `Bearer realm="${baseUrl}", resource="${mcpResource}"`)
    return { jsonrpc: '2.0', id, error: { code: -32000, message: 'Unauthorized' } }
  }

  // Protocol version
  const requestedVersion = getHeader(event, 'mcp-protocol-version') ?? '2025-03-26'
  setResponseHeader(event, 'MCP-Protocol-Version', MCP_VERSION)

  // Session management — validate if provided
  const sessionId = getHeader(event, 'mcp-session-id')
  if (sessionId && method !== 'initialize') {
    const session = await getMCPSession(sessionId)
    if (!session) {
      setResponseStatus(event, 404)
      return { jsonrpc: '2.0', id, error: { code: -32000, message: 'Session not found or expired — please re-initialize' } }
    }
    if (session.userId !== userId) {
      setResponseStatus(event, 403)
      return { jsonrpc: '2.0', id, error: { code: -32000, message: 'Forbidden' } }
    }
  }

  // Notifications (202, no body)
  if (typeof method === 'string' && method.startsWith('notifications/')) {
    setResponseStatus(event, 202)
    return null
  }

  // ping
  if (method === 'ping') {
    return { jsonrpc: '2.0', id, result: {} }
  }

  // initialize — create session + purge expired ones opportunistically
  if (method === 'initialize') {
    const [newSessionId] = await Promise.all([
      createMCPSession(userId, requestedVersion),
      purgeExpiredSessions()
    ])
    setResponseHeader(event, 'MCP-Session-Id', newSessionId)
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: MCP_VERSION,
        capabilities: {
          tools: { listChanged: false },
          logging: {}
        },
        serverInfo: { name: 'Scantrition', version: '1.0.0' }
      }
    }
  }

  // tools/list
  if (method === 'tools/list') {
    return { jsonrpc: '2.0', id, result: { tools: TOOLS } }
  }

  // tools/call
  if (method === 'tools/call') {
    const { name, arguments: args = {} } = params ?? {}

    // log_meal: stream SSE progress events during AI analysis
    if (name === 'log_meal') {
      const accept = getHeader(event, 'accept') ?? ''
      if (accept.includes('text/event-stream')) {
        const eventStream = createEventStream(event)
        const today = new Date().toISOString().split('T')[0] ?? ''

        void (async () => {
          try {
            const description = String(args.description ?? '')
            if (!description) throw new Error('description is required')

            await eventStream.push({
              data: JSON.stringify({
                jsonrpc: '2.0',
                method: 'notifications/progress',
                params: { progressToken: String(id), progress: 0, total: 3, message: 'Starting meal analysis...' }
              })
            })

            const [provider, goalsSSE] = await Promise.all([
              getAIProvider(userId!),
              db.query.userGoals.findFirst({ where: eq(userGoals.userId, userId!) })
            ])
            const healthGoalSSE = goalsSSE?.healthGoal ?? 'balance'

            await eventStream.push({
              data: JSON.stringify({
                jsonrpc: '2.0',
                method: 'notifications/progress',
                params: { progressToken: String(id), progress: 1, total: 3, message: `Analysing with ${provider.providerName}...` }
              })
            })

            let result
            try {
              result = await provider.analyzeText(description, healthGoalSSE)
            } catch (err) {
              throw new Error(extractProviderError(err, provider.providerName))
            }

            await eventStream.push({
              data: JSON.stringify({
                jsonrpc: '2.0',
                method: 'notifications/progress',
                params: { progressToken: String(id), progress: 2, total: 3, message: 'Saving to journal...' }
              })
            })

            const validCats = ['breakfast', 'lunch', 'snack', 'dinner']
            const sseCategory = validCats.includes(String(args.meal_category ?? ''))
              ? String(args.meal_category) as 'breakfast' | 'lunch' | 'snack' | 'dinner'
              : null
            const [sseMeal] = await db.insert(meals).values({
              userId: userId!,
              date: today,
              type: 'text',
              mealCategory: sseCategory,
              totalCalories: result.totalCalories,
              totalProtein: result.totalProtein,
              totalCarbs: result.totalCarbs,
              totalFat: result.totalFat,
              totalFiber: result.totalFiber ?? 0,
              totalSugar: result.totalSugar ?? 0,
              totalSaturatedFat: result.totalSaturatedFat ?? 0,
              totalSalt: result.totalSalt ?? 0,
              nutriScore: result.nutriScore ?? null,
              healthScore: result.healthScore ?? null,
              healthLabel: result.healthLabel ?? null,
              confidence: result.confidence
            }).returning()
            if (sseMeal && result.items?.length) {
              await db.insert(mealItems).values(
                result.items.map((item: { name: string, quantity: string, calories: number, protein: number, carbs: number, fat: number, fiber?: number, sugar?: number, saturatedFat?: number, salt?: number }) => ({
                  mealId: sseMeal.id,
                  name: item.name,
                  quantityText: item.quantity,
                  quantityGrams: item.quantity?.match(/(\d+(?:\.\d+)?)\s*g/i)?.[1] ? parseFloat(item.quantity.match(/(\d+(?:\.\d+)?)\s*g/i)![1]) : null,
                  calories: item.calories,
                  protein: item.protein,
                  carbs: item.carbs,
                  fat: item.fat,
                  fiber: item.fiber ?? null,
                  sugar: item.sugar ?? null,
                  saturatedFat: item.saturatedFat ?? null,
                  salt: item.salt ?? null
                }))
              )
            }

            await eventStream.push({
              data: JSON.stringify({
                jsonrpc: '2.0',
                id,
                result: {
                  content: [{
                    type: 'text',
                    text: JSON.stringify({
                      logged: true,
                      nutriScore: result.nutriScore ?? null,
                      healthScore: result.healthScore ?? null,
                      healthLabel: result.healthLabel ?? null,
                      summary: `${Math.round(result.totalCalories)} kcal · P${Math.round(result.totalProtein)}g · G${Math.round(result.totalCarbs)}g · L${Math.round(result.totalFat)}g · Fibres${Math.round((result.totalFiber ?? 0) * 10) / 10}g`,
                      items: result.items,
                      totals: {
                        calories: Math.round(result.totalCalories),
                        protein: Math.round(result.totalProtein * 10) / 10,
                        carbs: Math.round(result.totalCarbs * 10) / 10,
                        fat: Math.round(result.totalFat * 10) / 10,
                        fiber: Math.round((result.totalFiber ?? 0) * 10) / 10,
                        sugar: Math.round((result.totalSugar ?? 0) * 10) / 10,
                        saturatedFat: Math.round((result.totalSaturatedFat ?? 0) * 10) / 10,
                        salt: Math.round((result.totalSalt ?? 0) * 10) / 10
                      },
                      confidence: result.confidence,
                      date: today
                    }, null, 2)
                  }]
                }
              })
            })
          } catch (err) {
            await eventStream.push({
              data: JSON.stringify({
                jsonrpc: '2.0',
                id,
                result: {
                  content: [{ type: 'text', text: `Error: ${(err as Error).message}` }],
                  isError: true
                }
              })
            })
          } finally {
            await eventStream.close()
          }
        })()

        return eventStream.send()
      }
    }

    // All other tool calls: standard JSON response
    try {
      const result = await executeTool(name, args as Record<string, unknown>, userId)
      return {
        jsonrpc: '2.0',
        id,
        result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
      }
    } catch (err) {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [{ type: 'text', text: `Error: ${(err as Error).message}` }],
          isError: true
        }
      }
    }
  }

  return { jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } }
})
