"use client";

import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <Card className="max-w-md">
        <CardContent className="flex flex-col items-center px-8 py-10 text-center">
          <AlertTriangle className="h-9 w-9 text-destructive" />
          <h1 className="mt-5 text-xl font-semibold">The tracker could not load</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Check the database and authentication configuration, then try again.</p>
          <Button className="mt-6" onClick={reset}>Try again</Button>
        </CardContent>
      </Card>
    </main>
  );
}
