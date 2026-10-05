"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  ReceiptText,
  Settings,
  Sun,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/proforma", label: "Proforma", icon: ReceiptText },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

const SIDEBAR_STORAGE_KEY = "logiflow-sidebar-collapsed";

/** Persisted collapsed state (default expanded), hydration-safe. */
function useSidebarCollapsed() {
  const stored = useSyncExternalStore(
    (notify) => {
      window.addEventListener("storage", notify);
      return () => window.removeEventListener("storage", notify);
    },
    () => window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1",
    () => false,
  );
  const [override, setOverride] = useState<boolean | null>(null);
  const collapsed = override ?? stored;

  function toggle() {
    const next = !collapsed;
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "1" : "0");
    } catch {
      // Private mode etc. — collapsing still works for the session.
    }
    setOverride(next);
  }

  return { collapsed, toggle };
}

/** Pill-shaped nav item, matching the reference's rounded-full menus. */
function NavLinks({
  onNavigate,
  collapsed = false,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const pathname = usePathname();

  return (
    <nav
      className={cn("flex flex-col gap-1.5", collapsed ? "px-2" : "px-4")}
      aria-label="Primary"
    >
      {NAV.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            aria-label={collapsed ? item.label : undefined}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-full py-3 text-[0.9375rem] font-medium transition-all duration-200",
              collapsed ? "justify-center px-0" : "px-4",
              active
                ? "bg-lightprimary text-primary"
                : "text-link hover:translate-x-1 hover:bg-lightprimary hover:text-primary",
              collapsed && "hover:translate-x-0",
            )}
          >
            <item.icon className="size-[1.125rem] shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

function UserMenu() {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  // next-themes resolves the theme client-side; subscribe without setState so
  // the server render and first paint never disagree (hydration mismatch).
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [isPending, startTransition] = useTransition();

  const isDark = mounted && resolvedTheme === "dark";

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success("Signed out");
    startTransition(() => {
      router.push("/login");
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="size-10 cursor-pointer rounded-full border border-dashed border-transparent bg-lightprimary transition-all hover:border-primary"
          disabled={isPending}
          aria-label="Account menu"
        >
          <span className="text-[0.75rem] font-bold text-primary">LF</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Account
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => setTheme(isDark ? "light" : "dark")}
        >
          {isDark ? <Sun /> : <Moon />}
          {isDark ? "Light mode" : "Dark mode"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleSignOut} variant="destructive">
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Brand({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <Link
      href="/dashboard"
      className={cn("flex items-center gap-3", collapsed && "justify-center")}
      aria-label="LogiFlow dashboard"
    >
      <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-[0_8px_20px_-8px_rgb(93_135_255/0.8)]">
        <Package className="size-5" />
      </div>
      {!collapsed && (
        <div className="leading-none">
          <p className="text-lg font-bold tracking-[-0.02em] text-heading">
            LogiFlow
          </p>
          <p className="mt-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Export docs
          </p>
        </div>
      )}
    </Link>
  );
}

function SidebarBody({
  collapsed = false,
  onToggleCollapse,
  onNavigate,
}: {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div
        className={cn(
          "flex h-[4.5rem] shrink-0 items-center",
          collapsed ? "justify-center px-2" : "px-6",
        )}
      >
        <Brand collapsed={collapsed} />
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        {!collapsed && (
          <p className="px-8 pb-3 text-[0.75rem] font-semibold text-muted-foreground">
            Menu
          </p>
        )}
        <NavLinks onNavigate={onNavigate} collapsed={collapsed} />
      </div>

      {onToggleCollapse && (
        <div className="border-t border-border/70 p-4">
          <Button
            type="button"
            variant="ghost"
            size={collapsed ? "icon" : "sm"}
            onClick={onToggleCollapse}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(!collapsed && "w-full gap-2")}
          >
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            {!collapsed && <span>Collapse</span>}
          </Button>
        </div>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { collapsed, toggle } = useSidebarCollapsed();

  return (
    <div className="flex min-h-screen w-full">
      <aside
        className={cn(
          "hidden shrink-0 border-r border-border/70 bg-sidebar transition-[width] duration-200 lg:block",
          collapsed ? "w-[4.75rem]" : "w-[17rem]",
        )}
      >
        <div
          className={cn(
            "fixed inset-y-0 transition-[width] duration-200",
            collapsed ? "w-[4.75rem]" : "w-[17rem]",
          )}
        >
          <SidebarBody collapsed={collapsed} onToggleCollapse={toggle} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-[4.5rem] shrink-0 items-center gap-3 border-b border-border/70 bg-sidebar/85 px-5 backdrop-blur-md lg:px-8">
          <Button
            variant="ghost"
            size="icon"
            className="-ml-2 lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="-ml-2 hidden lg:inline-flex"
            onClick={toggle}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-5" />
            ) : (
              <PanelLeftClose className="size-5" />
            )}
          </Button>
          <div className="lg:hidden">
            <Brand />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <UserMenu />
          </div>
        </header>

        <main className="flex-1">
          <div className="container mx-auto w-full max-w-[1400px] px-5 py-7 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 border-0 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <SidebarBody onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
