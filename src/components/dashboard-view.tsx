"use client";

import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { Archive, Box, CalendarClock, CheckCircle2, CircleDollarSign, MapPin, PackageOpen, Search, UserRound, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DashboardItem, DashboardOrder } from "@/lib/dashboard/types";
import { belongsToDashboardView, dashboardViewNames, matchesDeliveryFilters, type DashboardViewName } from "@/lib/dashboard/views";
import { ItemActions } from "./item-actions";

const ALL_FILTER = "__all__";

function currency(cents: number | null) {
  if (cents === null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function shortDate(value: string | null) {
  if (!value) return "Unknown";
  return format(parseISO(value), "MMM d, yyyy");
}

function status(item: DashboardItem) {
  if (item.archivedAt && item.returnState === "refunded") {
    return { label: "Finalized", variant: "secondary" as const };
  }
  if (item.archivedAt && item.decision === "keep") {
    return { label: "Kept", variant: "secondary" as const };
  }
  if (item.archivedAt) return { label: "Archived", variant: "secondary" as const };
  if (item.returnState === "refunded") return { label: "Refunded", variant: "secondary" as const };
  if (item.returnState === "dropped_off" || item.returnState === "refund_pending") {
    return { label: "Refund pending", variant: "outline" as const };
  }
  if (item.returnState === "requested") return { label: "Drop off due", variant: "destructive" as const };
  if (item.decision === "return_planned") return { label: "Return planned", variant: "outline" as const };
  if (item.lifecycleStatus === "delivered") return { label: "Needs decision", variant: "secondary" as const };
  return { label: item.lifecycleStatus.replaceAll("_", " "), variant: "outline" as const };
}

function activeDeadline(item: DashboardItem) {
  if (item.returnState === "requested" && item.dropoffDeadline) {
    return { value: item.dropoffDeadline, label: "Drop off by", source: "confirmed" };
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

function Deadline({ item }: { item: DashboardItem }) {
  const deadline = activeDeadline(item);
  if (!deadline) return <span className="text-sm text-muted-foreground">Deadline not available</span>;
  const today = new Date();
  const days = differenceInCalendarDays(parseISO(deadline.value), today);
  const urgent = days <= 3;
  const elapsed = Math.max(0, Math.min(30, 30 - days));

  return (
    <div className="min-w-44 space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">{deadline.label}</span>
        <span className={`font-mono font-medium ${urgent ? "text-destructive" : ""}`}>
          {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "Today" : `${days}d left`}
        </span>
      </div>
      <Progress value={(elapsed / 30) * 100} className="h-1.5" />
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{shortDate(deadline.value)}</span>
        <span className="capitalize">{deadline.source}</span>
      </div>
    </div>
  );
}

function ItemRow({ item }: { item: DashboardItem }) {
  const itemStatus = status(item);
  return (
    <div className="grid gap-5 border-t px-5 py-5 first:border-t-0 lg:grid-cols-[minmax(0,1fr)_180px_auto] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={itemStatus.variant} className="capitalize">
            {itemStatus.label}
          </Badge>
          {item.quantity > 1 ? <Badge variant="outline">Qty {item.quantity}</Badge> : null}
          {item.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="font-normal text-muted-foreground">
              {tag}
            </Badge>
          ))}
        </div>
        <h3 className="mt-3 line-clamp-2 font-medium leading-6">{item.title}</h3>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span>{currency(item.priceCents)}</span>
          {item.deliveredAt ? <span>Delivered {shortDate(item.deliveredAt)}</span> : null}
          {item.expectedRefundCents ? <span>{currency(item.expectedRefundCents)} expected refund</span> : null}
        </div>
        {item.notes ? <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{item.notes}</p> : null}
      </div>
      <Deadline item={item} />
      <ItemActions item={item} />
    </div>
  );
}

function OrderCard({ order, visibleItems }: { order: DashboardOrder; visibleItems: DashboardItem[] }) {
  return (
    <Card className="overflow-hidden border border-white/10 bg-card/88 p-0 shadow-[0_14px_40px_rgba(0,0,0,0.28)]">
      <CardHeader className="border-b border-white/10 bg-white/3 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Box className="h-4 w-4 text-muted-foreground" />
              <Link href={`/orders/${order.id}`} className="font-mono text-sm font-medium hover:underline">
                {order.orderNumber}
              </Link>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {[order.recipient, order.destination, order.orderedAt ? `Ordered ${shortDate(order.orderedAt)}` : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <div className="font-mono text-sm font-medium">{currency(order.totalCents)}</div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {visibleItems.map((item) => (
          <ItemRow key={item.id} item={item} />
        ))}
      </CardContent>
    </Card>
  );
}

export function DashboardView({ orders, initialView }: { orders: DashboardOrder[]; initialView?: string }) {
  const validView = dashboardViewNames.includes(initialView as DashboardViewName)
    ? (initialView as DashboardViewName)
    : "attention";
  const [query, setQuery] = useState("");
  const [view, setView] = useState<DashboardViewName>(validView);
  const [recipient, setRecipient] = useState(ALL_FILTER);
  const [destination, setDestination] = useState(ALL_FILTER);

  const recipients = useMemo(
    () =>
      [...new Set(orders.map((order) => order.recipient).filter((value): value is string => Boolean(value)))].sort(),
    [orders],
  );
  const destinations = useMemo(
    () =>
      [...new Set(orders.map((order) => order.destination).filter((value): value is string => Boolean(value)))].sort(),
    [orders],
  );
  const scopedOrders = useMemo(
    () =>
      orders.filter((order) =>
        matchesDeliveryFilters(
          order,
          recipient === ALL_FILTER ? null : recipient,
          destination === ALL_FILTER ? null : destination,
        ),
      ),
    [destination, orders, recipient],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return scopedOrders.flatMap((order) => {
      const visibleItems = order.items.filter(
        (item) =>
          belongsToDashboardView(item, view) &&
          (!needle ||
            item.title.toLowerCase().includes(needle) ||
            order.orderNumber.includes(needle) ||
            item.tags.some((tag) => tag.toLowerCase().includes(needle))),
      );
      return visibleItems.length ? [{ order, visibleItems }] : [];
    });
  }, [query, scopedOrders, view]);

  const counts = Object.fromEntries(
    dashboardViewNames.map((candidate) => [
      candidate,
      scopedOrders
        .flatMap(({ items }) => items)
        .filter((item) => belongsToDashboardView(item, candidate)).length,
    ]),
  ) as Record<DashboardViewName, number>;
  const hasFilters = recipient !== ALL_FILTER || destination !== ALL_FILTER;

  return (
    <Tabs value={view} onValueChange={(value) => setView(value as DashboardViewName)} className="space-y-5">
      <div className="space-y-4 sm:space-y-3">
        <TabsList className="grid h-auto! w-full grid-cols-2 gap-2 border border-white/10 bg-white/4 p-1 sm:grid-cols-3 sm:gap-1 xl:grid-cols-5">
          <TabsTrigger value="attention" className="h-auto! min-h-10 whitespace-normal py-2 leading-tight">
            <CalendarClock className="h-4 w-4" /> Needs attention <span className="font-mono">{counts.attention}</span>
          </TabsTrigger>
          <TabsTrigger value="returns" className="h-auto! min-h-10 whitespace-normal py-2 leading-tight">
            <CircleDollarSign className="h-4 w-4" /> Returns <span className="font-mono">{counts.returns}</span>
          </TabsTrigger>
          <TabsTrigger value="transit" className="h-auto! min-h-10 whitespace-normal py-2 leading-tight">
            <PackageOpen className="h-4 w-4" /> In transit <span className="font-mono">{counts.transit}</span>
          </TabsTrigger>
          <TabsTrigger value="archived" className="h-auto! min-h-10 whitespace-normal py-2 leading-tight">
            <Archive className="h-4 w-4" /> Archived <span className="font-mono">{counts.archived}</span>
          </TabsTrigger>
          <TabsTrigger value="finalized" className="h-auto! min-h-10 whitespace-normal py-2 leading-tight">
            <CheckCircle2 className="h-4 w-4" /> Finalized <span className="font-mono">{counts.finalized}</span>
          </TabsTrigger>
        </TabsList>

        <div className="grid gap-3 sm:grid-cols-2 sm:gap-2 xl:grid-cols-[minmax(240px,1fr)_220px_220px_auto]">
          <div className="relative sm:col-span-2 xl:col-span-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products or order #" className="h-10 pl-9 sm:h-8" />
          </div>

          <Select value={recipient} onValueChange={setRecipient}>
            <SelectTrigger className="h-10! w-full sm:h-8!" aria-label="Filter by recipient">
              <UserRound className="h-4 w-4 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="start">
              <SelectItem value={ALL_FILTER}>All people</SelectItem>
              {recipients.map((name) => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={destination} onValueChange={setDestination}>
            <SelectTrigger className="h-10! w-full sm:h-8!" aria-label="Filter by destination">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="start">
              <SelectItem value={ALL_FILTER}>All destinations</SelectItem>
              {destinations.map((place) => (
                <SelectItem key={place} value={place}>{place}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasFilters ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setRecipient(ALL_FILTER);
                setDestination(ALL_FILTER);
              }}
            >
              <X className="h-4 w-4" /> Clear
            </Button>
          ) : null}
        </div>
      </div>

      {dashboardViewNames.map((candidate) => (
        <TabsContent key={candidate} value={candidate} className="space-y-4">
          {filtered.length ? (
            filtered.map(({ order, visibleItems }) => (
              <OrderCard key={order.id} order={order} visibleItems={visibleItems} />
            ))
          ) : (
            <Card className="border border-dashed border-white/15 bg-card/70">
              <CardContent className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
                <PackageOpen className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="font-medium">Nothing in this view</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {query || hasFilters
                      ? "Try a different search or delivery filter."
                      : "New Amazon email events will appear after the next sync."}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}
