import type { gmail_v1 } from "googleapis";
import { convert } from "html-to-text";

function decodeBase64Url(value: string) {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function findPart(part: gmail_v1.Schema$MessagePart | undefined, mimeType: string): string | null {
  if (!part) return null;
  if (part.mimeType === mimeType && part.body?.data) return decodeBase64Url(part.body.data);
  for (const child of part.parts ?? []) {
    const value = findPart(child, mimeType);
    if (value) return value;
  }
  return null;
}

export function extractMessageBody(payload: gmail_v1.Schema$MessagePart | undefined) {
  const plain = findPart(payload, "text/plain");
  if (plain) return plain;

  const html = findPart(payload, "text/html");
  if (html) {
    return convert(html, {
      wordwrap: false,
      selectors: [
        { selector: "img", format: "skip" },
        { selector: "a", options: { hideLinkHrefIfSameAsText: true } },
      ],
    });
  }

  return payload?.body?.data ? decodeBase64Url(payload.body.data) : "";
}

export function getHeader(payload: gmail_v1.Schema$MessagePart | undefined, name: string) {
  return payload?.headers?.find((header) => header.name?.toLowerCase() === name.toLowerCase())
    ?.value;
}
