import { AlertTriangle, CalendarClock, CircleDollarSign, ScanSearch } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { DashboardView } from "@/components/dashboard-view";
import { MetricCard } from "@/components/metric-card";
import { SyncButton } from "@/components/sync-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { getAllowedUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard/query";

function currency(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const user = await getAllowedUser();
  if (!user) redirect("/unauthorized");
  const [data, params] = await Promise.all([getDashboardData(), searchParams]);
  const lastSync = data.mailbox.lastSyncAt
    ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(data.mailbox.lastSyncAt),
      )
    : "Never";

  return (
    <AppShell user={user}>
      <div className="space-y-7">
        <section className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-[0.18em]">
                America / Chicago
              </Badge>
              <span className="text-xs text-muted-foreground">Last sync: {lastSync}</span>
            </div>
            <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              Decide before the window closes.
            </h1>
            <p className="max-w-2xl text-muted-foreground">
              Delivered items, active returns, and pending refunds—organized around the next action.
            </p>
          </div>
          <SyncButton disabled={!data.mailbox.connected && !user.demo} />
        </section>

        {!data.mailbox.connected && !user.demo ? (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Connect the Amazon order mailbox</AlertTitle>
            <AlertDescription>
              Gmail is not connected yet. <Link href="/settings" className="font-medium underline">Finish setup</Link> to import the first 90 days.
            </AlertDescription>
          </Alert>
        ) : null}
        {data.mailbox.error ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>The last Gmail sync failed</AlertTitle>
            <AlertDescription>{data.mailbox.error}</AlertDescription>
          </Alert>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Due within 7 days" value={String(data.metrics.dueSoon)} detail="Eligibility and drop-off deadlines" icon={CalendarClock} />
          <MetricCard label="Money at risk" value={currency(data.metrics.moneyAtRiskCents)} detail="Delivered items not finalized" icon={CircleDollarSign} />
          <MetricCard label="Pending refunds" value={currency(data.metrics.pendingRefundCents)} detail="Expected from active returns" icon={CircleDollarSign} />
          <MetricCard label="Parser reviews" value={String(data.metrics.needsReview)} detail="Ambiguous emails need a decision" icon={ScanSearch} />
        </section>

        <DashboardView orders={data.orders} initialView={params.view} />
      </div>
    </AppShell>
  );
}
