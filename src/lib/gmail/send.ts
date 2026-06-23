import "server-only";

import { getGmailClient } from "./client";

function encodeHeader(value: string) {
  return `=?UTF-8?B?${Buffer.from(value).toString("base64")}?=`;
}

export async function sendGmailMessage(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) {
  const boundary = `return-window-${crypto.randomUUID()}`;
  const raw = [
    `To: ${input.to}`,
    `Subject: ${encodeHeader(input.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    input.text,
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    input.html,
    "",
    `--${boundary}--`,
  ].join("\r\n");

  const { gmail } = await getGmailClient();
  const response = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: Buffer.from(raw).toString("base64url") },
  });
  return response.data.id ?? null;
}
