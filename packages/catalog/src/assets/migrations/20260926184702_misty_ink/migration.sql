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
CREATE TABLE "catalog"."seat_map_entries" (
	"venue_id" uuid,
	"section" text,
	"row_label" text,
	"seat_number" integer,
	CONSTRAINT "seat_map_entries_pkey" PRIMARY KEY("venue_id","section","row_label","seat_number")
);
--> statement-breakpoint
CREATE TABLE "catalog"."venues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"city" text NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"seat_map_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "venues_lat_range" CHECK ("latitude" BETWEEN -90 AND 90),
	CONSTRAINT "venues_lng_range" CHECK ("longitude" BETWEEN -180 AND 180)
);
--> statement-breakpoint
ALTER TABLE "catalog"."events" ADD CONSTRAINT "events_venue_id_venues_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "catalog"."venues"("id");--> statement-breakpoint
ALTER TABLE "catalog"."seat_map_entries" ADD CONSTRAINT "seat_map_entries_venue_id_venues_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "catalog"."venues"("id");