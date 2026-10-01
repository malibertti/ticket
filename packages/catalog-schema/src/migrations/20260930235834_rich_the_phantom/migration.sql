CREATE SCHEMA "catalog";
--> statement-breakpoint
CREATE TABLE "catalog"."events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"venue_id" uuid NOT NULL,
	"title" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"on_sale_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "catalog"."venues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"city" text NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"layout_version" integer DEFAULT 1 NOT NULL,
	"layout" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "venues_lat_range" CHECK ("latitude" BETWEEN -90 AND 90),
	CONSTRAINT "venues_lng_range" CHECK ("longitude" BETWEEN -180 AND 180)
);
--> statement-breakpoint
ALTER TABLE "catalog"."events" ADD CONSTRAINT "events_venue_id_venues_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "catalog"."venues"("id");--> statement-breakpoint
ALTER TABLE "catalog"."event_section_prices" ADD CONSTRAINT "event_section_prices_event_id_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "catalog"."events"("id") ON DELETE CASCADE;