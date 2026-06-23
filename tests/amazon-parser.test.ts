import { describe, expect, it } from "vitest";

import { getSafeAmazonUrl, normalizeEmailText, parseAmazonEmail, parseMoneyToCents } from "@/lib/amazon/parser";
import { delivered, dropoff, ordered, refundIssued, returnRequested, shipped } from "./fixtures/amazon-emails";

describe("Amazon email parser", () => {
  it.each([
    [ordered, "ordered"],
    [shipped, "shipped"],
    [delivered, "delivered"],
    [returnRequested, "return_requested"],
    [dropoff, "dropoff_confirmed"],
    [refundIssued, "refund_issued"],
  ] as const)("classifies %s", (fixture, type) => {
    expect(parseAmazonEmail(fixture).type).toBe(type);
  });

  it("extracts ordered item, destination, totals, and directional order number", () => {
    const parsed = parseAmazonEmail(ordered);
    expect(parsed.orderNumber).toBe("112-0000000-0000001");
    expect(parsed.recipient).toBe("Family");
    expect(parsed.destinationCity).toBe("NORTH TEXAS");
    expect(parsed.items[0]).toMatchObject({ quantity: 1, priceCents: 3399 });
    expect(parsed.orderTotalCents).toBe(3679);
  });

  it("extracts multiple delivered items without quantity rows", () => {
    const parsed = parseAmazonEmail(delivered);
    expect(parsed.items).toHaveLength(2);
    expect(parsed.items.map(({ title }) => title)).toContain(
      "Personal Cooling System with Fan, Cooling Plate and Dry-Touch Mist",
    );
  });

  it("extracts return dropoff and refund metadata", () => {
    const parsed = parseAmazonEmail(returnRequested);
    expect(parsed.dropoffDeadline).toBe("2026-06-27");
    expect(parsed.dropoffLocation).toBe("Any UPS Dropoff location");
    expect(parsed.expectedRefundCents).toBe(5411);
    expect(parsed.refundMethodMasked).toBe("Visa ending in 0000");
  });

  it("extracts the promised credit date", () => {
    const parsed = parseAmazonEmail(refundIssued);
    expect(parsed.actualRefundCents).toBe(3138);
    expect(parsed.promisedRefundDate).toBe("2026-06-26");
  });

  it("extracts the promised refund date from a dropoff confirmation", () => {
    expect(parseAmazonEmail(dropoff).promisedRefundDate).toBe("2026-06-30");
  });

  it("normalizes formatting and parses money", () => {
    expect(normalizeEmailText("Order \u202a#\u00a0 112")).toBe("Order # 112");
    expect(parseMoneyToCents("Total $1,234.56")).toBe(123456);
  });

  it("decodes only trusted Amazon redirects", () => {
    const target = "https://www.amazon.com/gp/css/order-history?ref_=email";
    const redirect = `https://www.amazon.com/gp/r.html?U=${encodeURIComponent(target)}`;
    expect(getSafeAmazonUrl(`[Orders](${redirect})`)).toBe(target);
    expect(getSafeAmazonUrl("https://amazon.com.evil.example/orders")).toBeNull();
  });
});
