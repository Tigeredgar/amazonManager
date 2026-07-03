import { describe, expect, it } from "vitest";

import { findItemCandidates } from "@/lib/amazon/matching";

const source = {
  title: "Smart Presence Sensor",
  normalizedTitle: "smart presence sensor",
  quantity: 1,
  priceCents: null,
  imageUrl: null,
};

describe("item matching", () => {
  it("prefers exact normalized title matches", () => {
    const matches = findItemCandidates(source, [
      { id: "1", normalizedTitle: "smart presence sensor" },
      { id: "2", normalizedTitle: "smart presence sensor pro extended" },
    ]);
    expect(matches.map(({ id }) => id)).toEqual(["1"]);
  });

  it("matches a sufficiently long truncated title prefix", () => {
    const matches = findItemCandidates(source, [
      { id: "1", normalizedTitle: "smart presence sensor wireless five zone system" },
    ]);
    expect(matches).toHaveLength(1);
  });

  it("returns all ambiguous prefix candidates instead of guessing", () => {
    const matches = findItemCandidates(source, [
      { id: "1", normalizedTitle: "smart presence sensor wireless" },
      { id: "2", normalizedTitle: "smart presence sensor pro" },
    ]);
    expect(matches).toHaveLength(2);
  });
});
