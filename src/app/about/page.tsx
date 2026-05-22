import type { Metadata } from "next";
import Link from "next/link";
import { TerminalWindow } from "@/components/terminal-window";

export const metadata: Metadata = {
  title: "About",
  description:
    "The Aeon Terminal manifesto. Why autonomous, why the terminal, and what we're not building.",
};

const TIMELINE = [
  {
    when: "00:00",
    what: "boot",
    detail:
      "agent identity loaded from ./soul · STYLE.md, SOUL.md, examples/",
  },
  {
    when: "00:01",
    what: "memory",
    detail: "MEMORY.md and logs/ swept · open issues tallied",
  },
  {
    when: "00:02",
    what: "schedule",
    detail: "next 6 runs queued · cron + reactive triggers",
  },
  {
    when: "00:05",
    what: "morning-brief",
    detail: "context fetched · voice match 0.94 · sent to telegram",
  },
  {
    when: "00:15",
    what: "pr-review",
    detail: "2 PRs reviewed · 1 auto-merged · 1 needs your eyes",
  },
  {
    when: "00:30",
    what: "self-improve",
    detail: "skill-health detected drift on rss-digest · patch staged",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:py-16">
      <p className="text-[11px] uppercase tracking-widest text-muted">
        $ cat manifesto.md
      </p>
      <h1 className="mt-1 text-3xl tracking-tight text-foreground sm:text-4xl">
        Autonomous agents,{" "}
        <span className="text-accent glow-accent">from the terminal.</span>
      </h1>

      <div className="prose-invert mt-8 space-y-6 text-sm leading-relaxed text-muted">
        <p>
          Most agent tools put you in the driver&apos;s seat — approve this
          tool call, review this diff, confirm this action. That&apos;s useful
          for interactive work. But there&apos;s a whole class of tasks where
          you just want the work <em>done</em> while you&apos;re not there:
          morning briefs, market monitoring, PR reviews, research digests,
          security scans.
        </p>
        <p className="text-foreground">
          Aeon Terminal is built for that.
        </p>
        <p>
          The terminal isn&apos;t a theme. It&apos;s the surface area. A skill
          is a command. A schedule is a cron line. A run is a stream of
          coloured lines you can read in three seconds. There&apos;s no chat,
          no thread, no &quot;assistant&quot; with a name. You write the
          spec, you walk away.
        </p>
        <h2 className="pt-4 text-base text-foreground">What we&apos;re not.</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Not a coding agent. Use Claude Code or Cursor for that.</li>
          <li>
            Not a chat assistant. We don&apos;t want a relationship with your
            agent.
          </li>
          <li>
            Not a no-code builder. Skills are markdown. Read them, fork them,
            delete them.
          </li>
          <li>
            Not infrastructure. Aeon Terminal runs on whatever you&apos;ve got
            — your laptop, a cron, a GitHub Action.
          </li>
        </ul>
        <h2 className="pt-4 text-base text-foreground">A day in the life.</h2>
      </div>

      <TerminalWindow title="aeon@today" host="~/agents/me" className="mt-6">
        <div className="bg-[#050708] px-4 py-3 text-[13px] leading-7 sm:px-5">
          {TIMELINE.map((t, i) => (
            <div key={i} className="grid grid-cols-[64px_1fr] gap-3">
              <span className="text-muted-2">[{t.when}]</span>
              <span>
                <span className="text-accent">{t.what}</span>
                <span className="text-muted"> · {t.detail}</span>
              </span>
            </div>
          ))}
        </div>
      </TerminalWindow>

      <div className="mt-10 rounded border border-border bg-surface p-5">
        <p className="text-[11px] uppercase tracking-widest text-muted">
          inspired by
        </p>
        <p className="mt-2 text-sm leading-relaxed text-foreground">
          <a
            href="https://github.com/aaronjmars/aeon"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            aaronjmars/aeon
          </a>{" "}
          <span className="text-muted">
            — the autonomous agent framework that pioneered the &quot;run it,
            forget it&quot; model. Aeon Terminal takes that spirit and rebuilds
            the surface as a terminal.
          </span>
        </p>
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/terminal"
          className="inline-flex items-center gap-2 rounded border border-accent bg-accent/10 px-4 py-2 text-sm text-accent transition-colors hover:bg-accent/20"
        >
          <span aria-hidden>{">"}</span> launch terminal
        </Link>
        <Link
          href="/skills"
          className="inline-flex items-center gap-2 rounded border border-border bg-surface px-4 py-2 text-sm text-foreground transition-colors hover:border-border-strong"
        >
          browse skills →
        </Link>
      </div>
    </div>
  );
}
