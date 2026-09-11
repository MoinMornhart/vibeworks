"use client";

import { CalendarRange } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BookOpen, Inbox, Languages, LayoutDashboard, ListChecks, LogOut, ChevronDown, MessageSquare, Palette, Wallet, Search, Shield, Sun, UserRound, Zap, type LucideIcon } from "lucide-react";
import { OPEN_PALETTE_EVENT } from "@/components/CommandPalette";
import { OPEN_CAPTURE_EVENT } from "@/components/QuickCapture";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { Logo } from "@/components/Logo";
import { TimerPill } from "@/components/time/TimerPill";
import { api } from "@/lib/client/api";
import { useT } from "@/lib/i18n/client";
import type { Key } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

export interface NavUser {
  name: string;
  username: string;
  isAdmin: boolean;
}

interface NavItem {
  href: string;
  label: Key<"shell">;
  icon: LucideIcon;
  admin?: boolean;
}

const NAV: NavItem[] = [
  { href: "/", label: "nav.dashboard", icon: LayoutDashboard },
  { href: "/today", label: "nav.today", icon: Sun },
  { href: "/tasks", label: "nav.tasks", icon: ListChecks },
  { href: "/prompts", label: "nav.prompts", icon: MessageSquare },
  { href: "/review", label: "nav.review", icon: CalendarRange },
  { href: "/docs", label: "nav.docs", icon: BookOpen },
  // Design und Admin stehen im Profilmenü – die Leiste bleibt so auch mit laufendem Timer vollständig
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" || pathname.startsWith("/projects") : pathname.startsWith(href);
}

export function TopNav({ appName, user }: { appName: string; user: NavUser }) {
  const t = useT("shell");
  const tc = useT("common");
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
      <nav className="glass mx-auto flex max-w-7xl items-center gap-2 px-3 py-2 sm:gap-4 sm:px-4" aria-label={t("nav.main")}>
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
                title={t(item.label)}
              >
                <item.icon size={16} />
                {/* Beschriftung erst ab 1280 px – darunter Symbole mit Tooltip, sonst läuft die Leiste über */}
                <span className="hidden xl:inline">{t(item.label)}</span>
              </Link>
            </li>
          ))}
        </ul>
        <TimerPill />
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))}
          aria-label={t("topNav.openSearch")}
          title={t("topNav.searchTitle")}
        >
          <Search size={16} />
          <kbd className="hidden rounded border px-1.5 text-[10px] text-muted lg:inline">{t("topNav.searchKbd")}</kbd>
        </button>
        <button
          className="btn btn-ghost btn-icon btn-sm"
          onClick={() => window.dispatchEvent(new Event(OPEN_CAPTURE_EVENT))}
          aria-label={t("topNav.capture")}
          title={t("topNav.capture")}
        >
          <Zap size={16} />
        </button>
        <div className="relative" ref={menuRef}>
          <button className="btn btn-ghost btn-sm" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-haspopup="menu">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-bold text-on-accent">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="hidden max-w-32 truncate sm:inline">{user.name}</span>
            <ChevronDown size={14} />
          </button>
          {menu && (
            <div role="menu" className="glass-strong fade-in absolute right-0 mt-2 w-60 p-1.5">
              <p className="px-3 py-2 text-xs text-muted">{t("topNav.signedInAs")} <strong className="text-fg">{user.username}</strong></p>
              <Link role="menuitem" href="/account" className="btn btn-ghost btn-sm w-full justify-start" onClick={() => setMenu(false)}>
                <UserRound size={15} /> {t("nav.account")}
              </Link>
              <Link role="menuitem" href="/inbox" className="btn btn-ghost btn-sm w-full justify-start" onClick={() => setMenu(false)}>
                <Inbox size={15} /> {t("nav.inbox")}
              </Link>
              <Link role="menuitem" href="/costs" className="btn btn-ghost btn-sm w-full justify-start" onClick={() => setMenu(false)}>
                <Wallet size={15} /> {t("nav.costs")}
              </Link>
              <Link role="menuitem" href="/design" className="btn btn-ghost btn-sm w-full justify-start" onClick={() => setMenu(false)}>
                <Palette size={15} /> {t("nav.design")}
              </Link>
              {user.isAdmin && (
                <Link role="menuitem" href="/admin" className="btn btn-ghost btn-sm w-full justify-start" onClick={() => setMenu(false)}>
                  <Shield size={15} /> {t("nav.admin")}
                </Link>
              )}
              {/* Sprachwahl überall erreichbar */}
              <div className="flex flex-col gap-1.5 px-3 py-2">
                <span className="flex items-center gap-2 text-xs text-muted"><Languages size={14} /> {tc("language.label")}</span>
                <LanguageSwitch className="w-full [&>button]:flex-1 text-xs" />
              </div>
              <div className="my-1 h-px bg-fg/10" />
              <button role="menuitem" className="btn btn-ghost btn-sm w-full justify-start" onClick={logout}>
                <LogOut size={15} /> {t("topNav.logout")}
              </button>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
