import { db } from '../../db'
import { meals } from '../../db/schema'
import { eq, asc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)

  const rows = await db.query.meals.findMany({
    where: eq(meals.userId, session.user.id),
    orderBy: [asc(meals.date), asc(meals.createdAt)]
  })

  const headers = ['date', 'time', 'type', 'items', 'calories', 'protein_g', 'carbs_g', 'fat_g', 'confidence']
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`

  const lines = [
    headers.join(','),
    ...rows.map((m) => {
      const time = new Date(m.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      const itemsStr = m.items.map(i => `${i.name} (${i.quantity})`).join(' + ')
      return [
        m.date,
        time,
        m.type,
        escape(itemsStr),
        Math.round(m.totalCalories),
        Math.round(m.totalProtein * 10) / 10,
        Math.round(m.totalCarbs * 10) / 10,
        Math.round(m.totalFat * 10) / 10,
        m.confidence ?? 1
      ].join(',')
    })
  ]

  setHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
  setHeader(event, 'Content-Disposition', `attachment; filename="scantrition-${new Date().toISOString().split('T')[0]}.csv"`)
  return lines.join('\n')
})
