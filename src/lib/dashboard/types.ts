export type DashboardItem = {
  id: string;
  title: string;
  quantity: number;
  priceCents: number | null;
  lifecycleStatus: string;
  decision: string;
  returnState: string | null;
  deliveredAt: string | null;
  deadline: string | null;
  deadlineSource: "estimated" | "confirmed" | "override" | null;
  dropoffDeadline: string | null;
  promisedRefundDate: string | null;
  expectedRefundCents: number | null;
  actualRefundCents: number | null;
  refundMethodMasked: string | null;
  notes: string | null;
  tags: string[];
  amazonUrl: string | null;
  archivedAt: string | null;
};

export type DashboardOrder = {
  id: string;
  orderNumber: string;
  orderedAt: string | null;
  recipient: string | null;
  destination: string | null;
  totalCents: number | null;
  amazonUrl: string | null;
  items: DashboardItem[];
};

export type DashboardData = {
  orders: DashboardOrder[];
  metrics: {
    dueSoon: number;
    moneyAtRiskCents: number;
    pendingRefundCents: number;
    needsReview: number;
  };
  mailbox: {
    connected: boolean;
    email: string | null;
    lastSyncAt: string | null;
    status: string | null;
    error: string | null;
    moreAvailable: boolean;
  };
};
