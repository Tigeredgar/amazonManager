import { ArrowLeft, CheckCircle2, Clock3, Mail, Package, RotateCcw } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { ItemActions } from "@/components/item-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getDb } from "@/db";
import { emailEvents } from "@/db/schema";
import { getAllowedUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard/query";
import { isDemoMode } from "@/lib/env";

function eventIcon(type: string) {
  if (type === "delivered" || type === "refund_issued") return CheckCircle2;
  if (type.includes("return") || type.includes("dropoff")) return RotateCcw;
  if (type === "ordered" || type === "shipped") return Package;
  return Mail;
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getAllowedUser();
  if (!user) redirect("/unauthorized");
  const { id } = await params;
  const dashboard = await getDashboardData();
  const order = dashboard.orders.find((candidate) => candidate.id === id);
  if (!order) notFound();
  const allArchived = order.items.every((item) => item.archivedAt);
  const allFinalized = order.items.every(
    (item) => item.archivedAt && item.returnState === "refunded",
  );

  const timeline = isDemoMode()
    ? [
        { id: "event-1", eventType: "ordered", subject: "Ordered: household item", receivedAt: new Date(order.orderedAt ?? "2026-01-01T12:00:00Z") },
        { id: "event-2", eventType: "delivered", subject: "Delivered: household item", receivedAt: new Date(order.orderedAt ?? "2026-01-01T12:00:00Z") },
      ]
    : (await getDb().select().from(emailEvents))
        .filter((event) => event.parsedPayload.orderNumber === order.orderNumber)
        .sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());

  return (
    <AppShell user={user}>
      <div className="mx-auto max-w-5xl space-y-7">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-3 mb-4">
            <Link href="/">
              <ArrowLeft className="h-4 w-4" /> Back to dashboard
            </Link>
          </Button>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Amazon order</p>
              <h1 className="mt-2 font-mono text-2xl font-semibold tracking-tight sm:text-3xl">{order.orderNumber}</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {[order.recipient, order.destination].filter(Boolean).join(" · ")}
              </p>
            </div>
            <Badge variant={allArchived ? "secondary" : "outline"}>
              {allFinalized
                ? "Finalized"
                : allArchived
                  ? "Archived"
                  : `${order.items.length} item${order.items.length === 1 ? "" : "s"}`}
            </Badge>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            {order.items.map((item) => (
              <Card key={item.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="capitalize">{item.returnState ?? item.lifecycleStatus}</Badge>
                    {item.tags.map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>)}
                  </div>
                  <CardTitle className="pt-2 text-lg leading-7">{item.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                    <p>Decision: <span className="text-foreground">{item.decision.replaceAll("_", " ")}</span></p>
                    <p>Return deadline: <span className="font-mono text-foreground">{item.deadline ?? "—"}</span></p>
                    <p>Drop-off deadline: <span className="font-mono text-foreground">{item.dropoffDeadline ?? "—"}</span></p>
                    <p>Refund promised: <span className="font-mono text-foreground">{item.promisedRefundDate ?? "—"}</span></p>
                  </div>
                  {item.notes ? <><Separator /><p className="text-sm leading-6 text-muted-foreground">{item.notes}</p></> : null}
                  <Separator />
                  <ItemActions item={item} />
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock3 className="h-4 w-4 text-muted-foreground" /> Event timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              {timeline.length ? (
                <ol className="space-y-0">
                  {timeline.map((event, index) => {
                    const Icon = eventIcon(event.eventType);
                    return (
                      <li key={event.id} className="relative flex gap-3 pb-6 last:pb-0">
                        {index < timeline.length - 1 ? <span className="absolute left-4 top-8 h-[calc(100%-1rem)] w-px bg-border" /> : null}
                        <span className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-background">
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 pt-1">
                          <p className="text-sm font-medium capitalize">{event.eventType.replaceAll("_", " ")}</p>
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{event.subject}</p>
                          <p className="mt-1 font-mono text-[11px] text-muted-foreground">{event.receivedAt.toLocaleString()}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              ) : <p className="text-sm text-muted-foreground">No source events found.</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
