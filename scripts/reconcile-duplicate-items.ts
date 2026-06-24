import { neon } from "@neondatabase/serverless";

import { cleanProductTitle, normalizeTitle } from "../src/lib/amazon/parser";

type ItemRow = {
  id: string;
  order_id: string;
  order_number: string;
  title: string;
  quantity: number;
  unit_price_cents: number | null;
  lifecycle_status: string;
  decision: string;
  delivered_at: Date | null;
  estimated_return_deadline: string | null;
  return_deadline_override: string | null;
  amazon_url: string | null;
  notes: string | null;
  tags: string[];
  archived_at: Date | null;
  return_state: string | null;
  requested_at: Date | null;
  dropoff_deadline: string | null;
  dropoff_location: string | null;
  dropped_off_at: Date | null;
  expected_refund_cents: number | null;
  actual_refund_cents: number | null;
  promised_refund_date: string | null;
  refund_issued_at: Date | null;
  refund_method_masked: string | null;
};

type MergeGroup = {
  orderNumber: string;
  survivor: ItemRow;
  duplicates: ItemRow[];
  merged: ItemRow;
};

const lifecycleRank: Record<string, number> = { ordered: 1, shipped: 2, delivered: 3 };
const decisionRank: Record<string, number> = { undecided: 1, keep: 2, return_planned: 3 };
const returnRank: Record<string, number> = {
  requested: 1,
  dropped_off: 2,
  refund_pending: 3,
  refunded: 4,
};

function asinFromMarkdownTitle(title: string) {
  const url = title.match(/^\[[^\]]+]\((https?:\/\/[^)]+)\)$/i)?.[1];
  if (!url) return null;
  try {
    return new URL(url).pathname.match(/\/gp\/product\/([A-Z0-9]{10})/i)?.[1]?.toUpperCase() ?? null;
  } catch {
    return null;
  }
}

function prefixMatches(left: string, right: string) {
  const shorter = left.length < right.length ? left : right;
  const longer = left.length < right.length ? right : left;
  return shorter.length >= 16 && longer.startsWith(shorter);
}

function highest<T>(rows: T[], rank: (row: T) => number) {
  return [...rows].sort((left, right) => rank(right) - rank(left))[0];
}

function firstValue<T>(rows: ItemRow[], select: (row: ItemRow) => T | null) {
  for (const row of rows) {
    const value = select(row);
    if (value !== null) return value;
  }
  return null;
}

function mergeRows(rows: ItemRow[], survivor: ItemRow): ItemRow {
  const bestTitle = highest(rows, (row) => cleanProductTitle(row.title).length);
  const bestLifecycle = highest(rows, (row) => lifecycleRank[row.lifecycle_status] ?? 0);
  const bestDecision = highest(rows, (row) => decisionRank[row.decision] ?? 0);
  const bestReturn = highest(
    rows.filter((row) => row.return_state),
    (row) => returnRank[row.return_state ?? ""] ?? 0,
  );
  const tags = [...new Set(rows.flatMap((row) => row.tags ?? []))];
  const notes = [...new Set(rows.map((row) => row.notes).filter(Boolean))].join("\n\n") || null;

  return {
    ...survivor,
    title: cleanProductTitle(bestTitle.title),
    quantity: Math.max(...rows.map((row) => row.quantity)),
    unit_price_cents: firstValue(rows, (row) => row.unit_price_cents),
    lifecycle_status: bestLifecycle.lifecycle_status,
    decision: bestDecision.decision,
    delivered_at: firstValue(rows, (row) => row.delivered_at),
    estimated_return_deadline: firstValue(rows, (row) => row.estimated_return_deadline),
    return_deadline_override: firstValue(rows, (row) => row.return_deadline_override),
    amazon_url: firstValue(rows, (row) => row.amazon_url),
    notes,
    tags,
    archived_at: firstValue(rows, (row) => row.archived_at),
    return_state: bestReturn?.return_state ?? null,
    requested_at: firstValue(rows, (row) => row.requested_at),
    dropoff_deadline: firstValue(rows, (row) => row.dropoff_deadline),
    dropoff_location: firstValue(rows, (row) => row.dropoff_location),
    dropped_off_at: firstValue(rows, (row) => row.dropped_off_at),
    expected_refund_cents: firstValue(rows, (row) => row.expected_refund_cents),
    actual_refund_cents: firstValue(rows, (row) => row.actual_refund_cents),
    promised_refund_date: firstValue(rows, (row) => row.promised_refund_date),
    refund_issued_at: firstValue(rows, (row) => row.refund_issued_at),
    refund_method_masked: firstValue(rows, (row) => row.refund_method_masked),
  };
}

