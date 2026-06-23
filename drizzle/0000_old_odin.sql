CREATE TABLE "email_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gmail_message_id" text NOT NULL,
	"gmail_thread_id" text,
	"subject" text NOT NULL,
	"event_type" text NOT NULL,
	"body_hash" text NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"parser_version" integer DEFAULT 1 NOT NULL,
	"parse_status" text DEFAULT 'parsed' NOT NULL,
	"parsed_payload" jsonb NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_events_gmail_message_id_unique" UNIQUE("gmail_message_id")
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"title" text NOT NULL,
	"normalized_title" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price_cents" integer,
	"lifecycle_status" text DEFAULT 'ordered' NOT NULL,
	"decision" text DEFAULT 'undecided' NOT NULL,
	"delivered_at" timestamp with time zone,
	"estimated_return_deadline" date,
	"return_deadline_override" date,
	"amazon_url" text,
	"notes" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mailbox_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text DEFAULT 'gmail' NOT NULL,
	"email" text NOT NULL,
	"encrypted_refresh_token" text NOT NULL,
	"token_iv" text NOT NULL,
	"token_tag" text NOT NULL,
	"encryption_version" integer DEFAULT 1 NOT NULL,
	"last_sync_at" timestamp with time zone,
	"last_sync_status" text,
	"last_sync_error" text,
	"sync_page_token" text,
	"import_days" integer DEFAULT 90 NOT NULL,
	"reminder_recipients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mailbox_connections_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "notification_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"digest_date" date NOT NULL,
	"recipient" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"payload" jsonb NOT NULL,
	"gmail_message_id" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"recipient" text NOT NULL,
	"kind" text NOT NULL,
	"target_date" date NOT NULL,
	"threshold_days" integer NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" text NOT NULL,
	"ordered_at" timestamp with time zone,
	"recipient" text,
	"destination_city" text,
	"destination_state" text,
	"total_cents" integer,
	"currency" text DEFAULT 'USD' NOT NULL,
	"amazon_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "parser_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_event_id" uuid,
	"review_type" text NOT NULL,
	"summary" text NOT NULL,
	"candidate_item_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"resolution" text,
	"resolved_by" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "returns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"state" text DEFAULT 'requested' NOT NULL,
	"requested_at" timestamp with time zone,
	"dropoff_deadline" date,
	"dropoff_location" text,
	"dropped_off_at" timestamp with time zone,
	"expected_refund_cents" integer,
	"actual_refund_cents" integer,
	"promised_refund_date" date,
	"refund_issued_at" timestamp with time zone,
	"refund_method_masked" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "returns_item_id_unique" UNIQUE("item_id")
);
--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"external_id" text,
	"status" text DEFAULT 'shipped' NOT NULL,
	"shipped_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"tracking_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_entries" ADD CONSTRAINT "notification_entries_batch_id_notification_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."notification_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_entries" ADD CONSTRAINT "notification_entries_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parser_reviews" ADD CONSTRAINT "parser_reviews_email_event_id_email_events_id_fk" FOREIGN KEY ("email_event_id") REFERENCES "public"."email_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_events_received_at_idx" ON "email_events" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "items_order_id_idx" ON "items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "items_deadline_idx" ON "items" USING btree ("estimated_return_deadline");--> statement-breakpoint
CREATE INDEX "items_archived_idx" ON "items" USING btree ("archived_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_batches_date_recipient_idx" ON "notification_batches" USING btree ("digest_date","recipient");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_entries_dedupe_idx" ON "notification_entries" USING btree ("item_id","recipient","kind","target_date","threshold_days");--> statement-breakpoint
CREATE INDEX "orders_ordered_at_idx" ON "orders" USING btree ("ordered_at");--> statement-breakpoint
CREATE INDEX "parser_reviews_resolved_idx" ON "parser_reviews" USING btree ("resolved_at");--> statement-breakpoint
CREATE INDEX "returns_state_idx" ON "returns" USING btree ("state");--> statement-breakpoint
CREATE INDEX "shipments_order_id_idx" ON "shipments" USING btree ("order_id");