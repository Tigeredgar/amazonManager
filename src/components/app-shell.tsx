import { UserButton } from "@clerk/nextjs";
import { Archive, Inbox, PackageCheck, Settings, TriangleAlert } from "lucide-react";
import Link from "next/link";

import type { AppUser } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { MobileNav } from "./mobile-nav";

const navigation = [
  { href: "/", label: "Dashboard", icon: Inbox },
  { href: "/?view=archived", label: "Archive", icon: Archive },
  { href: "/reviews", label: "Reviews", icon: TriangleAlert },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ user, children }: { user: AppUser; children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b bg-background/88 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-5 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3 font-semibold tracking-tight">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <PackageCheck className="h-4.5 w-4.5" />
            </span>
            <span>Return Window</span>
          </Link>

          <nav className="ml-5 hidden items-center gap-1 md:flex">
            {navigation.map(({ href, label, icon: Icon }) => (
              <Link
                key={label}
                href={href}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {user.demo ? (
              <Badge variant="secondary" className="font-mono text-[10px] uppercase tracking-wider">
                Demo data
              </Badge>
            ) : (
              <UserButton />
            )}
            <MobileNav />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
