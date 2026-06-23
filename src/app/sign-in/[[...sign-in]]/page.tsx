import { SignIn } from "@clerk/nextjs";
import { PackageCheck } from "lucide-react";
import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isDemoMode } from "@/lib/env";

export default function SignInPage() {
  return (
    <main className="grid min-h-screen place-items-center px-6 py-12">
      <div className="grid w-full max-w-4xl gap-10 lg:grid-cols-[1fr_auto] lg:items-center">
        <section className="space-y-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <PackageCheck className="h-5 w-5" />
          </div>
          <div className="space-y-3">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
              Private household tracker
            </p>
            <h1 className="max-w-xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
              Keep every return window in view.
            </h1>
            <p className="max-w-xl text-lg leading-8 text-muted-foreground">
              Track deliveries, make keep-or-return decisions, and verify every refund without
              handing over your Amazon password.
            </p>
          </div>
        </section>

        {isDemoMode() || !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? (
          <Card className="w-full max-w-sm lg:w-96">
            <CardHeader>
              <CardTitle>Local demo mode</CardTitle>
              <CardDescription>
                Clerk is not configured. Open the dashboard directly to preview anonymized data.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link className="font-medium underline underline-offset-4" href="/">
                Continue to dashboard
              </Link>
            </CardContent>
          </Card>
        ) : (
          <SignIn routing="path" path="/sign-in" />
        )}
      </div>
    </main>
  );
}
