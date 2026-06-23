import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

export function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
}) {
  return (
    <Card className="border border-white/10 bg-card/88 shadow-[0_10px_30px_rgba(0,0,0,0.24)]">
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 font-mono text-2xl font-semibold tracking-tight">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/14 text-primary ring-1 ring-primary/20">
          <Icon className="h-4 w-4" />
        </span>
      </CardContent>
    </Card>
  );
}
