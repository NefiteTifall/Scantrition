export interface Ingredient {
  text: string
  vegan?: string // 'yes' | 'no' | 'maybe'
  vegetarian?: string
  percent?: number | null
}

export interface MealItem {
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
  nutritionScore?: number
  healthLabel?: 'excellent' | 'good' | 'limit' | 'avoid'
}

export interface NutritionResult {
  items: MealItem[]
  // Core totals
  totalCalories: number
  totalProtein: number
  totalCarbs: number
  totalFat: number
  totalFiber?: number
  totalSugar?: number
  totalSaturatedFat?: number
  totalSalt?: number
  // Extended fats
  totalMonounsaturatedFat?: number
  totalPolyunsaturatedFat?: number
  totalTransFat?: number
  totalOmega3Fat?: number
  totalOmega6Fat?: number
  totalCholesterol?: number
  // Minerals
  totalSodium?: number
  totalPotassium?: number
  totalCalcium?: number
  totalIron?: number
  totalMagnesium?: number
  totalZinc?: number
  totalPhosphorus?: number
  totalIodine?: number
  totalSelenium?: number
  // Vitamins
  totalVitaminA?: number
  totalVitaminC?: number
  totalVitaminD?: number
  totalVitaminE?: number
  totalVitaminB1?: number
  totalVitaminB2?: number
  totalVitaminB3?: number
  totalVitaminB6?: number
  totalVitaminB9?: number
  totalVitaminB12?: number
  // Other
  totalCaffeine?: number
  totalAlcohol?: number
  // Scores
  nutriScore?: 'A' | 'B' | 'C' | 'D' | 'E'
  healthScore?: number
  healthLabel?: 'excellent' | 'good' | 'limit' | 'avoid'
  confidence: number
  // Product metadata
  productName?: string
  brand?: string
  image?: string
  barcode?: string
  servingSize?: string
  servingGrams?: number
  novaGroup?: number
  nutriscoreScore?: number
  origins?: string
  quantity?: string
  categoriesFr?: string
  ingredients?: Ingredient[]
  labelsTags?: string[]
  additivesTags?: string[]
  // JSONB niche details
  fattyAcids?: Record<string, number>
  sugarsDetail?: Record<string, number>
  aminoAcids?: Record<string, number>
  mineralsDetail?: Record<string, number>
}
