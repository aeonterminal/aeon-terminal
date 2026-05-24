import Link from "next/link";

import { CopyAddressButton } from "./copy-address-button";
import { TOKEN } from "@/lib/token";

export function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-border bg-background/80">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 border-b border-border px-4 py-3 text-[11px] sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-muted-2" aria-hidden>
            $
          </span>
          <span className="text-muted">contract</span>
          <span className="text-muted-2" aria-hidden>
            ·
          </span>
          <span className="text-muted">{TOKEN.chain}</span>
          <span className="text-muted-2" aria-hidden>
            ·
          </span>
          <code className="truncate font-medium text-accent">
            {TOKEN.address}
          </code>
          <CopyAddressButton className="text-muted-2" />
        </div>
        <div className="flex flex-shrink-0 items-center gap-3">
          <a
            href={TOKEN.buyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-2 hover:text-foreground"
          >
            buy on virtuals ↗
          </a>
          <a
            href={TOKEN.dexscreenerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted hover:text-foreground"
          >
            dexscreener ↗
          </a>
          <a
            href={TOKEN.scanUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted hover:text-foreground"
          >
            basescan ↗
          </a>
        </div>
      </div>
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <p className="text-sm text-foreground">
            aeon<span className="text-muted">·</span>
            <span className="text-accent">terminal</span>
          </p>
          <p className="text-xs text-muted">
            autonomous agents. from the terminal.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted">
          <Link href="/" className="hover:text-foreground">
            home
          </Link>
          <Link href="/terminal" className="hover:text-foreground">
            terminal
          </Link>
          <Link href="/skills" className="hover:text-foreground">
            skills
          </Link>
          <Link href="/about" className="hover:text-foreground">
            about
          </Link>
          <a
            href="https://x.com/aeon_terminal"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground"
          >
            @aeon_terminal ↗
          </a>
          <a
            href="https://github.com/aeonterminal/aeon-terminal"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground"
          >
            github ↗
          </a>
          <a
            href="https://github.com/aaronjmars/aeon"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-accent"
          >
            inspired by aeon ↗
          </a>
        </nav>
        <p className="text-[10px] uppercase tracking-widest text-muted-2">
          mit · v0.1.0
        </p>
      </div>
    </footer>
  );
}
