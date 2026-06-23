import { describe, expect, it } from "vitest";

import { evaluateReminder } from "@/lib/reminders/rules";

const base = {
  itemId: "item-1",
  archived: false,
  decision: "undecided",
  eligibilityDeadline: "2026-03-15",
  returnState: null,
  dropoffDeadline: null,
  promisedRefundDate: null,
};

describe("reminder rules", () => {
  it("triggers eligibility reminders at 7, 3, and 1 calendar days", () => {
    expect(evaluateReminder(base, "2026-03-08")?.thresholdDays).toBe(7);
    expect(evaluateReminder(base, "2026-03-12")?.thresholdDays).toBe(3);
    expect(evaluateReminder(base, "2026-03-14")?.thresholdDays).toBe(1);
  });

  it("uses calendar days across the spring DST boundary", () => {
    expect(evaluateReminder({ ...base, eligibilityDeadline: "2026-03-10" }, "2026-03-09")?.thresholdDays).toBe(1);
  });

  it("switches a requested return to its dropoff deadline", () => {
    const result = evaluateReminder(
      { ...base, returnState: "requested", dropoffDeadline: "2026-03-11" },
      "2026-03-08",
    );
    expect(result).toMatchObject({ kind: "dropoff", thresholdDays: 3 });
  });

  it("sends one overdue-refund rule after the promised date", () => {
    const result = evaluateReminder(
      { ...base, returnState: "dropped_off", promisedRefundDate: "2026-03-07" },
      "2026-03-08",
    );
    expect(result).toMatchObject({ kind: "refund_overdue", thresholdDays: 0 });
  });

  it("suppresses archived, kept, and non-threshold items", () => {
    expect(evaluateReminder({ ...base, archived: true }, "2026-03-08")).toBeNull();
    expect(evaluateReminder({ ...base, decision: "keep" }, "2026-03-08")).toBeNull();
    expect(evaluateReminder(base, "2026-03-09")).toBeNull();
  });
});
