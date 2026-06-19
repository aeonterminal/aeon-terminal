import Link from "next/link";

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
          <span className="inline-flex items-center gap-1.5 rounded border border-accent/40 bg-accent/10 px-2 py-0.5 text-accent">
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent shadow-[0_0_8px_var(--accent)]"
            />
            launch coming soon
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-2">
          <Link href="/token" className="hover:text-foreground">
            roadmap →
          </Link>
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
          <Link href="/token" className="hover:text-foreground">
            token
          </Link>
          <Link href="/about" className="hover:text-foreground">
            about
          </Link>
          <Link href="/status" className="hover:text-foreground">
            status
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
        <div className="flex flex-col items-start gap-2 md:items-end">
          <a
            href="https://orynth.dev/projects/aeon-terminal"
            target="_blank"
            rel="noopener noreferrer"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://orynth.dev/api/badge/aeon-terminal?theme=light&style=default"
              alt="Featured on Orynth"
              width={130}
              height={40}
              className="opacity-70 transition-opacity hover:opacity-100"
            />
          </a>
          <p className="text-[10px] uppercase tracking-widest text-muted-2">
            mit · v0.1.0
          </p>
        </div>
      </div>
    </footer>
  );
}
