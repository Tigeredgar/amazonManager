import { timingSafeEqual } from "node:crypto";

import { syncGmail } from "@/lib/gmail/sync";
import { sendDailyReminderDigest } from "@/lib/reminders/send-digest";

export const maxDuration = 60;

function authorized(request: Request) {
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  const actual = request.headers.get("authorization") ?? "";
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  return (
    expectedBuffer.length === actualBuffer.length &&
    expectedBuffer.length > "Bearer ".length &&
    timingSafeEqual(expectedBuffer, actualBuffer)
  );
}

export async function GET(request: Request) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });

  try {
    const sync = await syncGmail();
    const reminders = await sendDailyReminderDigest();
    return Response.json({ ok: true, sync, reminders });
  } catch (cause) {
    console.error("Daily tracker job failed", cause);
    return Response.json({ ok: false, error: "Daily job failed" }, { status: 500 });
  }
}
