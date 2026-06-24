"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { items, mailboxConnections, parserReviews } from "@/db/schema";
import { requireAllowedUser } from "@/lib/auth";
import { isDemoMode } from "@/lib/env";
import { syncGmail } from "@/lib/gmail/sync";
import { getItemArchiveChanges } from "@/lib/items/archive";
import { sendDailyReminderDigest } from "@/lib/reminders/send-digest";

const idSchema = z.uuid();
const decisionSchema = z.enum(["undecided", "keep", "return_planned"]);

export async function setItemDecision(itemId: string, decision: string) {
  await requireAllowedUser();
  const id = idSchema.parse(itemId);
  const validatedDecision = decisionSchema.parse(decision);
  if (isDemoMode()) return { ok: true };

  try {
    const updated = await getDb()
      .update(items)
      .set({
        decision: validatedDecision,
        archivedAt: validatedDecision === "keep" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(items.id, id))
      .returning({ id: items.id });

    if (!updated.length) throw new Error("Item not found");
    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    console.error("[setItemDecision] failed", {
      itemId: id,
      decision: validatedDecision,
      error,
    });
    throw error;
  }
}

export async function setItemArchived(itemId: string, archived: boolean) {
  await requireAllowedUser();
  const id = idSchema.parse(itemId);
  if (isDemoMode()) return { ok: true };

  try {
    const updated = await getDb()
      .update(items)
      // "Keep & archive" records both parts of the decision. Undo both so an
      // unarchived delivered item becomes actionable again.
      .set(getItemArchiveChanges(archived))
      .where(eq(items.id, id))
      .returning({ id: items.id });

    if (!updated.length) throw new Error("Item not found");
    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    console.error("[setItemArchived] failed", { itemId: id, archived, error });
    throw error;
  }
}

const itemDetailsSchema = z.object({
  itemId: z.uuid(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")),
  notes: z.string().max(2000),
  tags: z.string().max(500),
});

export async function updateItemDetails(input: z.infer<typeof itemDetailsSchema>) {
  await requireAllowedUser();
  const value = itemDetailsSchema.parse(input);
  if (isDemoMode()) return { ok: true };

  await getDb()
    .update(items)
    .set({
      returnDeadlineOverride: value.deadline || null,
      notes: value.notes.trim() || null,
      tags: value.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      updatedAt: new Date(),
    })
    .where(eq(items.id, value.itemId));
  revalidatePath("/");
  return { ok: true };
}

export async function syncNow() {
  await requireAllowedUser();
  if (isDemoMode()) return { ok: true, demo: true };
  const sync = await syncGmail();
  const reminders = await sendDailyReminderDigest();
  revalidatePath("/");
  revalidatePath("/settings");
  return { ok: true, sync, reminders };
}

const settingsSchema = z.object({
  importDays: z.coerce.number().int().min(30).max(3650),
  recipients: z.string().max(1000),
});

export async function updateMailboxSettings(formData: FormData) {
  await requireAllowedUser();
  const value = settingsSchema.parse({
    importDays: formData.get("importDays"),
    recipients: formData.get("recipients"),
  });
  const recipients = value.recipients
    .split(",")
    .map((email) => z.email().parse(email.trim().toLowerCase()))
    .filter(Boolean);
  if (isDemoMode()) return;

  const [connection] = await getDb()
    .select({ id: mailboxConnections.id })
    .from(mailboxConnections)
    .where(eq(mailboxConnections.isActive, true))
    .limit(1);
  if (!connection) throw new Error("Connect Gmail before saving mailbox settings");

  await getDb()
    .update(mailboxConnections)
    .set({ importDays: value.importDays, reminderRecipients: recipients, updatedAt: new Date() })
    .where(eq(mailboxConnections.id, connection.id));
  revalidatePath("/settings");
}

export async function resolveParserReview(reviewId: string) {
  const user = await requireAllowedUser();
  const id = idSchema.parse(reviewId);
  if (isDemoMode()) return { ok: true };

  await getDb()
    .update(parserReviews)
    .set({ resolution: "acknowledged", resolvedBy: user.email, resolvedAt: new Date() })
    .where(eq(parserReviews.id, id));
  revalidatePath("/reviews");
  revalidatePath("/");
  return { ok: true };
}
