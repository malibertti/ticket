CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"venue_id" uuid NOT NULL,
	"title" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"on_sale_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seat_map_entries" (
	"venue_id" uuid,
	"section" text,
	"row_label" text,
	"seat_number" integer,
	CONSTRAINT "seat_map_entries_pkey" PRIMARY KEY("venue_id","section","row_label","seat_number")
);
--> statement-breakpoint
CREATE TABLE "venues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"city" text NOT NULL,
	"seat_map_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_venue_id_venues_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id");--> statement-breakpoint
ALTER TABLE "seat_map_entries" ADD CONSTRAINT "seat_map_entries_venue_id_venues_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id");