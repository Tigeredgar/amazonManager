import { differenceInCalendarDays, parseISO } from "date-fns";

import type { DashboardItem } from "./types";

type DeadlineItem = Pick<
  DashboardItem,
  "deadline" | "deadlineSource" | "dropoffDeadline" | "promisedRefundDate" | "returnState"
>;

export type DashboardDeadline = {
  value: string;
  label: string;
  source: "confirmed" | "estimated" | "manual";
};

export function activeDashboardDeadline(item: DeadlineItem): DashboardDeadline | null {
  if (item.returnState === "refunded") return null;

  if (item.returnState === "requested" && item.dropoffDeadline) {
    return { value: item.dropoffDeadline, label: "Drop off by", source: "confirmed" };
  }

  if (
    (item.returnState === "dropped_off" || item.returnState === "refund_pending") &&
    item.promisedRefundDate
  ) {
    return { value: item.promisedRefundDate, label: "Refund by", source: "confirmed" };
  }

  if (item.deadline) {
    return {
      value: item.deadline,
      label: "Return by",
      source: item.deadlineSource === "estimated" ? "estimated" : "manual",
    };
  }

  if (item.promisedRefundDate) {
    return { value: item.promisedRefundDate, label: "Refund by", source: "confirmed" };
  }

  return null;
}

export function dashboardDeadlineStatus(value: string, today: Date | string = new Date()) {
  const todayDate = typeof today === "string" ? parseISO(today) : today;
  const days = differenceInCalendarDays(parseISO(value), todayDate);

  return {
    days,
    urgent: days <= 3,
    label: days < -3 ? "Needs review" : days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "Today" : `${days}d left`,
  };
}
