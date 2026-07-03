import "server-only";

import { sql } from "drizzle-orm";

import { getDb } from "@/db";

let itemImageUrlColumn: boolean | null = null;

export async function hasItemImageUrlColumn() {
  if (itemImageUrlColumn !== null) return itemImageUrlColumn;

  const result = await getDb().execute<{ exists: boolean }>(sql`
    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'items'
        and column_name = 'image_url'
    ) as "exists"
  `);
  const row = result.rows[0];
  itemImageUrlColumn = Boolean(row?.exists);
  return itemImageUrlColumn;
}
