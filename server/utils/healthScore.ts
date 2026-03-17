export function calcNutritionScore(item: {
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
