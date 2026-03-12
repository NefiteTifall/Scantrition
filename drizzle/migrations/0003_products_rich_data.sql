-- Products: new nutrition columns
ALTER TABLE "products" ADD COLUMN "monounsaturated_fat" real;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "polyunsaturated_fat" real;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "trans_fat" real;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "omega3_fat" real;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "omega6_fat" real;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "cholesterol" real;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "sodium" real;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "potassium" real;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "calcium" real;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "iron" real;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "magnesium" real;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "zinc" real;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "phosphorus" real;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "iodine" real;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "selenium" real;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "vitamin_a" real;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "vitamin_c" real;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "vitamin_d" real;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "vitamin_e" real;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "vitamin_b1" real;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "vitamin_b2" real;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "vitamin_b3" real;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "vitamin_b6" real;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "vitamin_b9" real;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "vitamin_b12" real;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "caffeine" real;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "alcohol" real;--> statement-breakpoint
-- Products: metadata columns
ALTER TABLE "products" ADD COLUMN "nova_group" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "nutriscore_score" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "origins" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "quantity" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "categories_fr" text;--> statement-breakpoint
-- Products: JSONB detail columns
ALTER TABLE "products" ADD COLUMN "ingredients" jsonb;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "labels_tags" jsonb;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "additives_tags" jsonb;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "fatty_acids" jsonb;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "sugars_detail" jsonb;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "amino_acids" jsonb;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "minerals_detail" jsonb;--> statement-breakpoint

-- New table: recipes
CREATE TABLE "recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recipes_user_idx" ON "recipes" USING btree ("user_id");--> statement-breakpoint

-- New table: recipe_products
CREATE TABLE "recipe_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity_grams" real NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recipe_products" ADD CONSTRAINT "recipe_products_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_products" ADD CONSTRAINT "recipe_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recipe_products_recipe_idx" ON "recipe_products" USING btree ("recipe_id");--> statement-breakpoint

-- New table: meal_items
CREATE TABLE "meal_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meal_id" uuid NOT NULL,
	"product_id" uuid,
	"recipe_id" uuid,
	"name" text NOT NULL,
	"quantity_text" text NOT NULL DEFAULT '100g',
	"quantity_grams" real,
	"calories" real NOT NULL DEFAULT 0,
	"protein" real NOT NULL DEFAULT 0,
	"carbs" real NOT NULL DEFAULT 0,
	"fat" real NOT NULL DEFAULT 0,
	"fiber" real,
	"sugar" real,
	"saturated_fat" real,
	"salt" real,
	"nutrition_score" integer,
	"health_label" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meal_items" ADD CONSTRAINT "meal_items_meal_id_meals_id_fk" FOREIGN KEY ("meal_id") REFERENCES "public"."meals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_items" ADD CONSTRAINT "meal_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_items" ADD CONSTRAINT "meal_items_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meal_items_meal_idx" ON "meal_items" USING btree ("meal_id");--> statement-breakpoint

-- Migrate existing meals.items JSONB → meal_items
INSERT INTO "meal_items" ("meal_id", "product_id", "name", "quantity_text", "quantity_grams", "calories", "protein", "carbs", "fat", "fiber", "sugar", "saturated_fat", "salt")
SELECT
  m.id AS meal_id,
  (item->>'productId')::uuid AS product_id,
  COALESCE(item->>'name', 'Unknown') AS name,
  COALESCE(item->>'quantity', '100g') AS quantity_text,
  CASE
    WHEN item->>'quantity' ~ '(\d+(?:\.\d+)?)\s*g' THEN (regexp_match(item->>'quantity', '(\d+(?:\.\d+)?)\s*g'))[1]::real
    ELSE NULL
  END AS quantity_grams,
  COALESCE((item->>'calories')::real, 0) AS calories,
  COALESCE((item->>'protein')::real, 0) AS protein,
  COALESCE((item->>'carbs')::real, 0) AS carbs,
  COALESCE((item->>'fat')::real, 0) AS fat,
  (item->>'fiber')::real AS fiber,
  (item->>'sugar')::real AS sugar,
  (item->>'saturatedFat')::real AS saturated_fat,
  (item->>'salt')::real AS salt
FROM "meals" m,
  jsonb_array_elements(m.items) AS item;
--> statement-breakpoint

-- Drop meals.items JSONB (now replaced by meal_items)
ALTER TABLE "meals" DROP COLUMN "items";
