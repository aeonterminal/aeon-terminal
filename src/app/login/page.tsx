import type { Metadata } from "next";
import Link from "next/link";

import { LoginPanel } from "./login-panel";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Sign in to Aeon Terminal — claim a persistent agent with memory, per-user quota, and (soon) scheduled skill runs.",
};

export default function LoginPage() {
  return (
    <main className="relative isolate flex min-h-[calc(100vh-3rem)] items-center justify-center px-4 py-10 sm:px-6 sm:py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 dots opacity-40"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(255,107,26,0.12),transparent_70%)]"
      />

      <div className="relative z-10 w-full max-w-md space-y-4">
        <div className="rounded-lg border border-border bg-surface/95 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.6),0_0_80px_-40px_rgba(255,107,26,0.25)] backdrop-blur supports-[backdrop-filter]:bg-surface/80">
          <header className="space-y-3 border-b border-border px-6 py-5">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-muted">
              <span
                aria-hidden
                className="inline-block h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_var(--accent)]"
              />
              <span>$ aeon login</span>
            </div>
            <h1 className="text-xl tracking-tight text-foreground sm:text-2xl">
              Sign in to{" "}
              <span className="text-accent glow-accent">aeon·terminal</span>
            </h1>
            <p className="text-xs leading-relaxed text-muted">
              Welcome back. Pick a provider — your account, memory, and daily
              quota persist either way.
              <span className="caret align-middle" />
            </p>
          </header>

          <LoginPanel />

          <footer className="flex flex-col gap-2 border-t border-border px-6 py-4 text-[11px] text-muted-2 sm:flex-row sm:items-center sm:justify-between">
            <span>
              new here?{" "}
              <span className="text-muted">
                pick any provider — the account is created on first sign-in.
              </span>
            </span>
            <span className="hidden text-muted-2 sm:inline">
              session · http-only · 30d
            </span>
          </footer>
        </div>

        <p className="px-1 text-center text-[11px] text-muted-2">
          by signing in you agree to be sensible. read the{" "}
          <Link href="/about" className="text-muted hover:text-foreground">
            manifesto
          </Link>{" "}
          and the{" "}
          <Link href="/token" className="text-muted hover:text-foreground">
            token disclaimer
          </Link>
          .
        </p>

        <details className="rounded border border-border bg-surface/60 px-4 py-3 text-[11px] leading-relaxed text-muted open:bg-surface">
          <summary className="cursor-pointer text-[11px] uppercase tracking-[0.25em] text-muted-2 hover:text-foreground">
            $ aeon login --explain
          </summary>
          <ul className="mt-3 space-y-2">
            <li>
              <span className="text-foreground">privacy:</span> we store your
              provider id, public name, email, and avatar url. we never post
              on your behalf without a separate explicit prompt.
            </li>
            <li>
              <span className="text-foreground">sessions:</span> HttpOnly
              cookies scoped to{" "}
              <code className="text-foreground">aeonterminal.org</code>,
              revoked on sign-out, auto-expire after 30 days.
            </li>
            <li>
              <span className="text-foreground">memory:</span> the last 8 asks
              and 5 runs persist per account so Claude has continuity. clear
              with{" "}
              <code className="text-foreground">memory clear</code> in the
              terminal.
            </li>
            <li>
              <span className="text-foreground">quota:</span> 30 asks + 10
              skill runs per UTC day on the free tier. paid tier (200 + 50)
              ships with Stripe in Q2. no surprise bills.
            </li>
          </ul>
        </details>
      </div>
    </main>
  );
}
