import "server-only";

import { google } from "googleapis";
import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { mailboxConnections } from "@/db/schema";
import { requiredEnv } from "@/lib/env";
import { decryptSecret } from "@/lib/security/token-crypto";

export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
];

export function createGoogleOAuthClient() {
  return new google.auth.OAuth2(
    requiredEnv("GOOGLE_CLIENT_ID"),
    requiredEnv("GOOGLE_CLIENT_SECRET"),
    requiredEnv("GOOGLE_REDIRECT_URI"),
  );
}

export async function getActiveMailbox() {
  const [connection] = await getDb()
    .select()
    .from(mailboxConnections)
    .where(eq(mailboxConnections.isActive, true))
    .limit(1);
  if (!connection) throw new Error("No active Gmail mailbox is connected");
  return connection;
}

export async function getGmailClient() {
  const connection = await getActiveMailbox();
  const oauth = createGoogleOAuthClient();
  oauth.setCredentials({
    refresh_token: decryptSecret({
      ciphertext: connection.encryptedRefreshToken,
      iv: connection.tokenIv,
      tag: connection.tokenTag,
    }),
  });
  return { gmail: google.gmail({ version: "v1", auth: oauth }), connection };
}
