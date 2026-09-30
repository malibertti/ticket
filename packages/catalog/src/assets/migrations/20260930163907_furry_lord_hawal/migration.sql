ALTER TABLE "catalog"."events" ALTER COLUMN "id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "catalog"."price_tiers" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();