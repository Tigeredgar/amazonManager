import { ShieldX } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function UnauthorizedPage() {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <Card className="max-w-md">
        <CardHeader>
          <ShieldX className="mb-3 h-8 w-8 text-destructive" />
          <CardTitle>This account is not allowlisted</CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-6 text-muted-foreground">
          Sign in with one of the two Google accounts listed in the server-only
          <code className="mx-1 font-mono text-foreground">ALLOWED_EMAILS</code> setting.
        </CardContent>
      </Card>
    </main>
  );
}