function findMergeGroups(rows: ItemRow[]) {
  const byOrder = Map.groupBy(rows, (row) => row.order_id);
  const groups: MergeGroup[] = [];

  for (const orderRows of byOrder.values()) {
    const linkedByAsin = Map.groupBy(
      orderRows.filter((row) => asinFromMarkdownTitle(row.title)),
      (row) => asinFromMarkdownTitle(row.title)!,
    );

    for (const linkedRows of linkedByAsin.values()) {
      const linkedIds = new Set(linkedRows.map((row) => row.id));
      const linkedTitles = linkedRows.map((row) => normalizeTitle(row.title));
      const plainMatches = orderRows.filter(
        (row) =>
          !linkedIds.has(row.id) &&
          linkedTitles.some((linkedTitle) => prefixMatches(linkedTitle, normalizeTitle(row.title))),
      );
      if (plainMatches.length > 1) {
        console.warn(`Skipping ambiguous order ${linkedRows[0].order_number}`);
        continue;
      }

      const groupRows = [...linkedRows, ...plainMatches];
      if (groupRows.length < 2) continue;
      const survivor = plainMatches[0] ?? highest(groupRows, (row) => returnRank[row.return_state ?? ""] ?? 0);
      groups.push({
        orderNumber: survivor.order_number,
        survivor,
        duplicates: groupRows.filter((row) => row.id !== survivor.id),
        merged: mergeRows(groupRows, survivor),
      });
    }
  }

  return groups;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const sql = neon(databaseUrl);
  const rows = (await sql`
    select
      i.*,
      o.order_number,
      r.state as return_state,
      r.requested_at,
      r.dropoff_deadline,
      r.dropoff_location,
      r.dropped_off_at,
      r.expected_refund_cents,
      r.actual_refund_cents,
      r.promised_refund_date,
      r.refund_issued_at,
      r.refund_method_masked
    from items i
    join orders o on o.id = i.order_id
    left join returns r on r.item_id = i.id
    order by i.created_at
  `) as ItemRow[];
  const groups = findMergeGroups(rows);

  console.log(
    JSON.stringify(
      groups.map((group) => ({
        orderNumber: group.orderNumber,
        survivorId: group.survivor.id,
        removedIds: group.duplicates.map((row) => row.id),
        finalState: group.merged.return_state,
        archived: Boolean(group.merged.archived_at),
      })),
      null,
      2,
    ),
  );

  if (!process.argv.includes("--apply") || !groups.length) {
    console.log(`Dry run: ${groups.length} merge group(s). Pass --apply to commit.`);
    return;
  }

  await sql.transaction((tx) =>
    groups.flatMap(({ survivor, duplicates, merged }) => {
      const itemIds = [survivor.id, ...duplicates.map((row) => row.id)];
      const duplicateIds = duplicates.map((row) => row.id);
      const queries = [
        tx`delete from returns where item_id = any(${itemIds}::uuid[])`,
        tx`update items set
          title = ${merged.title},
          normalized_title = ${normalizeTitle(merged.title)},
          quantity = ${merged.quantity},
          unit_price_cents = ${merged.unit_price_cents},
          lifecycle_status = ${merged.lifecycle_status},
          decision = ${merged.decision},
          delivered_at = ${merged.delivered_at},
          estimated_return_deadline = ${merged.estimated_return_deadline},
          return_deadline_override = ${merged.return_deadline_override},
          amazon_url = ${merged.amazon_url},
          notes = ${merged.notes},
          tags = ${JSON.stringify(merged.tags)}::jsonb,
          archived_at = ${merged.archived_at},
          updated_at = now()
        where id = ${survivor.id}::uuid`,
        tx`delete from items where id = any(${duplicateIds}::uuid[])`,
      ];
      if (merged.return_state) {
        queries.push(tx`insert into returns (
          item_id, state, requested_at, dropoff_deadline, dropoff_location, dropped_off_at,
          expected_refund_cents, actual_refund_cents, promised_refund_date, refund_issued_at,
          refund_method_masked
        ) values (
          ${survivor.id}::uuid, ${merged.return_state}, ${merged.requested_at},
          ${merged.dropoff_deadline}, ${merged.dropoff_location}, ${merged.dropped_off_at},
          ${merged.expected_refund_cents}, ${merged.actual_refund_cents},
          ${merged.promised_refund_date}, ${merged.refund_issued_at}, ${merged.refund_method_masked}
        )`);
      }
      return queries;
    }),
  );

  console.log(`Applied ${groups.length} merge group(s).`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
