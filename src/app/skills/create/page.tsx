import type { Metadata } from "next";
import Link from "next/link";

import { CreateSkillForm } from "./create-form";

export const metadata: Metadata = {
  title: "Create skill",
  description:
    "Define your own Aeon Terminal skill. Name it, set the persona, run it from the terminal, share it as a link.",
};

export default function CreateSkillPage() {
  return (
    <main className="relative isolate min-h-[calc(100vh-3rem)] px-4 py-10 sm:px-6 sm:py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[360px] bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(255,107,26,0.10),transparent_70%)]"
      />

      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-8 space-y-2">
          <p className="text-[11px] uppercase tracking-[0.3em] text-muted">
            $ aeon skill --create
          </p>
          <h1 className="text-2xl tracking-tight text-foreground sm:text-3xl">
            Build your own{" "}
            <span className="text-accent glow-accent">skill</span>
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted">
            A custom skill is a named, reusable Claude persona attached to your
            account. Run it from the terminal with{" "}
            <code className="text-foreground">run &lt;slug&gt;</code>, or share
            a public skill as a one-click link.
          </p>
        </header>

        <CreateSkillForm />

        <details className="mt-10 rounded border border-border bg-surface/60 px-4 py-3 text-[11px] leading-relaxed text-muted open:bg-surface">
          <summary className="cursor-pointer text-[11px] uppercase tracking-[0.25em] text-muted-2 hover:text-foreground">
            $ aeon skill --explain
          </summary>
          <ul className="mt-3 space-y-2">
            <li>
              <span className="text-foreground">free tier:</span> up to 3
              custom skills per account. holders of{" "}
              <Link
                href="/token"
                className="text-muted hover:text-foreground"
              >
                $aeonterminal
              </Link>{" "}
              will get higher caps when wallet-connect ships in Q2.
            </li>
            <li>
              <span className="text-foreground">tools:</span> your skill
              inherits the same real tools (fetch_url, read_rss) as the
              catalog. it can pull live data, not just synthesize.
            </li>
            <li>
              <span className="text-foreground">visibility:</span> private
              skills only run from your terminal. public skills get a{" "}
              <code className="text-foreground">/skills/run?id=…</code> URL
              that anyone signed in can execute against their own quota.
            </li>
            <li>
              <span className="text-foreground">honest defaults:</span> skills
              that don&apos;t output anything useful are still real — Claude
              will say so in one line rather than fabricate.
            </li>
          </ul>
        </details>
      </div>
    </main>
  );
}
