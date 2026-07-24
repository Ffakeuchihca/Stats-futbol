"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard,
  CalendarCheck,
  CalendarRange,
  Wallet,
  Trophy,
  Users,
  LogOut,
  ShieldCheck,
  Repeat,
  MoreHorizontal,
} from "lucide-react";
import type { UserRole } from "@/types/database";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Inicio", icon: LayoutDashboard },
  { href: "/asistencia", label: "Asistencia", icon: CalendarCheck },
  { href: "/calendario", label: "Calendario", icon: CalendarRange },
  { href: "/partidos", label: "Partidos", icon: Trophy },
  { href: "/multas", label: "Multas", icon: Wallet },
  { href: "/plantel", label: "Plantel", icon: Users },
];

// El nav inferior (mobile) no debe pasar de 5 slots — el resto queda en "Más".
const MOBILE_PRIMARY_HREFS = ["/dashboard", "/asistencia", "/partidos", "/plantel"];

const ROLE_LABEL: Record<UserRole, string> = {
  player: "Jugador",
  coach: "Cuerpo técnico",
  admin: "Administrador",
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function AppShell({
  fullName,
  role,
  activeCategoryName,
  children,
}: {
  fullName: string;
  role: UserRole;
  activeCategoryName?: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const mobilePrimaryItems = NAV_ITEMS.filter((item) => MOBILE_PRIMARY_HREFS.includes(item.href));
  const mobileOverflowItems = NAV_ITEMS.filter(
    (item) => !MOBILE_PRIMARY_HREFS.includes(item.href)
  );
  const overflowActive = mobileOverflowItems.some((item) => pathname.startsWith(item.href));

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const userMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Menú de usuario"
        className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Avatar className="size-9">
          <AvatarFallback className="bg-primary text-primary-foreground text-sm">
            {initials(fullName)}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="font-medium">{fullName}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {ROLE_LABEL[role]}
              </span>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        {activeCategoryName && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/categoria" />}>
              <Repeat className="size-4" />
              Cambiar categoría ({activeCategoryName})
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={handleSignOut}>
          <LogOut className="size-4" />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      {/* Sidebar - escritorio: panel de dugout, siempre oscuro */}
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
            <ShieldCheck className="size-5" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-display text-xl tracking-wider">STATS</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-sidebar-foreground/60">
              Cartaginés
            </span>
          </div>
        </div>
        {activeCategoryName && (
          <Link
            href="/categoria"
            className="mx-3 mb-2 flex items-center justify-between gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-3 py-2 text-xs text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent/70"
          >
            <span className="font-mono uppercase tracking-wide">
              Categoría: <span className="font-medium text-sidebar-foreground">{activeCategoryName}</span>
            </span>
            <Repeat className="size-3.5 shrink-0" />
          </Link>
        )}
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {NAV_ITEMS.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg border-l-2 px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "border-sidebar-primary bg-sidebar-accent text-sidebar-accent-foreground"
                    : "border-transparent text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className="size-4.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center justify-between gap-2 border-t border-sidebar-border px-4 py-4">
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium">{fullName}</span>
            <Badge variant="secondary" className="mt-1 w-fit text-[10px]">
              {ROLE_LABEL[role]}
            </Badge>
          </div>
          {userMenu}
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        {/* Header - mobile */}
        <header className="flex items-center justify-between border-b bg-pitch px-4 py-3 text-pitch-foreground md:hidden">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ShieldCheck className="size-4" />
            </div>
            <span className="font-display text-lg tracking-wider">STATS CARTAGINÉS</span>
            {activeCategoryName && (
              <Badge variant="secondary" className="font-mono text-[10px]">
                {activeCategoryName}
              </Badge>
            )}
          </div>
          {userMenu}
        </header>

        <main className="flex-1 overflow-y-auto p-4 pb-24 md:p-8 md:pb-8">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>

        {/* Bottom nav - mobile: máximo 5 slots, el resto va en "Más" */}
        <nav className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t bg-background/95 backdrop-blur md:hidden">
          {mobilePrimaryItems.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className="size-4.5" />
                {item.label}
              </Link>
            );
          })}
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Más opciones"
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium outline-none",
                overflowActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <MoreHorizontal className="size-4.5" />
              Más
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {mobileOverflowItems.map((item) => {
                const Icon = item.icon;
                return (
                  <DropdownMenuItem key={item.href} render={<Link href={item.href} />}>
                    <Icon className="size-4" />
                    {item.label}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>
      </div>
    </div>
  );
}
