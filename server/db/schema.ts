import { pgTable, text, real, integer, jsonb, timestamp, uuid, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

export interface MealItemIngredient {
  text: string
  vegan?: string
  vegetarian?: string
  percent?: number | null
}

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
})

export const meals = pgTable('meals', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  type: text('type', { enum: ['text', 'photo', 'barcode', 'search', 'favorite', 'recipe'] }).notNull(),
  mealCategory: text('meal_category', { enum: ['breakfast', 'lunch', 'snack', 'dinner'] }),
  label: text('label'),
  totalCalories: real('total_calories').notNull(),
  totalProtein: real('total_protein').notNull(),
  totalCarbs: real('total_carbs').notNull(),
  totalFat: real('total_fat').notNull(),
  totalFiber: real('total_fiber').default(0),
  totalSugar: real('total_sugar').default(0),
  totalSaturatedFat: real('total_saturated_fat').default(0),
  totalSalt: real('total_salt').default(0),
  nutriScore: text('nutri_score', { enum: ['A', 'B', 'C', 'D', 'E'] }),
  healthScore: integer('health_score'),
  healthLabel: text('health_label', { enum: ['excellent', 'good', 'limit', 'avoid'] }),
  confidence: real('confidence').default(1),
  source: text('source'),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, t => [
  index('meals_user_date_idx').on(t.userId, t.date)
])

export const mealItems = pgTable('meal_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  mealId: uuid('meal_id').notNull().references(() => meals.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
  recipeId: uuid('recipe_id').references(() => recipes.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  quantityText: text('quantity_text').notNull().default('100g'),
  quantityGrams: real('quantity_grams'),
  calories: real('calories').notNull().default(0),
  protein: real('protein').notNull().default(0),
  carbs: real('carbs').notNull().default(0),
  fat: real('fat').notNull().default(0),
  fiber: real('fiber'),
  sugar: real('sugar'),
  saturatedFat: real('saturated_fat'),
  salt: real('salt'),
  nutritionScore: integer('nutrition_score'),
  healthLabel: text('health_label', { enum: ['excellent', 'good', 'limit', 'avoid'] }),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, t => [
  index('meal_items_meal_idx').on(t.mealId)
])

export const userGoals = pgTable('user_goals', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  calories: integer('calories').notNull().default(2000),
  protein: integer('protein').notNull().default(150),
  carbs: integer('carbs').notNull().default(250),
  fat: integer('fat').notNull().default(70),
  fiber: integer('fiber').notNull().default(25),
  healthGoal: text('health_goal', { enum: ['muscle', 'healthy', 'weightloss', 'performance', 'balance'] }).notNull().default('balance'),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
})

export const aiSettings = pgTable('ai_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull().default('gemini'),
  apiKey: text('api_key'),
  model: text('model'),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
})

export const userFavoriteProducts = pgTable('user_favorite_products', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, t => [
  index('user_fav_products_user_idx').on(t.userId)
])

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  barcode: text('barcode'),
  brand: text('brand'),
  image: text('image'),
  source: text('source', { enum: ['barcode', 'search', 'ai', 'photo', 'recipe'] }).notNull().default('ai'),
  servingSize: text('serving_size'),
  calories: real('calories').notNull(),
  protein: real('protein').notNull(),
  carbs: real('carbs').notNull(),
  fat: real('fat').notNull(),
  fiber: real('fiber'),
  sugar: real('sugar'),
  saturatedFat: real('saturated_fat'),
  salt: real('salt'),
  // Extended fats
  monounsaturatedFat: real('monounsaturated_fat'),
  polyunsaturatedFat: real('polyunsaturated_fat'),
  transFat: real('trans_fat'),
  omega3Fat: real('omega3_fat'),
  omega6Fat: real('omega6_fat'),
  cholesterol: real('cholesterol'),
  // Minerals
  sodium: real('sodium'),
  potassium: real('potassium'),
  calcium: real('calcium'),
  iron: real('iron'),
  magnesium: real('magnesium'),
  zinc: real('zinc'),
  phosphorus: real('phosphorus'),
  iodine: real('iodine'),
  selenium: real('selenium'),
  // Vitamins
  vitaminA: real('vitamin_a'),
  vitaminC: real('vitamin_c'),
  vitaminD: real('vitamin_d'),
  vitaminE: real('vitamin_e'),
  vitaminB1: real('vitamin_b1'),
  vitaminB2: real('vitamin_b2'),
  vitaminB3: real('vitamin_b3'),
  vitaminB6: real('vitamin_b6'),
  vitaminB9: real('vitamin_b9'),
  vitaminB12: real('vitamin_b12'),
  // Other
  caffeine: real('caffeine'),
  alcohol: real('alcohol'),
  // Nutri-score & metadata
  nutriScore: text('nutri_score', { enum: ['A', 'B', 'C', 'D', 'E'] }),
  novaGroup: integer('nova_group'),
  nutriscoreScore: integer('nutriscore_score'),
  origins: text('origins'),
  quantity: text('quantity'),
  categoriesFr: text('categories_fr'),
  // JSONB: product metadata
  ingredients: jsonb('ingredients').$type<MealItemIngredient[]>(),
  labelsTags: jsonb('labels_tags').$type<string[]>(),
  additivesTags: jsonb('additives_tags').$type<string[]>(),
  // JSONB: niche nutrient details
  fattyAcids: jsonb('fatty_acids').$type<Record<string, number>>(),
  sugarsDetail: jsonb('sugars_detail').$type<Record<string, number>>(),
  aminoAcids: jsonb('amino_acids').$type<Record<string, number>>(),
  mineralsDetail: jsonb('minerals_detail').$type<Record<string, number>>(),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, t => [
  index('products_user_idx').on(t.userId),
  index('products_barcode_idx').on(t.barcode),
  index('products_user_slug_idx').on(t.userId, t.slug)
])

