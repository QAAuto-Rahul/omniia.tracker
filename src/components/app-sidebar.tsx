"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, FileText, History, LogOut, PackageOpen, type LucideIcon } from "lucide-react";
import { BrandMark } from "@/components/brand";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { logout } from "@/lib/auth-actions";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: LucideIcon; description: string };

// Tracker modules. Add new features here as they are built.
const NAV: NavItem[] = [
  { href: "/env-pack", label: "EnvPack", icon: PackageOpen, description: "Environment variables per service" },
  { href: "/status", label: "Service Health", icon: Activity, description: "Up / down in every environment" },
  { href: "/documents", label: "Documents", icon: FileText, description: "Spreadsheet and document links" },
  { href: "/audit", label: "Audit Log", icon: History, description: "Who changed what, and when" },
];

function initials(email: string) {
  const name = email.split("@")[0];
  const parts = name.split(/[._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function LogoutButton() {
  return (
    <form action={logout}>
      <Tooltip>
        <TooltipTrigger render={<Button type="submit" variant="ghost" size="icon-sm" aria-label="Sign out" />}>
          <LogOut />
        </TooltipTrigger>
        <TooltipContent>Sign out</TooltipContent>
      </Tooltip>
    </form>
  );
}

export function AppSidebar({ email }: { email: string }) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col border-r bg-background md:flex">
      <div className="flex h-14 items-center gap-2.5 border-b px-4">
        <BrandMark />
        <div className="leading-tight">
          <p className="text-sm font-semibold">Omniia Tracker</p>
          <p className="text-xs text-muted-foreground">SDLC Corp</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">Modules</p>
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition-colors",
                active ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <item.icon className="size-4" />
              <div className="leading-tight">
                <div>{item.label}</div>
                <div className="text-xs font-normal text-muted-foreground">{item.description}</div>
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-2.5 border-t p-3">
        <Avatar className="size-8">
          <AvatarFallback className="text-xs">{initials(email)}</AvatarFallback>
        </Avatar>
        <p className="min-w-0 flex-1 truncate text-sm" title={email}>
          {email}
        </p>
        <LogoutButton />
      </div>
    </aside>
  );
}

export function MobileHeader({ email }: { email: string }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2.5 border-b bg-background px-4 md:hidden">
      <BrandMark />
      <Link href="/env-pack" className="flex-1 text-sm font-semibold">
        Omniia Tracker
      </Link>
      <span className="max-w-[40vw] truncate text-xs text-muted-foreground">{email}</span>
      <LogoutButton />
    </header>
  );
}
