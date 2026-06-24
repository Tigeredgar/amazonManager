import { describe, expect, it } from "vitest";

import { getItemArchiveChanges } from "@/lib/items/archive";

describe("item archive changes", () => {
  const now = new Date("2026-06-24T12:00:00.000Z");

  it("resets the decision when unarchiving so the item is actionable", () => {
    expect(getItemArchiveChanges(false, now)).toEqual({
      archivedAt: null,
      decision: "undecided",
      updatedAt: now,
    });
  });

  it("does not overwrite the decision when archiving directly", () => {
    expect(getItemArchiveChanges(true, now)).toEqual({
      archivedAt: now,
      updatedAt: now,
    });
  });
});
