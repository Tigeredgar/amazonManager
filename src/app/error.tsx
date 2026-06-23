"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function ErrorPage({ error, reset }: { error: Error & { code?: string; digest?: string }; reset: () => void }) {
  const clerkLoadFailed =
    error.code === "failed_to_load_clerk_js" || error.message.includes("Failed to load Clerk JS");

  useEffect(() => {
    console.error("[route-error]", error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center p-6">
      <Card className="max-w-md">
        <CardContent className="flex flex-col items-center px-8 py-10 text-center">
          <AlertTriangle className="h-9 w-9 text-destructive" />
          <h1 className="mt-5 text-xl font-semibold">
            {clerkLoadFailed ? "Authentication could not load" : "The tracker could not load"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {clerkLoadFailed
              ? "The authentication service could not be reached. Check your connection and reload the page."
              : "A temporary application error occurred. Try the request again."}
          </p>
          <Button
            className="mt-6"
            onClick={() => (clerkLoadFailed ? window.location.reload() : reset())}
          >
            {clerkLoadFailed ? "Reload page" : "Try again"}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
