import Link from "next/link";

const NAV = [
  { href: "/", label: "home" },
  { href: "/terminal", label: "terminal" },
  { href: "/skills", label: "skills" },
  { href: "/about", label: "about" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="group flex items-center gap-2 text-sm font-medium tracking-tight"
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
        <nav className="flex items-center gap-1 text-xs sm:gap-2 sm:text-sm">
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
            href="https://x.com/aeon_terminal"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Aeon Terminal on X"
            className="ml-1 hidden rounded border border-border p-1.5 text-muted transition-colors hover:border-accent hover:text-accent sm:inline-flex"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden
              className="h-3.5 w-3.5 fill-current"
            >
              <path d="M18.244 2H21l-6.51 7.44L22 22h-6.78l-4.74-6.18L4.94 22H2.18l6.96-7.96L2 2h6.93l4.3 5.74L18.244 2Zm-1.19 18h1.59L7.04 4H5.35l11.7 16Z" />
            </svg>
          </a>
          <a
            href="https://github.com/aeonterminal/aeon-terminal"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden rounded border border-border px-2 py-1 text-muted transition-colors hover:border-accent hover:text-accent sm:inline-block"
          >
            ↗ github
          </a>
        </nav>
      </div>
    </header>
  );
}
