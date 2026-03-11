import { pgTable, text, real, integer, jsonb, timestamp, uuid, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

export interface MealItem {
  name: string
  quantity: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber?: number
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
  type: text('type', { enum: ['text', 'photo', 'barcode', 'search', 'favorite'] }).notNull(),
  mealCategory: text('meal_category', { enum: ['breakfast', 'lunch', 'snack', 'dinner'] }),
  label: text('label'),
  items: jsonb('items').notNull().$type<MealItem[]>(),
  totalCalories: real('total_calories').notNull(),
  totalProtein: real('total_protein').notNull(),
  totalCarbs: real('total_carbs').notNull(),
  totalFat: real('total_fat').notNull(),
  confidence: real('confidence').default(1),
  source: text('source'),
  createdAt: timestamp('created_at').defaultNow().notNull()
}, t => [
  index('meals_user_date_idx').on(t.userId, t.date)
])

export const userGoals = pgTable('user_goals', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  calories: integer('calories').notNull().default(2000),
  protein: integer('protein').notNull().default(150),
  carbs: integer('carbs').notNull().default(250),
  fat: integer('fat').notNull().default(70),
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

export const favoriteMeals = pgTable('favorite_meals', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  items: jsonb('items').notNull().$type<MealItem[]>(),
  totalCalories: real('total_calories').notNull(),
  totalProtein: real('total_protein').notNull(),
  totalCarbs: real('total_carbs').notNull(),
  totalFat: real('total_fat').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
})

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
  id: text('id').primaryKey(), // UUID string returned to client as MCP-Session-Id
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  protocolVersion: text('protocol_version').notNull().default('2025-11-25'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastUsedAt: timestamp('last_used_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull()
})

export const weightEntriesRelations = relations(weightEntries, ({ one }) => ({
  user: one(users, { fields: [weightEntries.userId], references: [users.id] })
}))

export const usersRelations = relations(users, ({ many, one }) => ({
  meals: many(meals),
  goals: one(userGoals),
  aiSettings: one(aiSettings),
  favoriteMeals: many(favoriteMeals),
  weightEntries: many(weightEntries),
  apiKeys: many(userApiKeys),
  oauthAccessTokens: many(oauthAccessTokens),
  oauthRefreshTokens: many(oauthRefreshTokens),
  mcpSessions: many(mcpSessions)
}))

export const mealsRelations = relations(meals, ({ one }) => ({
  user: one(users, { fields: [meals.userId], references: [users.id] })
}))

export const userGoalsRelations = relations(userGoals, ({ one }) => ({
  user: one(users, { fields: [userGoals.userId], references: [users.id] })
}))

export const aiSettingsRelations = relations(aiSettings, ({ one }) => ({
  user: one(users, { fields: [aiSettings.userId], references: [users.id] })
}))

export const favoriteMealsRelations = relations(favoriteMeals, ({ one }) => ({
  user: one(users, { fields: [favoriteMeals.userId], references: [users.id] })
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
