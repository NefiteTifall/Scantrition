// ── Criterion scoring functions (per 100g) ──────────────────────────

/**
 * Square-root curve clamped to 0–100: more = better.
 * sqrt makes the curve forgiving for moderate values (5g protein → 45 instead of 20)
 * while still scoring 0 for truly absent nutrients (0g protein → 0).
 * Used for "positive" criteria (protein, fiber, carbs).
 */
function positiveScore(value: number, max: number): number {
  if (value <= 0) return 0
  return Math.min(100, Math.sqrt(value / max) * 100)
}

/** Linear interpolation clamped to 0–100: less = better */
function negativeScore(value: number, threshold: number): number {
  return Math.max(0, Math.min(100, ((threshold - value) / threshold) * 100))
}

function proteinScore(protein: number): number {
  return positiveScore(protein, 25)
}

function proteinDensityScore(protein: number, calories: number): number {
  if (calories <= 0) return protein > 0 ? 100 : 0
  const ratio = (protein / calories) * 100
  return positiveScore(ratio, 20)
}

function fiberScore(fiber: number): number {
  return positiveScore(fiber, 8)
}

function carbsScore(carbs: number): number {
  return positiveScore(carbs, 50)
}

function sugarScore(sugar: number): number {
  return negativeScore(sugar, 15)
}

function saltScore(salt: number): number {
  return negativeScore(salt, 2)
}

function saturatedFatScore(saturatedFat: number): number {
  return negativeScore(saturatedFat, 10)
}

function caloricDensityScore(calories: number): number {
  return negativeScore(calories, 400)
}

function novaScore(novaGroup: number | null | undefined): number {
  if (novaGroup == null) return 50
  if (novaGroup <= 1) return 100
  if (novaGroup === 2) return 66
  if (novaGroup === 3) return 33
  return 0
}

// ── Goal weights ────────────────────────────────────────────────────

type CriterionKey = 'protein' | 'proteinDensity' | 'fiber' | 'carbs' | 'sugar' | 'salt' | 'saturatedFat' | 'caloricDensity' | 'nova'

const GOAL_WEIGHTS: Record<string, Partial<Record<CriterionKey, number>>> = {
  muscle: {
    protein: 0.35,
    proteinDensity: 0.35,
    sugar: 0.20,
    salt: 0.05,
    nova: 0.05
  },
  weightloss: {
    caloricDensity: 0.25,
    protein: 0.20,
    fiber: 0.20,
    sugar: 0.25,
    nova: 0.10
  },
  healthy: {
    fiber: 0.20,
    sugar: 0.25,
    salt: 0.20,
    saturatedFat: 0.20,
    nova: 0.15
  },
  performance: {
    carbs: 0.30,
    protein: 0.20,
    sugar: 0.15,
    salt: 0.10,
    fiber: 0.10,
    nova: 0.15
  },
  balance: {
    protein: 0.15,
    fiber: 0.15,
    sugar: 0.20,
    salt: 0.15,
    saturatedFat: 0.15,
    nova: 0.20
  }
}

// ── Main function ───────────────────────────────────────────────────

export interface NutritionScoreBreakdown {
  key: CriterionKey
  score: number
  weight: number
  contribution: number
}

export interface NutritionScoreResult {
  score: number
  label: 'excellent' | 'good' | 'limit' | 'avoid'
  breakdown: NutritionScoreBreakdown[]
}

export function calcNutritionScore(item: {
  calories: number, protein: number, carbs: number, fat: number,
  fiber?: number, sugar?: number, saturatedFat?: number, salt?: number,
  novaGroup?: number | null
}, healthGoal: string): NutritionScoreResult {
  const weights = GOAL_WEIGHTS[healthGoal] ?? GOAL_WEIGHTS.balance!

  // Compute all criterion scores
  const scores: Record<CriterionKey, number> = {
    protein: proteinScore(item.protein),
    proteinDensity: proteinDensityScore(item.protein, item.calories),
    fiber: fiberScore(item.fiber ?? 0),
    carbs: carbsScore(item.carbs),
    sugar: sugarScore(item.sugar ?? 0),
    salt: saltScore(item.salt ?? 0),
    saturatedFat: saturatedFatScore(item.saturatedFat ?? 0),
    caloricDensity: caloricDensityScore(item.calories),
    nova: novaScore(item.novaGroup)
  }

  // Weighted average using only the criteria relevant to this goal
  const breakdown: NutritionScoreBreakdown[] = []
  let total = 0

  for (const [key, weight] of Object.entries(weights) as [CriterionKey, number][]) {
    const s = scores[key]
    const contribution = s * weight
    total += contribution
    breakdown.push({ key, score: Math.round(s), weight, contribution: Math.round(contribution * 10) / 10 })
  }

  const score = Math.max(0, Math.min(100, Math.round(total)))

  let label: 'excellent' | 'good' | 'limit' | 'avoid'
  if (score >= 75) label = 'excellent'
  else if (score >= 50) label = 'good'
  else if (score >= 25) label = 'limit'
  else label = 'avoid'

  return { score, label, breakdown }
}
