import { CheckCircle2, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { updateMailboxSettings } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { getDb } from "@/db";
import { mailboxConnections } from "@/db/schema";
import { getAllowedUser } from "@/lib/auth";
import { isDemoMode, reminderRecipients } from "@/lib/env";

export const metadata = { title: "Settings" };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ gmail?: string }>;
}) {
  const user = await getAllowedUser();
  if (!user) redirect("/unauthorized");
  const params = await searchParams;
  const demo = isDemoMode();
  const connection = demo
    ? null
    : (
        await getDb()
          .select()
          .from(mailboxConnections)
          .where(eq(mailboxConnections.isActive, true))
          .limit(1)
      )[0];

  return (
    <AppShell user={user}>
      <div className="mx-auto max-w-4xl space-y-7">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Configuration</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Mailbox and reminders</h1>
          <p className="mt-2 text-muted-foreground">
            The Gmail grant is separate from dashboard sign-in and can be revoked at any time.
          </p>
        </div>

        {params.gmail === "connected" ? (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Gmail connected</AlertTitle>
            <AlertDescription>The first 90-day import is ready to run from the dashboard.</AlertDescription>
          </Alert>
        ) : null}
        {params.gmail === "failed" ? (
          <Alert variant="destructive">
            <AlertTitle>Gmail connection failed</AlertTitle>
            <AlertDescription>Try again and approve both read-only mail access and Gmail sending.</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <Badge variant={connection ? "secondary" : "outline"}>{connection ? "Connected" : "Not connected"}</Badge>
              </div>
              <CardTitle className="pt-2">Amazon order mailbox</CardTitle>
              <CardDescription>
                Reads matching Amazon messages and sends reminder digests. It cannot modify or delete mail.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                <p className="font-medium">{connection?.email ?? "No mailbox connected"}</p>
                <p className="mt-1 text-muted-foreground">
                  {connection?.lastSyncAt ? `Last synced ${connection.lastSyncAt.toLocaleString()}` : "No production sync has run."}
                </p>
              </div>
              <Button asChild disabled={demo}>
                <a href={demo ? "#" : "/api/oauth/google/start"}>
                  <KeyRound className="h-4 w-4" />
                  {connection ? "Reconnect Gmail" : "Connect Gmail"}
                </a>
              </Button>
              {demo ? <p className="text-xs text-muted-foreground">Set the production environment variables to enable OAuth.</p> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <ShieldCheck className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="pt-2">Stored data</CardTitle>
              <CardDescription>Minimal retention keeps the mailbox boundary narrow.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>Stored: order fields, Gmail message IDs, body hashes, parse results, and encrypted refresh token.</p>
              <Separator />
              <p>Not stored: complete email bodies, Amazon passwords, cookies, invoices, or full payment details.</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Import and reminder defaults</CardTitle>
            <CardDescription>Recipients receive one grouped digest only when a configured threshold is due.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateMailboxSettings} className="grid gap-5 sm:grid-cols-[180px_1fr_auto] sm:items-end">
              <div className="grid gap-2">
                <Label htmlFor="importDays">Historical import</Label>
                <select
                  id="importDays"
                  name="importDays"
                  defaultValue={connection?.importDays ?? 90}
                  className="h-9 rounded-md border bg-transparent px-3 text-sm"
                >
                  <option value="30">30 days</option>
                  <option value="90">90 days</option>
                  <option value="180">180 days</option>
                  <option value="365">1 year</option>
                  <option value="3650">All practical history</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="recipients">Reminder recipients</Label>
                <Input
                  id="recipients"
                  name="recipients"
                  type="text"
                  defaultValue={(connection?.reminderRecipients.length ? connection.reminderRecipients : reminderRecipients()).join(", ")}
                  placeholder="you@example.com"
                />
              </div>
              <Button type="submit" disabled={!connection || demo}>Save settings</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
