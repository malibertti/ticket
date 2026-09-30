CREATE TABLE "catalog"."event_section_prices" (
	"event_id" uuid,
	"section" text,
	"price_cents" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_section_prices_pkey" PRIMARY KEY("event_id","section"),
	CONSTRAINT "event_section_prices_non_negative" CHECK ("price_cents" >= 0),
	CONSTRAINT "event_section_prices_currency_usd" CHECK ("currency" = 'USD')
);
--> statement-breakpoint
ALTER TABLE "catalog"."event_section_tiers" DROP CONSTRAINT "event_section_tiers_tier_same_event_fk";--> statement-breakpoint
DROP TABLE "catalog"."event_section_tiers";--> statement-breakpoint
DROP TABLE "catalog"."price_tiers";--> statement-breakpoint
ALTER TABLE "catalog"."event_section_prices" ADD CONSTRAINT "event_section_prices_event_id_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "catalog"."events"("id") ON DELETE CASCADE;