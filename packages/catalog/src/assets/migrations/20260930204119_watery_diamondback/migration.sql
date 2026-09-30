DROP TABLE "catalog"."seat_map_entries";--> statement-breakpoint
ALTER TABLE "catalog"."venues" ADD COLUMN "layout" jsonb NOT NULL;