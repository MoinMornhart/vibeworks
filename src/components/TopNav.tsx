"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LayoutDashboard, ListChecks, LogOut, ChevronDown, Palette, UserRound, type LucideIcon } from "lucide-react";
import { Logo } from "@/components/Logo";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/utils";

export interface NavUser {
  name: string;
  username: string;
  isAdmin: boolean;
}

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  admin?: boolean;
}

const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tasks", label: "Aufgaben", icon: ListChecks },
  { href: "/design", label: "Design", icon: Palette },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" || pathname.startsWith("/projects") : pathname.startsWith(href);
}

export function TopNav({ appName, user }: { appName: string; user: NavUser }) {
  const pathname = usePathname();
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [menu]);

  async function logout() {
    await api("/api/auth/logout", { body: {} }).catch(() => {});
    window.location.assign("/login");
  }

  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-5">
      <nav className="glass mx-auto flex max-w-7xl items-center gap-2 px-3 py-2 sm:gap-4 sm:px-4" aria-label="Hauptnavigation">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold tracking-tight">
          <Logo size={30} />
          <span className="hidden text-lg sm:inline">{appName}</span>
        </Link>
        <ul className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {NAV.filter((n) => !n.admin || user.isAdmin).map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive(pathname, item.href) ? "page" : undefined}
                className={cn(
                  "btn btn-ghost btn-sm",
                  isActive(pathname, item.href) && "bg-accent/15 text-fg",
                )}
                title={item.label}
              >
                <item.icon size={16} />
                <span className="hidden md:inline">{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="relative" ref={menuRef}>
          <button className="btn btn-ghost btn-sm" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-haspopup="menu">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-bold text-on-accent">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="hidden max-w-32 truncate sm:inline">{user.name}</span>
            <ChevronDown size={14} />
          </button>
          {menu && (
            <div role="menu" className="glass-strong fade-in absolute right-0 mt-2 w-56 p-1.5">
              <p className="px-3 py-2 text-xs text-muted">Angemeldet als <strong className="text-fg">{user.username}</strong></p>
              <Link role="menuitem" href="/account" className="btn btn-ghost btn-sm w-full justify-start" onClick={() => setMenu(false)}>
                <UserRound size={15} /> Mein Konto
              </Link>
              <Link role="menuitem" href="/design" className="btn btn-ghost btn-sm w-full justify-start" onClick={() => setMenu(false)}>
                <Palette size={15} /> Design
              </Link>
              <div className="my-1 h-px bg-fg/10" />
              <button role="menuitem" className="btn btn-ghost btn-sm w-full justify-start" onClick={logout}>
                <LogOut size={15} /> Abmelden
              </button>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
