import "server-only";

import { formatInTimeZone } from "date-fns-tz";
import { and, eq, isNotNull, isNull } from "drizzle-orm";

import { getDb } from "@/db";
import {
  items,
  mailboxConnections,
  notificationBatches,
  notificationEntries,
  orders,
  returns,
} from "@/db/schema";
import { sendGmailMessage } from "@/lib/gmail/send";
import { evaluateReminder, type ReminderRuleMatch } from "./rules";

type DigestEntry = ReminderRuleMatch & {
  title: string;
  orderNumber: string;
  amazonUrl: string | null;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };
    return entities[character];
  });
}

function describe(entry: DigestEntry) {
  if (entry.kind === "eligibility") {
    return `${entry.thresholdDays} day${entry.thresholdDays === 1 ? "" : "s"} left to decide`;
  }
  if (entry.kind === "dropoff") {
    return `${entry.thresholdDays} day${entry.thresholdDays === 1 ? "" : "s"} left to drop off`;
  }
  return `Refund was promised by ${entry.targetDate}`;
}

function renderDigest(entries: DigestEntry[]) {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const lines = entries.map(
    (entry) => `• ${entry.title}\n  ${describe(entry)} · Order ${entry.orderNumber}`,
  );
  const cards = entries
    .map(
      (entry) => `<tr><td style="padding:16px 0;border-bottom:1px solid #e5e7eb">
        <div style="font-weight:600;color:#111827">${escapeHtml(entry.title)}</div>
        <div style="margin-top:5px;color:#b45309">${escapeHtml(describe(entry))}</div>
        <div style="margin-top:5px;color:#6b7280;font-size:13px">Order ${escapeHtml(entry.orderNumber)}</div>
      </td></tr>`,
    )
    .join("");

  return {
    text: `Amazon return reminders\n\n${lines.join("\n\n")}\n\nOpen dashboard: ${appUrl}`,
    html: `<!doctype html><html><body style="margin:0;background:#f5f5f4;font-family:Arial,sans-serif;color:#111827">
      <div style="max-width:600px;margin:0 auto;padding:32px 20px">
        <div style="background:#fff;border:1px solid #e7e5e4;border-radius:14px;padding:28px">
          <div style="font-size:12px;text-transform:uppercase;letter-spacing:.16em;color:#78716c">Return Window</div>
          <h1 style="margin:10px 0 6px;font-size:24px">Amazon items need attention</h1>
          <p style="margin:0 0 12px;color:#57534e">${entries.length} reminder${entries.length === 1 ? "" : "s"} today.</p>
          <table role="presentation" style="width:100%;border-collapse:collapse">${cards}</table>
          <a href="${escapeHtml(appUrl)}" style="display:inline-block;margin-top:22px;padding:11px 16px;background:#18181b;color:#fff;text-decoration:none;border-radius:8px">Open dashboard</a>
        </div>
      </div></body></html>`,
  };
}

async function collectEntries(today: string): Promise<DigestEntry[]> {
  const rows = await getDb()
    .select({
      itemId: items.id,
      title: items.title,
      decision: items.decision,
      archivedAt: items.archivedAt,
      estimatedDeadline: items.estimatedReturnDeadline,
      overrideDeadline: items.returnDeadlineOverride,
      itemAmazonUrl: items.amazonUrl,
      orderNumber: orders.orderNumber,
      orderAmazonUrl: orders.amazonUrl,
      returnState: returns.state,
      dropoffDeadline: returns.dropoffDeadline,
      promisedRefundDate: returns.promisedRefundDate,
    })
    .from(items)
    .innerJoin(orders, eq(items.orderId, orders.id))
    .leftJoin(returns, eq(returns.itemId, items.id))
    .where(isNull(items.archivedAt));

  return rows.flatMap((row) => {
    const match = evaluateReminder(
      {
        itemId: row.itemId,
        archived: Boolean(row.archivedAt),
        decision: row.decision,
        eligibilityDeadline: row.overrideDeadline ?? row.estimatedDeadline,
        returnState: row.returnState,
        dropoffDeadline: row.dropoffDeadline,
        promisedRefundDate: row.promisedRefundDate,
      },
      today,
    );
    return match
      ? [
          {
            ...match,
            title: row.title,
            orderNumber: row.orderNumber,
            amazonUrl: row.itemAmazonUrl ?? row.orderAmazonUrl,
          },
        ]
      : [];
  });
}

