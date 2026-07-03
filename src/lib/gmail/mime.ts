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

function validateAmazonImageHost(hostname: string) {
  const host = hostname.toLowerCase();
  return (
    host === "m.media-amazon.com" ||
    host.endsWith(".media-amazon.com") ||
    host.endsWith(".ssl-images-amazon.com") ||
    host.endsWith(".images-amazon.com")
  );
}

function attributeValue(attributes: string, name: string) {
  const match = attributes.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return match?.[2] ?? match?.[3] ?? match?.[4] ?? null;
}

function numericAttribute(attributes: string, name: string) {
  const value = attributeValue(attributes, name);
  if (!value) return null;
  const numeric = Number(value.replace(/px$/i, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeAmazonImageUrl(src: string) {
  try {
    const url = new URL(src.replace(/&amp;/g, "&"));
    if (url.protocol !== "https:" || !validateAmazonImageHost(url.hostname)) return null;
    if (!url.pathname.includes("/images/I/")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function extractAmazonImageUrls(html: string) {
  const urls: string[] = [];
  for (const match of html.matchAll(/<img\b([^>]*)>/gi)) {
    const attributes = match[1] ?? "";
    const width = numericAttribute(attributes, "width");
    const height = numericAttribute(attributes, "height");
    if ((width !== null && width <= 2) || (height !== null && height <= 2)) continue;

    const src = attributeValue(attributes, "src");
    if (!src) continue;
    const normalized = normalizeAmazonImageUrl(src);
    if (normalized && !urls.includes(normalized)) urls.push(normalized);
  }
  return urls;
}

export function extractMessageBody(payload: gmail_v1.Schema$MessagePart | undefined) {
  return extractMessageContent(payload).body;
}

export function extractMessageContent(payload: gmail_v1.Schema$MessagePart | undefined) {
  const plain = findPart(payload, "text/plain");
  const html = findPart(payload, "text/html");
  const body = plain ?? (html ? convert(html, {
    wordwrap: false,
    selectors: [
      { selector: "img", format: "skip" },
      { selector: "a", options: { hideLinkHrefIfSameAsText: true } },
    ],
  }) : payload?.body?.data ? decodeBase64Url(payload.body.data) : "");

  return {
    body,
    imageUrls: html ? extractAmazonImageUrls(html) : [],
  };
}

export function getHeader(payload: gmail_v1.Schema$MessagePart | undefined, name: string) {
  return payload?.headers?.find((header) => header.name?.toLowerCase() === name.toLowerCase())
    ?.value;
}
