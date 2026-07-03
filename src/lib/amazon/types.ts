export const AMAZON_EVENT_TYPES = [
  "ordered",
  "shipped",
  "delivered",
  "return_requested",
  "dropoff_confirmed",
  "refund_issued",
  "unknown",
] as const;

export type AmazonEventType = (typeof AMAZON_EVENT_TYPES)[number];

export type ParsedAmazonItem = {
  title: string;
  normalizedTitle: string;
  quantity: number;
  priceCents: number | null;
  imageUrl: string | null;
};

export type ParsedAmazonEmail = {
  type: AmazonEventType;
  orderNumber: string | null;
  recipient: string | null;
  destinationCity: string | null;
  destinationState: string | null;
  occurredAt: string;
  items: ParsedAmazonItem[];
  orderTotalCents: number | null;
  amazonUrl: string | null;
  dropoffDeadline: string | null;
  dropoffLocation: string | null;
  expectedRefundCents: number | null;
  actualRefundCents: number | null;
  promisedRefundDate: string | null;
  refundMethodMasked: string | null;
  confidence: "high" | "medium" | "low";
  warnings: string[];
};

export type AmazonEmailInput = {
  id: string;
  threadId?: string | null;
  subject: string;
  body: string;
  imageUrls?: string[];
  receivedAt: Date;
};
