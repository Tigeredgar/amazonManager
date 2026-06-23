import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderNumber: text("order_number").notNull().unique(),
    orderedAt: timestamp("ordered_at", { withTimezone: true }),
    recipient: text("recipient"),
    destinationCity: text("destination_city"),
    destinationState: text("destination_state"),
    totalCents: integer("total_cents"),
    currency: text("currency").default("USD").notNull(),
    amazonUrl: text("amazon_url"),
    ...timestamps,
  },
  (table) => [index("orders_ordered_at_idx").on(table.orderedAt)],
);

export const items = pgTable(
  "items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    normalizedTitle: text("normalized_title").notNull(),
    quantity: integer("quantity").default(1).notNull(),
    unitPriceCents: integer("unit_price_cents"),
    lifecycleStatus: text("lifecycle_status").default("ordered").notNull(),
    decision: text("decision").default("undecided").notNull(),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    estimatedReturnDeadline: date("estimated_return_deadline"),
    returnDeadlineOverride: date("return_deadline_override"),
    amazonUrl: text("amazon_url"),
    notes: text("notes"),
    tags: jsonb("tags").$type<string[]>().default([]).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("items_order_id_idx").on(table.orderId),
    index("items_deadline_idx").on(table.estimatedReturnDeadline),
    index("items_archived_idx").on(table.archivedAt),
  ],
);

export const shipments = pgTable(
  "shipments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    externalId: text("external_id"),
    status: text("status").default("shipped").notNull(),
    shippedAt: timestamp("shipped_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    trackingUrl: text("tracking_url"),
    ...timestamps,
  },
  (table) => [index("shipments_order_id_idx").on(table.orderId)],
);

export const returns = pgTable(
  "returns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    itemId: uuid("item_id")
      .notNull()
      .unique()
      .references(() => items.id, { onDelete: "cascade" }),
    state: text("state").default("requested").notNull(),
    requestedAt: timestamp("requested_at", { withTimezone: true }),
    dropoffDeadline: date("dropoff_deadline"),
    dropoffLocation: text("dropoff_location"),
    droppedOffAt: timestamp("dropped_off_at", { withTimezone: true }),
    expectedRefundCents: integer("expected_refund_cents"),
    actualRefundCents: integer("actual_refund_cents"),
    promisedRefundDate: date("promised_refund_date"),
    refundIssuedAt: timestamp("refund_issued_at", { withTimezone: true }),
    refundMethodMasked: text("refund_method_masked"),
    ...timestamps,
  },
  (table) => [index("returns_state_idx").on(table.state)],
);

export const mailboxConnections = pgTable("mailbox_connections", {
  id: uuid("id").defaultRandom().primaryKey(),
  provider: text("provider").default("gmail").notNull(),
  email: text("email").notNull().unique(),
  encryptedRefreshToken: text("encrypted_refresh_token").notNull(),
  tokenIv: text("token_iv").notNull(),
  tokenTag: text("token_tag").notNull(),
  encryptionVersion: integer("encryption_version").default(1).notNull(),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  lastSyncStatus: text("last_sync_status"),
  lastSyncError: text("last_sync_error"),
  syncPageToken: text("sync_page_token"),
  importDays: integer("import_days").default(90).notNull(),
  reminderRecipients: jsonb("reminder_recipients").$type<string[]>().default([]).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  ...timestamps,
});

export const emailEvents = pgTable(
  "email_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    gmailMessageId: text("gmail_message_id").notNull().unique(),
    gmailThreadId: text("gmail_thread_id"),
    subject: text("subject").notNull(),
    eventType: text("event_type").notNull(),
    bodyHash: text("body_hash").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
    parserVersion: integer("parser_version").default(1).notNull(),
    parseStatus: text("parse_status").default("parsed").notNull(),
    parsedPayload: jsonb("parsed_payload").$type<Record<string, unknown>>().notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("email_events_received_at_idx").on(table.receivedAt)],
);

export const parserReviews = pgTable(
  "parser_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    emailEventId: uuid("email_event_id").references(() => emailEvents.id, {
      onDelete: "cascade",
    }),
    reviewType: text("review_type").notNull(),
    summary: text("summary").notNull(),
    candidateItemIds: jsonb("candidate_item_ids").$type<string[]>().default([]).notNull(),
    resolution: text("resolution"),
    resolvedBy: text("resolved_by"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("parser_reviews_resolved_idx").on(table.resolvedAt)],
);

export const notificationBatches = pgTable(
  "notification_batches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    digestDate: date("digest_date").notNull(),
    recipient: text("recipient").notNull(),
    status: text("status").default("pending").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    gmailMessageId: text("gmail_message_id"),
    attempts: integer("attempts").default(0).notNull(),
    error: text("error"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("notification_batches_date_recipient_idx").on(
      table.digestDate,
      table.recipient,
    ),
  ],
);

export const notificationEntries = pgTable(
  "notification_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => notificationBatches.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    recipient: text("recipient").notNull(),
    kind: text("kind").notNull(),
    targetDate: date("target_date").notNull(),
    thresholdDays: integer("threshold_days").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("notification_entries_dedupe_idx").on(
      table.itemId,
      table.recipient,
      table.kind,
      table.targetDate,
      table.thresholdDays,
    ),
  ],
);
