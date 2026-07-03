import { createHash } from "node:crypto";

import { format, parse } from "date-fns";

import type {
  AmazonEmailInput,
  AmazonEventType,
  ParsedAmazonEmail,
  ParsedAmazonItem,
} from "./types";

const ORDER_NUMBER = /Order\s*#\s*[^\d]*(\d{3}-\d{7}-\d{7})/i;
const MONEY = /\$\s*([\d,]+(?:\.\d{2})?)/;
const BIDI_AND_FORMATTING = /[\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g;
const NON_PRODUCT_LINES = /^(quantity|total|grand total|ordered|shipped|pending|completed|delivered|out for delivery|track package|view or edit order|view return request|return label|print label|share label|cancel return|item\(s\)|refund|return shipping|continue shopping|categorylist|info icon|alexa-|©|learn more|see locations|change return method|special instruction)/i;

export function normalizeEmailText(value: string) {
  return value
    .replace(BIDI_AND_FORMATTING, "")
    .replace(/\u00a0/g, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function cleanProductTitle(value: string) {
  const cleaned = normalizeEmailText(value).replace(/^[*•-]\s+/, "");
  const markdownLink = cleaned.match(/^\[([^\]]+)]\((https?:\/\/[^)]+)\)$/i);
  return normalizeEmailText(markdownLink?.[1] ?? cleaned);
}

export function normalizeTitle(value: string) {
  return cleanProductTitle(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function parseMoneyToCents(value: string | null | undefined) {
  if (!value) return null;
  const match = value.match(MONEY);
  if (!match) return null;
  return Math.round(Number(match[1].replace(/,/g, "")) * 100);
}

function classifySubject(subject: string): AmazonEventType {
  const normalized = subject.trim().toLowerCase();
  if (normalized.startsWith("ordered:")) return "ordered";
  if (normalized.startsWith("shipped:")) return "shipped";
  if (normalized.startsWith("delivered:")) return "delivered";
  if (normalized.startsWith("return request confirmed")) return "return_requested";
  if (normalized.startsWith("dropoff confirmed")) return "dropoff_confirmed";
  if (normalized.includes("refund issued")) return "refund_issued";
  return "unknown";
}

function isProductCandidate(line: string) {
  return (
    line.length >= 12 &&
    !NON_PRODUCT_LINES.test(line) &&
    !ORDER_NUMBER.test(line) &&
    !MONEY.test(line) &&
    !/^\w+\s+-\s+[A-Z .'-]+,\s*[A-Z]{2}$/i.test(line) &&
    !/^https?:\/\//i.test(line)
  );
}

function extractItems(lines: string[], type: AmazonEventType): ParsedAmazonItem[] {
  const results: ParsedAmazonItem[] = [];

  lines.forEach((line, index) => {
    const quantityMatch = line.match(/^Quantity:\s*(\d+)/i);
    if (!quantityMatch) return;

    const candidates = lines
      .slice(Math.max(0, index - 5), index)
      .filter(isProductCandidate)
      .sort((a, b) => b.length - a.length);
    const titleCandidate = candidates[0];
    if (!titleCandidate) return;
    const title = cleanProductTitle(titleCandidate);

    const priceLine = lines.slice(index + 1, index + 4).find((entry) => MONEY.test(entry));
    results.push({
      title,
      normalizedTitle: normalizeTitle(title),
      quantity: Number(quantityMatch[1]),
      priceCents: parseMoneyToCents(priceLine),
      imageUrl: null,
    });
  });

  if (results.length || type !== "delivered") return dedupeItems(results);

  const orderIndex = lines.findIndex((line) => ORDER_NUMBER.test(line));
  const endIndex = lines.findIndex(
    (line, index) => index > orderIndex && /^(info icon|how was your delivery|alexa-|©)/i.test(line),
  );
  const candidates = lines
    .slice(orderIndex + 1, endIndex > orderIndex ? endIndex : undefined)
    .filter((line) => line.length >= 28 && isProductCandidate(line));

  return dedupeItems(
    candidates.map((titleCandidate) => ({
      title: cleanProductTitle(titleCandidate),
      normalizedTitle: normalizeTitle(titleCandidate),
      quantity: 1,
      priceCents: null,
      imageUrl: null,
    })),
  );
}

function dedupeItems(items: ParsedAmazonItem[]) {
  const unique = new Map<string, ParsedAmazonItem>();
  for (const item of items) {
    const existing = unique.get(item.normalizedTitle);
    if (!existing || item.title.length > existing.title.length) {
      unique.set(item.normalizedTitle, item);
    }
  }
  return [...unique.values()];
}

function parseMonthDate(value: string | undefined, reference: Date) {
  if (!value) return null;
  const cleaned = value.replace(/^[A-Za-z]{3},\s*/, "").trim();
  let parsed = parse(`${cleaned}, ${reference.getFullYear()}`, "MMM d, yyyy", reference);
  if (Number.isNaN(parsed.getTime())) return null;
  const difference = parsed.getTime() - reference.getTime();
  if (difference < -1000 * 60 * 60 * 24 * 180) {
    parsed = parse(`${cleaned}, ${reference.getFullYear() + 1}`, "MMM d, yyyy", reference);
  }
  return format(parsed, "yyyy-MM-dd");
}

function validateAmazonHost(hostname: string) {
  const host = hostname.toLowerCase();
  return host === "amazon.com" || host.endsWith(".amazon.com");
}

export function getSafeAmazonUrl(body: string) {
  const matches = body.match(/https?:\/\/[^\s)<>"']+/g) ?? [];
  for (const candidate of matches) {
    try {
      const outer = new URL(candidate.replace(/&amp;/g, "&"));
      if (!validateAmazonHost(outer.hostname)) continue;
      const redirectTarget = outer.searchParams.get("U");
      if (!redirectTarget) return outer.toString();
      const inner = new URL(decodeURIComponent(redirectTarget));
      if (validateAmazonHost(inner.hostname)) return inner.toString();
    } catch {
      // Ignore malformed or untrusted links and keep looking.
    }
  }
  return null;
}

function extractLocation(lines: string[], orderLineIndex: number) {
  const candidate = lines
    .slice(Math.max(0, orderLineIndex - 4), orderLineIndex)
    .reverse()
    .find((line) => /\s-\s.+,\s*[A-Z]{2}$/i.test(line));
  const match = candidate?.match(/^(.+?)\s+-\s+(.+),\s*([A-Z]{2})$/i);
  return {
    recipient: match?.[1]?.trim() ?? null,
    city: match?.[2]?.trim() ?? null,
    state: match?.[3]?.toUpperCase() ?? null,
  };
}

export function emailBodyHash(body: string) {
  return createHash("sha256").update(normalizeEmailText(body)).digest("hex");
}

export function parseAmazonEmail(input: AmazonEmailInput): ParsedAmazonEmail {
  const body = normalizeEmailText(input.body);
  const lines = body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const type = classifySubject(input.subject);
  const orderLineIndex = lines.findIndex((line) => ORDER_NUMBER.test(line));
  const orderNumber = body.match(ORDER_NUMBER)?.[1] ?? null;
  const location = extractLocation(lines, orderLineIndex);
  const imageUrls = input.imageUrls ?? [];
  const items = extractItems(lines, type).map((item, index) => ({
    ...item,
    imageUrl: imageUrls[index] ?? null,
  }));

  const totalLine = lines.find((line) => /^(grand )?total\s*:?/i.test(line));
  const refundLines = lines.filter((line) => /^(total estimated refund|total refund|refund subtotal)/i.test(line));
  const expectedRefundCents = parseMoneyToCents(refundLines.at(-1));
  const creditMatch = body.match(/\$\s*[\d,.]+\s+will be credited[^\n]*?by\s+([A-Za-z]{3}\s+\d{1,2})/i);
  const issuedByMatch = body.match(/Refund will be issued by\s+([A-Za-z]{3}\s+\d{1,2})/i);
  const dropoffMatch = body.match(/Drop off by\s*\n?\s*([A-Za-z]{3},\s*[A-Za-z]{3}\s+\d{1,2})/i);
  const dropoffLocation = body.match(/Dropoff location\s*\n?\s*([^\n]+)/i)?.[1]?.trim() ?? null;
  const refundMethod = body.match(/\$[\d,.]+\s+to your\s+([^\n]+)/i)?.[1]?.trim() ?? null;
  const warnings: string[] = [];

  if (type === "unknown") warnings.push("Unsupported Amazon subject");
  if (!orderNumber) warnings.push("Order number was not found");
  if (!items.length && type !== "unknown") warnings.push("No item could be extracted");

  return {
    type,
    orderNumber,
    recipient: location.recipient,
    destinationCity: location.city,
    destinationState: location.state,
    occurredAt: input.receivedAt.toISOString(),
    items,
    orderTotalCents: parseMoneyToCents(totalLine),
    amazonUrl: getSafeAmazonUrl(input.body),
    dropoffDeadline: parseMonthDate(dropoffMatch?.[1], input.receivedAt),
    dropoffLocation,
    expectedRefundCents,
    actualRefundCents: type === "refund_issued" ? expectedRefundCents : null,
    promisedRefundDate: parseMonthDate(creditMatch?.[1] ?? issuedByMatch?.[1], input.receivedAt),
    refundMethodMasked: refundMethod,
    confidence: warnings.length === 0 ? "high" : orderNumber ? "medium" : "low",
    warnings,
  };
}
