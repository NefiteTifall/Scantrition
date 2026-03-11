CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"barcode" text,
	"brand" text,
	"image" text,
	"source" text DEFAULT 'ai' NOT NULL,
	"serving_size" text,
	"calories" real NOT NULL,
	"protein" real NOT NULL,
	"carbs" real NOT NULL,
	"fat" real NOT NULL,
	"fiber" real,
	"sugar" real,
	"saturated_fat" real,
	"salt" real,
	"nutri_score" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_favorite_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "favorite_meals" CASCADE;--> statement-breakpoint
ALTER TABLE "meals" ADD COLUMN "health_score" integer;--> statement-breakpoint
ALTER TABLE "meals" ADD COLUMN "health_label" text;--> statement-breakpoint
ALTER TABLE "user_goals" ADD COLUMN "fiber" integer DEFAULT 25 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_goals" ADD COLUMN "health_goal" text DEFAULT 'balance' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_favorite_products" ADD CONSTRAINT "user_favorite_products_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_favorite_products" ADD CONSTRAINT "user_favorite_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "products_user_idx" ON "products" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "products_barcode_idx" ON "products" USING btree ("barcode");--> statement-breakpoint
CREATE INDEX "products_user_slug_idx" ON "products" USING btree ("user_id","slug");--> statement-breakpoint
CREATE INDEX "user_fav_products_user_idx" ON "user_favorite_products" USING btree ("user_id");