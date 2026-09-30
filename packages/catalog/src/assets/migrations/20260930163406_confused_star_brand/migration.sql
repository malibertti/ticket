ALTER TABLE "catalog"."events" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "catalog"."price_tiers" ALTER COLUMN "currency" SET DEFAULT 'USD';