export async function sendDailyReminderDigest() {
  const db = getDb();
  const today = formatInTimeZone(new Date(), "America/Chicago", "yyyy-MM-dd");
  const entries = await collectEntries(today);
  if (!entries.length) return { sent: 0, recipients: 0 };

  const [connection] = await db
    .select()
    .from(mailboxConnections)
    .where(eq(mailboxConnections.isActive, true))
    .limit(1);
  if (!connection) throw new Error("No active Gmail mailbox is connected");

  let sent = 0;
  for (const recipient of connection.reminderRecipients) {
    const priorEntries = await db
      .select({
        itemId: notificationEntries.itemId,
        kind: notificationEntries.kind,
        targetDate: notificationEntries.targetDate,
        thresholdDays: notificationEntries.thresholdDays,
      })
      .from(notificationEntries)
      .where(
        and(
          eq(notificationEntries.recipient, recipient),
          isNotNull(notificationEntries.sentAt),
        ),
      );
    const priorKeys = new Set(
      priorEntries.map(
        (entry) => `${entry.itemId}:${entry.kind}:${entry.targetDate}:${entry.thresholdDays}`,
      ),
    );
    const recipientEntries = entries.filter(
      (entry) =>
        !priorKeys.has(
          `${entry.itemId}:${entry.kind}:${entry.targetDate}:${entry.thresholdDays}`,
        ),
    );
    if (!recipientEntries.length) continue;

    const [created] = await db
      .insert(notificationBatches)
      .values({
        digestDate: today,
        recipient,
        status: "sending",
        attempts: 1,
        payload: { entries: recipientEntries },
      })
      .onConflictDoNothing()
      .returning();

    let batch = created;
    if (!batch) {
      [batch] = await db
        .select()
        .from(notificationBatches)
        .where(
          and(
            eq(notificationBatches.digestDate, today),
            eq(notificationBatches.recipient, recipient),
          ),
        )
        .limit(1);
      if (!batch || batch.status === "sent" || batch.status === "sending") continue;
      await db
        .update(notificationBatches)
        .set({ status: "sending", attempts: batch.attempts + 1, error: null })
        .where(eq(notificationBatches.id, batch.id));
    }

    try {
      for (const entry of recipientEntries) {
        await db
          .insert(notificationEntries)
          .values({
            batchId: batch.id,
            itemId: entry.itemId,
            recipient,
            kind: entry.kind,
            targetDate: entry.targetDate,
            thresholdDays: entry.thresholdDays,
          })
          .onConflictDoNothing();
      }
      const content = renderDigest(recipientEntries);
      const gmailMessageId = await sendGmailMessage({
        to: recipient,
        subject: `${recipientEntries.length} Amazon return reminder${recipientEntries.length === 1 ? "" : "s"}`,
        ...content,
      });
      const sentAt = new Date();
      await db
        .update(notificationBatches)
        .set({ status: "sent", gmailMessageId, sentAt, error: null })
        .where(eq(notificationBatches.id, batch.id));
      await db
        .update(notificationEntries)
        .set({ sentAt })
        .where(eq(notificationEntries.batchId, batch.id));
      sent += recipientEntries.length;
    } catch (cause) {
      const error = cause instanceof Error ? cause.message : "Unknown Gmail send error";
      await db
        .update(notificationBatches)
        .set({ status: "failed", error })
        .where(eq(notificationBatches.id, batch.id));
      throw cause;
    }
  }

  return { sent, recipients: connection.reminderRecipients.length };
}
