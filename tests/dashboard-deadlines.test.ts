import { describe, expect, it } from "vitest";

import { activeDashboardDeadline, dashboardDeadlineStatus } from "@/lib/dashboard/deadlines";

const base = {
  deadline: "2026-03-20",
  deadlineSource: "estimated" as const,
  dropoffDeadline: null,
  promisedRefundDate: null,
  returnState: null,
};

describe("dashboard deadlines", () => {
  it("does not display overdue day counts beyond three days", () => {
    expect(dashboardDeadlineStatus("2026-03-07", "2026-03-10").label).toBe("3d overdue");
    expect(dashboardDeadlineStatus("2026-03-07", "2026-03-11").label).toBe("Needs review");
  });

  it("uses the promised refund date for pending refunds instead of the return deadline", () => {
    expect(
      activeDashboardDeadline({
        ...base,
        returnState: "dropped_off",
        promisedRefundDate: "2026-03-15",
      }),
    ).toMatchObject({
      value: "2026-03-15",
      label: "Refund by",
    });
  });

  it("does not show an active deadline for finalized refunds", () => {
    expect(
      activeDashboardDeadline({
        ...base,
        returnState: "refunded",
        promisedRefundDate: "2026-03-15",
      }),
    ).toBeNull();
  });
});
