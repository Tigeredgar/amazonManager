import { AlertTriangle, ScanSearch } from "lucide-react";
import { redirect } from "next/navigation";
import { isNull } from "drizzle-orm";

import { AppShell } from "@/components/app-shell";
import { ReviewAction } from "@/components/review-action";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/db";
import { parserReviews } from "@/db/schema";
import { getAllowedUser } from "@/lib/auth";
import { isDemoMode } from "@/lib/env";

export const metadata = { title: "Parser reviews" };

export default async function ReviewsPage() {
  const user = await getAllowedUser();
  if (!user) redirect("/unauthorized");
  const reviews = isDemoMode()
    ? [
        {
          id: "00000000-0000-4000-8000-000000000001",
          reviewType: "ambiguous_item",
          summary: "Two products had similar abbreviated titles in a return confirmation.",
          candidateItemIds: ["candidate-1", "candidate-2"],
          createdAt: new Date(),
        },
      ]
    : await getDb().select().from(parserReviews).where(isNull(parserReviews.resolvedAt));

  return (
    <AppShell user={user}>
      <div className="mx-auto max-w-4xl space-y-7">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Data quality</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Parser reviews</h1>
          <p className="mt-2 text-muted-foreground">The importer asks instead of guessing when item identity is ambiguous.</p>
        </div>

        {reviews.length ? (
          <div className="space-y-3">
            {reviews.map((review) => (
              <Card key={review.id}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <AlertTriangle className="h-4 w-4" />
                      </span>
                      <div>
                        <CardTitle className="text-base">{review.summary}</CardTitle>
                        <p className="mt-1 text-xs text-muted-foreground">Detected {review.createdAt.toLocaleString()}</p>
                      </div>
                    </div>
                    <Badge variant="outline">{review.reviewType.replaceAll("_", " ")}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-4">
                  <p className="text-sm text-muted-foreground">
                    {review.candidateItemIds.length ? `${review.candidateItemIds.length} possible item matches` : "Manual inspection required"}
                  </p>
                  <ReviewAction id={review.id} />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex min-h-56 flex-col items-center justify-center text-center">
              <ScanSearch className="h-8 w-8 text-muted-foreground" />
              <p className="mt-4 font-medium">No unresolved parser reviews</p>
              <p className="mt-1 text-sm text-muted-foreground">Every imported email has a confident match.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
