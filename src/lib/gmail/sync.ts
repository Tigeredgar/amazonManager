import "server-only";

import { addDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { and, eq, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { hasItemImageUrlColumn } from "@/db/schema-health";
import {
  emailEvents,
  items,
  mailboxConnections,
  orders,
  parserReviews,
  returns,
  shipments,
} from "@/db/schema";
import { findItemCandidates } from "@/lib/amazon/matching";
import { emailBodyHash, parseAmazonEmail } from "@/lib/amazon/parser";
import type { AmazonEventType, ParsedAmazonEmail, ParsedAmazonItem } from "@/lib/amazon/types";
import { isInvalidGrantError, syncErrorMessage } from "@/lib/gmail/errors";
import { extractMessageContent, getHeader } from "@/lib/gmail/mime";
import { getGmailClient } from "./client";

const AMAZON_QUERY =
  'from:(amazon.com) {subject:"Ordered:" subject:"Shipped:" subject:"Delivered:" subject:"Return request confirmed" subject:"Dropoff confirmed" subject:"refund issued"}';

const lifecycleRank: Record<string, number> = {
  ordered: 1,
  shipped: 2,
  delivered: 3,
};

const itemSyncFields = {
  id: items.id,
  title: items.title,
  normalizedTitle: items.normalizedTitle,
  quantity: items.quantity,
  lifecycleStatus: items.lifecycleStatus,
};

function lifecycleForEvent(type: AmazonEventType) {
  if (type === "ordered" || type === "shipped" || type === "delivered") return type;
  return null;
}

function returnStateForEvent(type: AmazonEventType) {
  if (type === "return_requested") return "requested";
  if (type === "dropoff_confirmed") return "dropped_off";
  if (type === "refund_issued") return "refunded";
  return null;
}

function deadlineFromDelivery(deliveredAt: Date) {
  return formatInTimeZone(addDays(deliveredAt, 30), "America/Chicago", "yyyy-MM-dd");
}

async function createReview(
  emailEventId: string,
  type: string,
  summary: string,
  candidates: string[] = [],
) {
  await getDb().insert(parserReviews).values({
    emailEventId,
    reviewType: type,
    summary,
    candidateItemIds: candidates,
  });
}

async function getOrCreateOrder(parsed: ParsedAmazonEmail) {
  if (!parsed.orderNumber) return null;
  const db = getDb();
  const [existing] = await db
    .select()
    .from(orders)
    .where(eq(orders.orderNumber, parsed.orderNumber))
    .limit(1);

  const occurredAt = new Date(parsed.occurredAt);
  const update = {
    ...(parsed.type === "ordered" ? { orderedAt: occurredAt } : {}),
    ...(parsed.recipient ? { recipient: parsed.recipient } : {}),
    ...(parsed.destinationCity ? { destinationCity: parsed.destinationCity } : {}),
    ...(parsed.destinationState ? { destinationState: parsed.destinationState } : {}),
    ...(parsed.orderTotalCents !== null ? { totalCents: parsed.orderTotalCents } : {}),
    ...(parsed.amazonUrl ? { amazonUrl: parsed.amazonUrl } : {}),
    updatedAt: new Date(),
  };

  if (existing) {
    const [updated] = await db.update(orders).set(update).where(eq(orders.id, existing.id)).returning();
    return updated;
  }

  const [created] = await db
    .insert(orders)
    .values({
      orderNumber: parsed.orderNumber,
      orderedAt: parsed.type === "ordered" ? occurredAt : null,
      recipient: parsed.recipient,
      destinationCity: parsed.destinationCity,
      destinationState: parsed.destinationState,
      totalCents: parsed.orderTotalCents,
      amazonUrl: parsed.amazonUrl,
    })
    .returning();
  return created;
}

async function createItem(orderId: string, parsedItem: ParsedAmazonItem, parsed: ParsedAmazonEmail) {
  const canStoreImageUrl = await hasItemImageUrlColumn();
  const lifecycle = lifecycleForEvent(parsed.type) ?? "ordered";
  const deliveredAt = parsed.type === "delivered" ? new Date(parsed.occurredAt) : null;
  const [created] = await getDb()
    .insert(items)
    .values({
      orderId,
      title: parsedItem.title,
      normalizedTitle: parsedItem.normalizedTitle,
      quantity: parsedItem.quantity,
      unitPriceCents: parsedItem.priceCents,
      lifecycleStatus: lifecycle,
      deliveredAt,
      estimatedReturnDeadline: deliveredAt ? deadlineFromDelivery(deliveredAt) : null,
      amazonUrl: parsed.amazonUrl,
      ...(canStoreImageUrl ? { imageUrl: parsedItem.imageUrl } : {}),
    })
    .returning(itemSyncFields);
  return created;
}

async function applyReturn(itemId: string, parsed: ParsedAmazonEmail) {
  const state = returnStateForEvent(parsed.type);
  if (!state) return;
  const occurredAt = new Date(parsed.occurredAt);
  const updatedAt = new Date();
  const insertValues = {
    itemId,
    state,
    requestedAt: parsed.type === "return_requested" ? occurredAt : undefined,
    dropoffDeadline: parsed.dropoffDeadline,
    dropoffLocation: parsed.dropoffLocation,
    droppedOffAt: parsed.type === "dropoff_confirmed" ? occurredAt : undefined,
    expectedRefundCents: parsed.expectedRefundCents,
    actualRefundCents: parsed.actualRefundCents,
    promisedRefundDate: parsed.promisedRefundDate,
    refundIssuedAt: parsed.type === "refund_issued" ? occurredAt : undefined,
    refundMethodMasked: parsed.refundMethodMasked,
    updatedAt,
  };
  const updateValues = {
    state,
    ...(parsed.type === "return_requested" ? { requestedAt: occurredAt } : {}),
    ...(parsed.dropoffDeadline ? { dropoffDeadline: parsed.dropoffDeadline } : {}),
    ...(parsed.dropoffLocation ? { dropoffLocation: parsed.dropoffLocation } : {}),
    ...(parsed.type === "dropoff_confirmed" ? { droppedOffAt: occurredAt } : {}),
    ...(parsed.expectedRefundCents !== null
      ? { expectedRefundCents: parsed.expectedRefundCents }
      : {}),
    ...(parsed.actualRefundCents !== null ? { actualRefundCents: parsed.actualRefundCents } : {}),
    ...(parsed.promisedRefundDate ? { promisedRefundDate: parsed.promisedRefundDate } : {}),
    ...(parsed.type === "refund_issued" ? { refundIssuedAt: occurredAt } : {}),
    ...(parsed.refundMethodMasked ? { refundMethodMasked: parsed.refundMethodMasked } : {}),
    updatedAt,
  };
  await getDb()
    .insert(returns)
    .values(insertValues)
    .onConflictDoUpdate({
      target: returns.itemId,
      set: updateValues,
    });

  if (parsed.type === "refund_issued") {
    await getDb()
      .update(items)
      .set({
        decision: "return_planned",
        archivedAt: sql`coalesce(${items.archivedAt}, ${occurredAt})`,
        updatedAt,
      })
      .where(eq(items.id, itemId));
  }
}

async function applyParsedEvent(parsed: ParsedAmazonEmail, emailEventId: string) {
  const order = await getOrCreateOrder(parsed);
  if (!order) {
    await createReview(emailEventId, "missing_order", "The email did not contain an order number.");
    return;
  }

  if (!parsed.items.length) {
    await createReview(
      emailEventId,
      "missing_items",
      `No product could be extracted for order ${order.orderNumber}.`,
    );
    return;
  }

  const db = getDb();
  const canStoreImageUrl = await hasItemImageUrlColumn();
  let existingItems = await db.select(itemSyncFields).from(items).where(eq(items.orderId, order.id));
  for (const parsedItem of parsed.items) {
    const candidates = findItemCandidates(parsedItem, existingItems);
    let target = candidates.length === 1 ? candidates[0] : null;

    if (candidates.length > 1) {
      await createReview(
        emailEventId,
        "ambiguous_item",
        `Multiple products matched “${parsedItem.title}”.`,
        candidates.map(({ id }) => id),
      );
      continue;
    }

    if (!target) {
      target = await createItem(order.id, parsedItem, parsed);
      existingItems = [...existingItems, target];
    } else {
      const lifecycle = lifecycleForEvent(parsed.type);
      const deliveredAt = parsed.type === "delivered" ? new Date(parsed.occurredAt) : null;
      const shouldAdvance =
        lifecycle && lifecycleRank[lifecycle] > (lifecycleRank[target.lifecycleStatus] ?? 0);
      const [updated] = await db
        .update(items)
        .set({
          title: parsedItem.title.length > target.title.length ? parsedItem.title : target.title,
          normalizedTitle:
            parsedItem.title.length > target.title.length
              ? parsedItem.normalizedTitle
              : target.normalizedTitle,
          quantity: parsedItem.quantity,
          ...(parsedItem.priceCents !== null ? { unitPriceCents: parsedItem.priceCents } : {}),
          ...(shouldAdvance ? { lifecycleStatus: lifecycle } : {}),
          ...(deliveredAt
            ? {
                deliveredAt,
                estimatedReturnDeadline: deadlineFromDelivery(deliveredAt),
              }
            : {}),
          ...(parsed.amazonUrl ? { amazonUrl: parsed.amazonUrl } : {}),
          ...(canStoreImageUrl && parsedItem.imageUrl ? { imageUrl: parsedItem.imageUrl } : {}),
          updatedAt: new Date(),
        })
        .where(eq(items.id, target.id))
        .returning(itemSyncFields);
      target = updated;
    }

    await applyReturn(target.id, parsed);
  }

  if (parsed.type === "shipped" || parsed.type === "delivered") {
    const status = parsed.type;
    const occurredAt = new Date(parsed.occurredAt);
    const [existingShipment] = await db
      .select()
      .from(shipments)
      .where(and(eq(shipments.orderId, order.id), eq(shipments.status, status)))
      .limit(1);
    if (!existingShipment) {
      await db.insert(shipments).values({
        orderId: order.id,
        status,
        shippedAt: status === "shipped" ? occurredAt : null,
        deliveredAt: status === "delivered" ? occurredAt : null,
        trackingUrl: parsed.amazonUrl,
      });
    }
  }
}

export type SyncResult = {
  found: number;
  imported: number;
  skipped: number;
  needsReview: number;
  moreAvailable: boolean;
};

export async function syncGmail(): Promise<SyncResult> {
  const db = getDb();
  let connection: Awaited<ReturnType<typeof getGmailClient>>["connection"] | null = null;

  try {
    const client = await getGmailClient();
    const gmail = client.gmail;
    connection = client.connection;
    const after = connection.lastSyncAt
      ? ` after:${Math.floor((connection.lastSyncAt.getTime() - 7 * 86_400_000) / 1000)}`
      : ` newer_than:${connection.importDays}d`;

    const list = await gmail.users.messages.list({
      userId: "me",
      q: `${AMAZON_QUERY}${after}`,
      maxResults: 50,
      pageToken: connection.syncPageToken ?? undefined,
    });
    const messageRefs = list.data.messages ?? [];
    const messages = [];
    for (let index = 0; index < messageRefs.length; index += 5) {
      const batch = messageRefs.slice(index, index + 5);
      messages.push(
        ...(await Promise.all(
          batch.map(({ id }) =>
            gmail.users.messages.get({ userId: "me", id: id!, format: "full" }),
          ),
        )),
      );
    }

    let imported = 0;
    let skipped = 0;
    let needsReview = 0;
    for (const response of messages) {
      const message = response.data;
      if (!message.id) continue;
      const subject = getHeader(message.payload, "Subject") ?? "(No subject)";
      const { body, imageUrls } = extractMessageContent(message.payload);
      const receivedAt = new Date(Number(message.internalDate ?? Date.now()));
      const parsed = parseAmazonEmail({
        id: message.id,
        threadId: message.threadId,
        subject,
        body,
        imageUrls,
        receivedAt,
      });

      const inserted = await db
        .insert(emailEvents)
        .values({
          gmailMessageId: message.id,
          gmailThreadId: message.threadId,
          subject,
          eventType: parsed.type,
          bodyHash: emailBodyHash(body),
          receivedAt,
          parseStatus: parsed.confidence === "low" ? "review" : "parsed",
          parsedPayload: parsed as unknown as Record<string, unknown>,
        })
        .onConflictDoNothing({ target: emailEvents.gmailMessageId })
        .returning({ id: emailEvents.id });

      if (!inserted[0]) {
        skipped += 1;
        continue;
      }

      await applyParsedEvent(parsed, inserted[0].id);
      imported += 1;
      if (parsed.warnings.length) needsReview += 1;
    }

    const moreAvailable = Boolean(list.data.nextPageToken);
    await db
      .update(mailboxConnections)
      .set({
        syncPageToken: list.data.nextPageToken ?? null,
        lastSyncAt: moreAvailable ? connection.lastSyncAt : new Date(),
        lastSyncStatus: moreAvailable ? "partial" : "success",
        lastSyncError: null,
        updatedAt: new Date(),
      })
      .where(eq(mailboxConnections.id, connection.id));

    return {
      found: messageRefs.length,
      imported,
      skipped,
      needsReview,
      moreAvailable,
    };
  } catch (cause) {
    const error = syncErrorMessage(cause);
    if (connection) {
      await db
        .update(mailboxConnections)
        .set({
          lastSyncStatus: isInvalidGrantError(cause) ? "reauthorization_required" : "failed",
          lastSyncError: error,
          updatedAt: new Date(),
        })
        .where(eq(mailboxConnections.id, connection.id));
    }
    throw cause;
  }
}