export const recipes = pgTable('recipes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, t => [
  index('recipes_user_idx').on(t.userId)
])

export const recipeProducts = pgTable('recipe_products', {
  id: uuid('id').primaryKey().defaultRandom(),
  recipeId: uuid('recipe_id').notNull().references(() => recipes.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  quantityGrams: real('quantity_grams').notNull(),
  order: integer('order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, t => [
  index('recipe_products_recipe_idx').on(t.recipeId)
])

export const weightEntries = pgTable('weight_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  weight: real('weight').notNull(),
  date: text('date').notNull(),
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow().notNull()
})

export const userApiKeys = pgTable('user_api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  keyHash: text('key_hash').notNull().unique(),
  prefix: text('prefix').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastUsedAt: timestamp('last_used_at')
})

export const oauthClients = pgTable('oauth_clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: text('client_id').notNull().unique(),
  clientSecret: text('client_secret'),
  name: text('name').notNull(),
  redirectUris: jsonb('redirect_uris').notNull().$type<string[]>(),
  scope: text('scope').default('mcp'),
  createdAt: timestamp('created_at').defaultNow().notNull()
})

export const oauthAuthorizationCodes = pgTable('oauth_authorization_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  clientId: text('client_id').notNull(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  redirectUri: text('redirect_uri').notNull(),
  scope: text('scope').default('mcp'),
  codeChallenge: text('code_challenge'),
  codeChallengeMethod: text('code_challenge_method'),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at')
})

export const oauthAccessTokens = pgTable('oauth_access_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  tokenHash: text('token_hash').notNull().unique(),
  clientId: text('client_id').notNull(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  scope: text('scope').default('mcp'),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  revokedAt: timestamp('revoked_at')
})

export const oauthRefreshTokens = pgTable('oauth_refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  tokenHash: text('token_hash').notNull().unique(),
  clientId: text('client_id').notNull(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accessTokenId: uuid('access_token_id').references(() => oauthAccessTokens.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  revokedAt: timestamp('revoked_at')
})

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at')
})

export const mcpSessions = pgTable('mcp_sessions', {
  id: text('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  protocolVersion: text('protocol_version').notNull().default('2025-11-25'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastUsedAt: timestamp('last_used_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull()
})

// Relations
export const weightEntriesRelations = relations(weightEntries, ({ one }) => ({
  user: one(users, { fields: [weightEntries.userId], references: [users.id] })
}))

export const productsRelations = relations(products, ({ one, many }) => ({
  user: one(users, { fields: [products.userId], references: [users.id] }),
  recipeProducts: many(recipeProducts),
  mealItems: many(mealItems)
}))

export const recipesRelations = relations(recipes, ({ one, many }) => ({
  user: one(users, { fields: [recipes.userId], references: [users.id] }),
  recipeProducts: many(recipeProducts),
  mealItems: many(mealItems)
}))

export const recipeProductsRelations = relations(recipeProducts, ({ one }) => ({
  recipe: one(recipes, { fields: [recipeProducts.recipeId], references: [recipes.id] }),
  product: one(products, { fields: [recipeProducts.productId], references: [products.id] })
}))

export const mealItemsRelations = relations(mealItems, ({ one }) => ({
  meal: one(meals, { fields: [mealItems.mealId], references: [meals.id] }),
  product: one(products, { fields: [mealItems.productId], references: [products.id] }),
  recipe: one(recipes, { fields: [mealItems.recipeId], references: [recipes.id] })
}))

export const usersRelations = relations(users, ({ many, one }) => ({
  meals: many(meals),
  goals: one(userGoals),
  aiSettings: one(aiSettings),
  favoriteProducts: many(userFavoriteProducts),
  weightEntries: many(weightEntries),
  apiKeys: many(userApiKeys),
  oauthAccessTokens: many(oauthAccessTokens),
  oauthRefreshTokens: many(oauthRefreshTokens),
  mcpSessions: many(mcpSessions),
  products: many(products),
  recipes: many(recipes)
}))

export const mealsRelations = relations(meals, ({ one, many }) => ({
  user: one(users, { fields: [meals.userId], references: [users.id] }),
  items: many(mealItems)
}))

export const userGoalsRelations = relations(userGoals, ({ one }) => ({
  user: one(users, { fields: [userGoals.userId], references: [users.id] })
}))

export const aiSettingsRelations = relations(aiSettings, ({ one }) => ({
  user: one(users, { fields: [aiSettings.userId], references: [users.id] })
}))

export const userFavoriteProductsRelations = relations(userFavoriteProducts, ({ one }) => ({
  user: one(users, { fields: [userFavoriteProducts.userId], references: [users.id] }),
  product: one(products, { fields: [userFavoriteProducts.productId], references: [products.id] })
}))

export const userApiKeysRelations = relations(userApiKeys, ({ one }) => ({
  user: one(users, { fields: [userApiKeys.userId], references: [users.id] })
}))

export const oauthAccessTokensRelations = relations(oauthAccessTokens, ({ one }) => ({
  user: one(users, { fields: [oauthAccessTokens.userId], references: [users.id] })
}))

export const oauthRefreshTokensRelations = relations(oauthRefreshTokens, ({ one }) => ({
  user: one(users, { fields: [oauthRefreshTokens.userId], references: [users.id] }),
  accessToken: one(oauthAccessTokens, { fields: [oauthRefreshTokens.accessTokenId], references: [oauthAccessTokens.id] })
}))

export const mcpSessionsRelations = relations(mcpSessions, ({ one }) => ({
  user: one(users, { fields: [mcpSessions.userId], references: [users.id] })
}))

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, { fields: [passwordResetTokens.userId], references: [users.id] })
}))
