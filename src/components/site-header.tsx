import Link from "next/link";

import { MobileNav } from "./mobile-nav";
import { UserBadge } from "./user-badge";

export const NAV = [
  { href: "/", label: "home" },
  { href: "/terminal", label: "terminal" },
  { href: "/skills", label: "skills" },
  { href: "/token", label: "token" },
  { href: "/about", label: "about" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-12 max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-2 text-sm font-medium tracking-tight"
          aria-label="Aeon Terminal home"
        >
          <span
            aria-hidden
            className="inline-block h-2 w-2 rounded-full bg-accent shadow-[0_0_8px_var(--accent)] transition-shadow group-hover:shadow-[0_0_16px_var(--accent)]"
          />
          <span className="text-foreground">
            aeon<span className="text-muted">·</span>
            <span className="text-accent glow-accent">terminal</span>
          </span>
        </Link>

        {/* desktop nav (sm and up) */}
        <nav className="hidden items-center gap-2 text-sm sm:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded px-2 py-1 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              {n.label}
            </Link>
          ))}
          <a
            href="https://github.com/aeonterminal/aeon-terminal"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded border border-border px-2 py-1 text-muted transition-colors hover:border-accent hover:text-accent"
          >
            ↗ github
          </a>
          <span className="ml-1 inline-flex">
            <UserBadge />
          </span>
        </nav>

        {/* mobile (below sm): user badge + hamburger */}
        <div className="flex items-center gap-2 sm:hidden">
          <UserBadge />
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
