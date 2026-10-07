CREATE TABLE "catalog"."outbox" (
	"id" bigserial PRIMARY KEY,
	"topic" text NOT NULL,
	"key" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "outbox_unpublished_idx" ON "catalog"."outbox" ("id") WHERE "published_at" IS NULL;