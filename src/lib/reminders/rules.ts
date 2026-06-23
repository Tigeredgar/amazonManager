import { differenceInCalendarDays, parseISO } from "date-fns";

export const REMINDER_THRESHOLDS = [7, 3, 1] as const;

export type ReminderInput = {
  itemId: string;
  archived: boolean;
  decision: string;
  eligibilityDeadline: string | null;
  returnState: string | null;
  dropoffDeadline: string | null;
  promisedRefundDate: string | null;
};

export type ReminderRuleMatch = {
  itemId: string;
  kind: "eligibility" | "dropoff" | "refund_overdue";
  targetDate: string;
  thresholdDays: number;
};

function calendarDaysUntil(target: string, today: string) {
  return differenceInCalendarDays(parseISO(target), parseISO(today));
}

export function evaluateReminder(input: ReminderInput, today: string): ReminderRuleMatch | null {
  if (input.archived) return null;

  if (
    input.returnState === "requested" &&
    input.dropoffDeadline &&
    REMINDER_THRESHOLDS.includes(
      calendarDaysUntil(input.dropoffDeadline, today) as (typeof REMINDER_THRESHOLDS)[number],
    )
  ) {
    return {
      itemId: input.itemId,
      kind: "dropoff",
      targetDate: input.dropoffDeadline,
      thresholdDays: calendarDaysUntil(input.dropoffDeadline, today),
    };
  }

  if (
    (input.returnState === "dropped_off" || input.returnState === "refund_pending") &&
    input.promisedRefundDate &&
    calendarDaysUntil(input.promisedRefundDate, today) < 0
  ) {
    return {
      itemId: input.itemId,
      kind: "refund_overdue",
      targetDate: input.promisedRefundDate,
      thresholdDays: 0,
    };
  }

  const eligibilityDays = input.eligibilityDeadline
    ? calendarDaysUntil(input.eligibilityDeadline, today)
    : null;
  if (
    !input.returnState &&
    input.decision !== "keep" &&
    input.eligibilityDeadline &&
    REMINDER_THRESHOLDS.includes(
      eligibilityDays as (typeof REMINDER_THRESHOLDS)[number],
    )
  ) {
    return {
      itemId: input.itemId,
      kind: "eligibility",
      targetDate: input.eligibilityDeadline,
      thresholdDays: eligibilityDays!,
    };
  }

  return null;
}
