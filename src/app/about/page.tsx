import type { Metadata } from "next";
import Link from "next/link";
import { TerminalWindow } from "@/components/terminal-window";
import { SKILLS } from "@/lib/skills";

export const metadata: Metadata = {
  title: "About",
  description:
    "The Aeon Terminal manifesto. Why autonomous, why the terminal, and what we're not building.",
};

const TIMELINE = [
  {
    when: "sign in",
    what: "google / github / email",
    detail: "30-day cookie session · revocable from /api/auth/logout",
  },
  {
    when: "ask",
    what: "claude haiku 4.5",
    detail: "live fetch_url + read_rss tools · 30 free asks per day",
  },
  {
    when: "run",
    what: "morning-brief",
    detail: "hn + bbc feeds · grounded summary streamed back",
  },
  {
    when: "run",
    what: "pr-review",
    detail: "fetches the PR diff from github · returns inline comments",
  },
  {
    when: "run",
    what: "token-alert",
    detail: "real coingecko prices · 4 movers ranked by 24h delta",
  },
  {
    when: "memory",
    what: "last 8 turns + 5 runs",
    detail: "persisted in d1 · next session resumes the thread",
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
          you just want the work <em>done</em>: morning briefs, market
          monitoring, PR reviews, research digests, security scans.
        </p>
        <p className="text-foreground">
          Aeon Terminal is built for that. Today, that means a web terminal
          you sign into, a catalog of skills you can run by name, and a Claude
          backend with live fetch + RSS tools. Tomorrow, that means cron,
          fan-out, and self-healing — see the status panel below.
        </p>
        <p>
          The terminal isn&apos;t a theme, it&apos;s the surface area. A skill
          is a command. A run is a stream of coloured lines you can read in
          three seconds. There&apos;s no chat, no thread, no &quot;assistant&quot;
          with a name. You pick a skill, the skill picks the prompt.
        </p>
        <h2 className="pt-4 text-base text-foreground">What we&apos;re not.</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Not a coding agent. Use Claude Code or Cursor for that.</li>
          <li>
            Not a chat assistant. We don&apos;t want a relationship with your
            agent.
          </li>
          <li>
            Not a no-code builder. Skills are prompts, not workflows you drag
            and drop.
          </li>
          <li>
            Not a yet-another-LLM-frontend. We default to live data and call
            out hallucinations as bugs.
          </li>
        </ul>
        <h2 className="pt-4 text-base text-foreground">What today looks like.</h2>
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
          $ aeon status --honest
        </p>
        <h2 className="mt-1 text-base text-foreground">v0.1 · what&apos;s wired up</h2>
        <div className="mt-4 grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-accent">live</p>
            <ul className="mt-1 space-y-1 text-muted">
              <li>· google / github / email login</li>
              <li>· per-user memory in d1</li>
              <li>· per-user daily quota (30 asks, 10 runs)</li>
              <li>· claude haiku 4.5 with fetch + rss tools</li>
              <li>· 13 real skills (rss, github api, coingecko, defillama, osv.dev)</li>
            </ul>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-2">coming soon</p>
            <ul className="mt-1 space-y-1 text-muted">
              <li>· scheduled / cron runs</li>
              <li>· telegram / discord / slack fan-out</li>
              <li>· github write-access skills (auto-merge)</li>
              <li>· voice-matched output (soul/ directory)</li>
              <li>· self-healing skill repair loop</li>
            </ul>
          </div>
        </div>
        <p className="mt-4 text-[11px] leading-relaxed text-muted-2">
          {SKILLS.filter((s) => s.comingSoon).length} skills in the catalog are
          scaffolded but waiting on one of the coming-soon integrations. Each
          card prints its exact requirement.
        </p>
      </div>

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
