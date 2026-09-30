CREATE TABLE "catalog"."event_section_tiers" (
	"event_id" uuid,
	"section" text,
	"tier_id" uuid NOT NULL,
	CONSTRAINT "event_section_tiers_pkey" PRIMARY KEY("event_id","section")
);
--> statement-breakpoint
CREATE TABLE "catalog"."price_tiers" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"price_cents" integer NOT NULL,
	"currency" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_tiers_event_name_uq" UNIQUE("event_id","name"),
	CONSTRAINT "price_tiers_event_id_uq" UNIQUE("event_id","id"),
	CONSTRAINT "price_tiers_price_non_negative" CHECK ("price_cents" >= 0),
	CONSTRAINT "price_tiers_currency_iso" CHECK ("currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE INDEX "event_section_tiers_tier_idx" ON "catalog"."event_section_tiers" ("tier_id");--> statement-breakpoint
ALTER TABLE "catalog"."event_section_tiers" ADD CONSTRAINT "event_section_tiers_event_id_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "catalog"."events"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "catalog"."event_section_tiers" ADD CONSTRAINT "event_section_tiers_tier_same_event_fk" FOREIGN KEY ("event_id","tier_id") REFERENCES "catalog"."price_tiers"("event_id","id");--> statement-breakpoint
ALTER TABLE "catalog"."price_tiers" ADD CONSTRAINT "price_tiers_event_id_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "catalog"."events"("id") ON DELETE CASCADE;