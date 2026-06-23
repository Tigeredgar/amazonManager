"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { resolveParserReview } from "@/app/actions";
import { Button } from "@/components/ui/button";

export function ReviewAction({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await resolveParserReview(id);
          router.refresh();
        })
      }
    >
      <Check className="h-3.5 w-3.5" />
      {pending ? "Resolving…" : "Acknowledge"}
    </Button>
  );
}
