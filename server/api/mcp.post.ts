import { createEventStream } from 'h3'
import { requireAuth } from '../utils/apiAuth'
import { getAIProvider, extractProviderError } from '../utils/ai'
import { createMCPSession, getMCPSession, purgeExpiredSessions } from '../utils/mcpSessions'
import { db } from '../db'
import { meals, userGoals, weightEntries, favoriteMeals } from '../db/schema'
import { eq, sql, desc, and } from 'drizzle-orm'

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
    description: 'Get the user\'s daily nutrition goals (calories, protein, carbs, fat targets).',
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
    description: 'Update the user\'s daily nutrition goals. All fields are optional — only provided fields will be updated.',
    inputSchema: {
      type: 'object',
      properties: {
        calories: { type: 'number', description: 'Daily calorie goal (kcal)' },
        protein: { type: 'number', description: 'Daily protein goal (g)' },
        carbs: { type: 'number', description: 'Daily carbs goal (g)' },
        fat: { type: 'number', description: 'Daily fat goal (g)' }
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
    return goals ?? { calories: 2000, protein: 150, carbs: 250, fat: 70 }
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
        fat: acc.fat + m.totalFat
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    )
    return {
      date: today,
      consumed: {
        calories: Math.round(consumed.calories),
        protein: Math.round(consumed.protein * 10) / 10,
        carbs: Math.round(consumed.carbs * 10) / 10,
        fat: Math.round(consumed.fat * 10) / 10
      },
      goals: g,
      remaining: {
        calories: Math.max(0, g.calories - Math.round(consumed.calories)),
        protein: Math.max(0, Math.round((g.protein - consumed.protein) * 10) / 10),
        carbs: Math.max(0, Math.round((g.carbs - consumed.carbs) * 10) / 10),
        fat: Math.max(0, Math.round((g.fat - consumed.fat) * 10) / 10)
      },
      meals: dayMeals.map(m => ({
        id: m.id,
        type: m.type,
        items: m.items,
        calories: Math.round(m.totalCalories),
        protein: Math.round(m.totalProtein * 10) / 10,
        carbs: Math.round(m.totalCarbs * 10) / 10,
        fat: Math.round(m.totalFat * 10) / 10,
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
        mealCount: sql<number>`COUNT(*)`
      })
      .from(meals)
      .where(sql`${meals.userId} = ${userId} AND ${meals.date} >= ${sinceStr}`)
      .groupBy(meals.date)
      .orderBy(desc(meals.date))
    return { days: data, count: data.length, period: `Last ${days} days` }
  }

  if (name === 'set_goals') {
    const update: Record<string, number> = {}
    if (args.calories !== undefined) update.calories = Math.round(Number(args.calories))
    if (args.protein !== undefined) update.protein = Math.round(Number(args.protein))
    if (args.carbs !== undefined) update.carbs = Math.round(Number(args.carbs))
    if (args.fat !== undefined) update.fat = Math.round(Number(args.fat))
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
    const provider = await getAIProvider(userId)
    try {
      const result = await provider.analyzeText(description)
      await db.insert(meals).values({
        userId,
        date: today,
        type: 'text',
        mealCategory,
        items: result.items,
        totalCalories: result.totalCalories,
        totalProtein: result.totalProtein,
        totalCarbs: result.totalCarbs,
        totalFat: result.totalFat,
        confidence: result.confidence
      })
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
          fat: Math.round(data.reduce((s, d) => s + d.fat, 0) / daysWithData * 10) / 10
        }
      : { calories: 0, protein: 0, carbs: 0, fat: 0 }
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
    const favorites = await db.query.favoriteMeals.findMany({ where: eq(favoriteMeals.userId, userId) })
    return { favorites: favorites.map(f => ({ id: f.id, name: f.name, calories: Math.round(f.totalCalories), protein: Math.round(f.totalProtein * 10) / 10, carbs: Math.round(f.totalCarbs * 10) / 10, fat: Math.round(f.totalFat * 10) / 10, items: f.items })) }
  }

  if (name === 'log_favorite') {
    const favoriteId = String(args.favorite_id ?? '')
    if (!favoriteId) throw new Error('favorite_id is required')
    const fav = await db.query.favoriteMeals.findFirst({ where: and(eq(favoriteMeals.id, favoriteId), eq(favoriteMeals.userId, userId)) })
    if (!fav) throw new Error('Favorite meal not found or does not belong to you')
    const validCategories = ['breakfast', 'lunch', 'snack', 'dinner']
    const mealCategory = validCategories.includes(String(args.meal_category ?? ''))
      ? String(args.meal_category) as 'breakfast' | 'lunch' | 'snack' | 'dinner'
      : null
    const [logged] = await db.insert(meals).values({
      userId,
      date: today,
      type: 'favorite',
      mealCategory,
      label: fav.name,
      items: fav.items,
      totalCalories: fav.totalCalories,
      totalProtein: fav.totalProtein,
      totalCarbs: fav.totalCarbs,
      totalFat: fav.totalFat,
      confidence: 1
    }).returning()
    if (!logged) throw new Error('Failed to log favorite meal')
    return { logged: true, meal_id: logged.id, name: fav.name, calories: Math.round(fav.totalCalories) }
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

            const provider = await getAIProvider(userId!)

            await eventStream.push({
              data: JSON.stringify({
                jsonrpc: '2.0',
                method: 'notifications/progress',
                params: { progressToken: String(id), progress: 1, total: 3, message: `Analysing with ${provider.providerName}...` }
              })
            })

            let result
            try {
              result = await provider.analyzeText(description)
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
            await db.insert(meals).values({
              userId: userId!,
              date: today,
              type: 'text',
              mealCategory: sseCategory,
              items: result.items,
              totalCalories: result.totalCalories,
              totalProtein: result.totalProtein,
              totalCarbs: result.totalCarbs,
              totalFat: result.totalFat,
              confidence: result.confidence
            })

            await eventStream.push({
              data: JSON.stringify({
                jsonrpc: '2.0',
                id,
                result: {
                  content: [{
                    type: 'text',
                    text: JSON.stringify({
                      logged: true,
                      summary: `${Math.round(result.totalCalories)} kcal · P${Math.round(result.totalProtein)}g · G${Math.round(result.totalCarbs)}g · L${Math.round(result.totalFat)}g`,
                      items: result.items,
                      totals: {
                        calories: Math.round(result.totalCalories),
                        protein: Math.round(result.totalProtein * 10) / 10,
                        carbs: Math.round(result.totalCarbs * 10) / 10,
                        fat: Math.round(result.totalFat * 10) / 10
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
