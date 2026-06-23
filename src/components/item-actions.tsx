"use client";

import { Archive, ExternalLink, Pencil, RotateCcw, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { setItemArchived, setItemDecision, updateItemDetails } from "@/app/actions";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { DashboardItem } from "@/lib/dashboard/types";

export function ItemActions({ item }: { item: DashboardItem }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);

  function run(operation: () => Promise<unknown>) {
    startTransition(async () => {
      await operation();
      router.refresh();
    });
  }

  if (item.archivedAt) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => run(() => setItemArchived(item.id, false))}
      >
        <Undo2 className="h-3.5 w-3.5" />
        Unarchive
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {item.decision !== "return_planned" && !item.returnState ? (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => run(() => setItemDecision(item.id, "return_planned"))}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Plan return
        </Button>
      ) : null}

      {item.amazonUrl ? (
        <Button variant="outline" size="sm" asChild>
          <a href={item.amazonUrl} target="_blank" rel="noreferrer">
            <ExternalLink className="h-3.5 w-3.5" />
            Amazon
          </a>
        </Button>
      ) : null}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm">
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit item details</DialogTitle>
            <DialogDescription>
              Override Amazon’s estimated return date or add household notes and tags.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-5"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              run(async () => {
                await updateItemDetails({
                  itemId: item.id,
                  deadline: String(form.get("deadline") ?? ""),
                  notes: String(form.get("notes") ?? ""),
                  tags: String(form.get("tags") ?? ""),
                });
                setEditOpen(false);
              });
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor={`deadline-${item.id}`}>Return deadline override</Label>
              <Input id={`deadline-${item.id}`} name="deadline" type="date" defaultValue={item.deadline ?? ""} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`notes-${item.id}`}>Notes</Label>
              <Textarea id={`notes-${item.id}`} name="notes" defaultValue={item.notes ?? ""} rows={4} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`tags-${item.id}`}>Tags</Label>
              <Input id={`tags-${item.id}`} name="tags" defaultValue={item.tags.join(", ")} placeholder="travel, gift, office" />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={pending}>Save changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant={item.returnState === "refunded" ? "default" : "ghost"} size="sm">
            <Archive className="h-3.5 w-3.5" />
            {item.returnState === "refunded" ? "Finalize" : "Keep & archive"}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this item?</AlertDialogTitle>
            <AlertDialogDescription>
              Archiving hides it from active views and suppresses all future return and refund reminders.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={() =>
                run(() =>
                  item.returnState === "refunded"
                    ? setItemArchived(item.id, true)
                    : setItemDecision(item.id, "keep"),
                )
              }
            >
              Archive item
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
