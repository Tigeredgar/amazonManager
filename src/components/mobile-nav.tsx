"use client";

import { Archive, CheckCircle2, Inbox, Menu, Settings, TriangleAlert } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const navigation = [
  { href: "/", label: "Dashboard", icon: Inbox },
  { href: "/?view=archived", label: "Archive", icon: Archive },
  { href: "/?view=finalized", label: "Finalized", icon: CheckCircle2 },
  { href: "/reviews", label: "Reviews", icon: TriangleAlert },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function MobileNav() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Return Window</SheetTitle>
        </SheetHeader>
        <nav className="mt-8 grid gap-2">
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link
              key={label}
              href={href}
              className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors hover:bg-primary/12 hover:text-primary"
            >
              <Icon className="h-4 w-4 text-muted-foreground" />
              {label}
            </Link>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
