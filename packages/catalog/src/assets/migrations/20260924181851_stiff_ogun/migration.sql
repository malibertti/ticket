ALTER TABLE "venues" ADD COLUMN "latitude" double precision;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "longitude" double precision;--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_lat_range" CHECK ("latitude" BETWEEN -90 AND 90);--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_lng_range" CHECK ("longitude" BETWEEN -180 AND 180);