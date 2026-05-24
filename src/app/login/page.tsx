import type { Metadata } from "next";

import { LoginPanel } from "./login-panel";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Sign in to Aeon Terminal — claim a persistent agent with memory, scheduled runs, and per-user skill state.",
};

export default function LoginPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-12 sm:px-6 sm:py-16">
      <header className="space-y-3">
        <div className="text-xs uppercase tracking-[0.3em] text-muted">
          $ sign in
        </div>
        <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">
          Claim an{" "}
          <span className="text-accent glow-accent">autonomous agent</span> of
          your own.
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          Signing in gives your terminal a persistent memory, per-user daily
          quota, and (soon) scheduled skill runs. Anonymous users keep the
          public demo with a 30-request daily IP cap.
        </p>
      </header>

      <LoginPanel />

      <section className="space-y-2 rounded border border-border bg-surface/60 p-4 text-xs leading-relaxed text-muted">
        <p>
          <span className="text-foreground">Privacy:</span> we store your
          provider id, public name, email, and avatar URL. We never post on
          your behalf without a separate explicit prompt.
        </p>
        <p>
          <span className="text-foreground">Sessions:</span> HttpOnly cookies
          scoped to <code className="text-foreground">aeonterminal.org</code>,
          revoked on sign-out, auto-expire after 30 days.
        </p>
        <p>
          <span className="text-foreground">Memory:</span> the last 5
          conversation turns and 10 skill runs persist per account so Claude
          has continuity. Clear with{" "}
          <code className="text-foreground">memory clear</code> in the
          terminal.
        </p>
      </section>
    </main>
  );
}
