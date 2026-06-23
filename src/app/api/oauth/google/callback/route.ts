import { google } from "googleapis";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { getDb } from "@/db";
import { mailboxConnections } from "@/db/schema";
import { requireAllowedUser } from "@/lib/auth";
import { reminderRecipients } from "@/lib/env";
import { createGoogleOAuthClient } from "@/lib/gmail/client";
import { encryptSecret } from "@/lib/security/token-crypto";

export async function GET(request: NextRequest) {
  try {
    await requireAllowedUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const error = request.nextUrl.searchParams.get("error");
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("gmail_oauth_state")?.value;
  const verifier = cookieStore.get("gmail_oauth_verifier")?.value;
  cookieStore.delete("gmail_oauth_state");
  cookieStore.delete("gmail_oauth_verifier");

  if (error || !code || !state || state !== expectedState || !verifier) {
    return NextResponse.redirect(new URL("/settings?gmail=failed", request.url));
  }

  try {
    const oauth = createGoogleOAuthClient();
    const { tokens } = await oauth.getToken({ code, codeVerifier: verifier });
    if (!tokens.refresh_token) throw new Error("Google did not return a refresh token");
    oauth.setCredentials(tokens);

    const profile = await google.gmail({ version: "v1", auth: oauth }).users.getProfile({
      userId: "me",
    });
    const email = profile.data.emailAddress?.trim().toLowerCase();
    if (!email) throw new Error("Gmail profile did not include an email address");

    const encrypted = encryptSecret(tokens.refresh_token);
    const db = getDb();
    await db.update(mailboxConnections).set({ isActive: false, updatedAt: new Date() });
    await db
      .insert(mailboxConnections)
      .values({
        email,
        encryptedRefreshToken: encrypted.ciphertext,
        tokenIv: encrypted.iv,
        tokenTag: encrypted.tag,
        reminderRecipients: reminderRecipients(),
        lastSyncStatus: "connected",
      })
      .onConflictDoUpdate({
        target: mailboxConnections.email,
        set: {
          encryptedRefreshToken: encrypted.ciphertext,
          tokenIv: encrypted.iv,
          tokenTag: encrypted.tag,
          isActive: true,
          lastSyncStatus: "connected",
          lastSyncError: null,
          updatedAt: new Date(),
        },
      });

    return NextResponse.redirect(new URL("/settings?gmail=connected", request.url));
  } catch (cause) {
    console.error("Gmail OAuth callback failed", cause);
    return NextResponse.redirect(new URL("/settings?gmail=failed", request.url));
  }
}
