import { createHash, randomBytes } from "node:crypto";

import { CodeChallengeMethod } from "google-auth-library";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { requireAllowedUser } from "@/lib/auth";
import { createGoogleOAuthClient, GMAIL_SCOPES } from "@/lib/gmail/client";

function base64Url(value: Buffer) {
  return value.toString("base64url");
}

export async function GET() {
  try {
    await requireAllowedUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const state = base64Url(randomBytes(24));
  const verifier = base64Url(randomBytes(48));
  const challenge = base64Url(createHash("sha256").update(verifier).digest());
  const cookieStore = await cookies();
  const options = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  };

  cookieStore.set("gmail_oauth_state", state, options);
  cookieStore.set("gmail_oauth_verifier", verifier, options);

  const authorizationUrl = createGoogleOAuthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GMAIL_SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: CodeChallengeMethod.S256,
  });
  return NextResponse.redirect(authorizationUrl);
}
