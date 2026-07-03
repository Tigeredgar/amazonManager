import "server-only";

import { differenceInCalendarDays, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { eq, isNull, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { hasItemImageUrlColumn } from "@/db/schema-health";
import { items, mailboxConnections, orders, parserReviews, returns } from "@/db/schema";
import { isDemoMode } from "@/lib/env";
import { getDemoDashboardData } from "./demo-data";
import type { DashboardData, DashboardOrder } from "./types";

export async function getDashboardData(): Promise<DashboardData> {
  if (isDemoMode()) return getDemoDashboardData();

  const db = getDb();
  const imageUrlAvailable = await hasItemImageUrlColumn();
  const [rows, reviewRows, connectionRows] = await Promise.all([
    db
      .select({
        orderId: orders.id,
        orderNumber: orders.orderNumber,
        orderedAt: orders.orderedAt,
        recipient: orders.recipient,
        city: orders.destinationCity,
        state: orders.destinationState,
        totalCents: orders.totalCents,
        orderAmazonUrl: orders.amazonUrl,
        itemId: items.id,
        title: items.title,
        quantity: items.quantity,
        priceCents: items.unitPriceCents,
        lifecycleStatus: items.lifecycleStatus,
        decision: items.decision,
        deliveredAt: items.deliveredAt,
        estimatedDeadline: items.estimatedReturnDeadline,
        overrideDeadline: items.returnDeadlineOverride,
        itemAmazonUrl: items.amazonUrl,
        imageUrl: imageUrlAvailable ? items.imageUrl : sql<string | null>`null`,
        notes: items.notes,
        tags: items.tags,
        archivedAt: items.archivedAt,
        returnState: returns.state,
        dropoffDeadline: returns.dropoffDeadline,
        promisedRefundDate: returns.promisedRefundDate,
        expectedRefundCents: returns.expectedRefundCents,
        actualRefundCents: returns.actualRefundCents,
        refundMethodMasked: returns.refundMethodMasked,
      })
      .from(orders)
      .innerJoin(items, eq(items.orderId, orders.id))
      .leftJoin(returns, eq(returns.itemId, items.id))
      .orderBy(sql`${orders.orderedAt} desc nulls last`),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(parserReviews)
      .where(isNull(parserReviews.resolvedAt)),
    db.select().from(mailboxConnections).where(eq(mailboxConnections.isActive, true)).limit(1),
  ]);

  const grouped = new Map<string, DashboardOrder>();
  for (const row of rows) {
    const destination = [row.city, row.state].filter(Boolean).join(", ") || null;
    const order = grouped.get(row.orderId) ?? {
      id: row.orderId,
      orderNumber: row.orderNumber,
      orderedAt: row.orderedAt?.toISOString() ?? null,
      recipient: row.recipient,
      destination,
      totalCents: row.totalCents,
      amazonUrl: row.orderAmazonUrl,
      items: [],
    };
    order.items.push({
      id: row.itemId,
      title: row.title,
      quantity: row.quantity,
      priceCents: row.priceCents,
      lifecycleStatus: row.lifecycleStatus,
      decision: row.decision,
      returnState: row.returnState,
      deliveredAt: row.deliveredAt?.toISOString() ?? null,
      deadline: row.overrideDeadline ?? row.estimatedDeadline,
      deadlineSource: row.overrideDeadline ? "override" : row.estimatedDeadline ? "estimated" : null,
      dropoffDeadline: row.dropoffDeadline,
      promisedRefundDate: row.promisedRefundDate,
      expectedRefundCents: row.expectedRefundCents,
      actualRefundCents: row.actualRefundCents,
      refundMethodMasked: row.refundMethodMasked,
      notes: row.notes,
      tags: row.tags,
      amazonUrl: row.itemAmazonUrl ?? row.orderAmazonUrl,
      imageUrl: row.imageUrl,
      archivedAt: row.archivedAt?.toISOString() ?? null,
    });
    grouped.set(row.orderId, order);
  }

  const orderList = [...grouped.values()];
  const activeItems = orderList.flatMap(({ items: orderItems }) => orderItems).filter((item) => !item.archivedAt);
  const today = formatInTimeZone(new Date(), "America/Chicago", "yyyy-MM-dd");
  const dueSoon = activeItems.filter((item) => {
    const deadline = item.returnState === "requested" ? item.dropoffDeadline : item.deadline;
    if (!deadline) return false;
    const days = differenceInCalendarDays(parseISO(deadline), parseISO(today));
    return days >= 0 && days <= 7;
  }).length;
  const moneyAtRiskCents = activeItems
    .filter((item) => item.lifecycleStatus === "delivered" && item.decision !== "keep" && !item.returnState)
    .reduce((total, item) => total + (item.priceCents ?? 0) * item.quantity, 0);
  const pendingRefundCents = activeItems
    .filter((item) => item.returnState && item.returnState !== "refunded")
    .reduce((total, item) => total + (item.expectedRefundCents ?? 0), 0);
  const connection = connectionRows[0];

  return {
    orders: orderList,
    metrics: {
      dueSoon,
      moneyAtRiskCents,
      pendingRefundCents,
      needsReview: reviewRows[0]?.count ?? 0,
    },
    mailbox: {
      connected: Boolean(connection),
      email: connection?.email ?? null,
      lastSyncAt: connection?.lastSyncAt?.toISOString() ?? null,
      status: connection?.lastSyncStatus ?? null,
      error: connection?.lastSyncError ?? null,
      moreAvailable: Boolean(connection?.syncPageToken),
      reauthorizationRequired: connection?.lastSyncStatus === "reauthorization_required",
    },
  };
}
