import "server-only";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { requiredEnv } from "@/lib/env";
import * as schema from "./schema";

function createDb() {
  return drizzle(neon(requiredEnv("DATABASE_URL")), { schema });
}

let database: ReturnType<typeof createDb> | null = null;

export function getDb() {
  database ??= createDb();
  return database;
}

export type Database = ReturnType<typeof getDb>;
