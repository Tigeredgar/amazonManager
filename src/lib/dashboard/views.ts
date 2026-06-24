import type { DashboardItem, DashboardOrder } from "./types";

export const dashboardViewNames = [
  "attention",
  "returns",
  "transit",
  "archived",
  "finalized",
] as const;

export type DashboardViewName = (typeof dashboardViewNames)[number];

type ViewItem = Pick<
  DashboardItem,
  "archivedAt" | "decision" | "lifecycleStatus" | "returnState"
>;

export function belongsToDashboardView(item: ViewItem, view: DashboardViewName) {
  if (view === "finalized") return Boolean(item.archivedAt && item.returnState === "refunded");
  if (view === "archived") return Boolean(item.archivedAt && item.returnState !== "refunded");
  if (item.archivedAt) return false;
  if (view === "returns") return Boolean(item.returnState || item.decision === "return_planned");
  if (view === "transit") return item.lifecycleStatus !== "delivered";
  return item.lifecycleStatus === "delivered" && !item.returnState && item.decision === "undecided";
}

type DeliveryOrder = Pick<DashboardOrder, "destination" | "recipient">;

export function matchesDeliveryFilters(
  order: DeliveryOrder,
  recipient: string | null,
  destination: string | null,
) {
  return (
    (!recipient || order.recipient === recipient) &&
    (!destination || order.destination === destination)
  );
}
