import { describe, expect, it } from "vitest";

import { belongsToDashboardView, matchesDeliveryFilters } from "@/lib/dashboard/views";

const delivered = {
  archivedAt: null,
  decision: "undecided",
  lifecycleStatus: "delivered",
  returnState: null,
};

describe("dashboard views", () => {
  it("shows only undecided delivered items under needs attention", () => {
    expect(belongsToDashboardView(delivered, "attention")).toBe(true);
    expect(
      belongsToDashboardView({ ...delivered, decision: "return_planned" }, "attention"),
    ).toBe(false);
    expect(
      belongsToDashboardView({ ...delivered, returnState: "requested" }, "attention"),
    ).toBe(false);
  });

  it("moves planned and confirmed returns to the returns view", () => {
    expect(
      belongsToDashboardView({ ...delivered, decision: "return_planned" }, "returns"),
    ).toBe(true);
    expect(
      belongsToDashboardView({ ...delivered, returnState: "refunded" }, "returns"),
    ).toBe(true);
  });

  it("separates ordinary archived items from finalized refunds", () => {
    const archived = { ...delivered, archivedAt: "2026-06-23T12:00:00.000Z" };
    const finalized = { ...archived, returnState: "refunded" };
    expect(belongsToDashboardView(archived, "attention")).toBe(false);
    expect(belongsToDashboardView(archived, "archived")).toBe(true);
    expect(belongsToDashboardView(archived, "finalized")).toBe(false);
    expect(belongsToDashboardView(finalized, "archived")).toBe(false);
    expect(belongsToDashboardView(finalized, "finalized")).toBe(true);
  });

  it("filters orders by recipient and destination independently or together", () => {
    const order = { recipient: "Alex", destination: "Dallas, TX" };
    expect(matchesDeliveryFilters(order, null, null)).toBe(true);
    expect(matchesDeliveryFilters(order, "Alex", null)).toBe(true);
    expect(matchesDeliveryFilters(order, null, "Dallas, TX")).toBe(true);
    expect(matchesDeliveryFilters(order, "Jordan", null)).toBe(false);
    expect(matchesDeliveryFilters(order, "Alex", "Austin, TX")).toBe(false);
  });
});
