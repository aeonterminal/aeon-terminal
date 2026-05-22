import Link from "next/link";
import { HeroTerminal } from "@/components/hero-terminal";
import { TerminalWindow } from "@/components/terminal-window";
import { SkillCard } from "@/components/skill-card";
import {
  CATEGORIES,
  SKILLS,
  SKILL_COUNT_BY_CATEGORY,
  type SkillCategory,
} from "@/lib/skills";

const FEATURED_SLUGS = [
  "morning-brief",
  "pr-review",
  "token-alert",
  "skill-repair",
  "deep-research",
  "syndicate-article",
];

const COMPARISON = [
  { label: "Runs unattended on a schedule", you: true, other: "rarely" },
  { label: "Skills are modular and composable", you: true, other: "monolithic" },
  { label: "Voice-matched output", you: true, other: "generic" },
  { label: "Self-heals when a skill fails", you: true, other: "no" },
  { label: "Persistent memory across runs", you: true, other: "session only" },
  { label: "Reactive triggers, not just cron", you: true, other: "cron only" },
  { label: "Zero infrastructure to host", you: true, other: "yours to host" },
];

export default function HomePage() {
  return (
    <div className="relative">
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-border">
        <div aria-hidden className="absolute inset-0 dots opacity-50" />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-14 lg:py-24">
          <div className="flex flex-col justify-center gap-6">
            <p className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-[11px] uppercase tracking-widest text-muted">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_var(--accent)]" />
              autonomous agent terminal · v0.1.0
            </p>
            <h1 className="text-3xl leading-[1.1] tracking-tight text-foreground sm:text-4xl md:text-5xl">
              <span className="text-muted">$</span>{" "}
              <span className="text-foreground">aeon</span>
              <span className="text-muted">·</span>
              <span className="text-accent glow-accent">terminal</span>
              <span className="caret align-middle" />
            </h1>
            <p className="max-w-xl text-balance text-base leading-relaxed text-muted">
              A terminal-first control surface for autonomous AI agents.
              Configure {SKILLS.length}+ skills, schedule runs, fan out
              notifications, and walk away. No approval loops. No babysitting.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
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
              <a
                href="https://github.com/aaronjmars/aeon"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-2 py-2 text-sm text-muted transition-colors hover:text-foreground"
              >
                inspired by aeon ↗
              </a>
            </div>
            <dl className="grid grid-cols-3 gap-px overflow-hidden rounded border border-border bg-border text-center">
              {[
                { k: "skills", v: SKILLS.length.toString() },
                { k: "categories", v: Object.keys(CATEGORIES).length.toString() },
                { k: "human steps", v: "0" },
              ].map((s) => (
                <div key={s.k} className="bg-surface px-4 py-3">
                  <dt className="text-[10px] uppercase tracking-widest text-muted-2">
                    {s.k}
                  </dt>
                  <dd className="text-lg text-foreground">{s.v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="lg:pl-4">
            <TerminalWindow title="aeon@local" host="~/agents/me">
              <HeroTerminal />
            </TerminalWindow>
            <p className="mt-3 text-center text-[11px] text-muted-2">
              live demo · types itself · safe to ignore
            </p>
          </div>
        </div>
      </section>

      {/* PRINCIPLES */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="mb-10 flex items-end justify-between gap-4 border-b border-border pb-4">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-muted">
                principles
              </p>
              <h2 className="mt-1 text-2xl tracking-tight text-foreground sm:text-3xl">
                Built for the work that doesn&apos;t need you in the loop.
              </h2>
            </div>
            <p className="hidden max-w-sm text-sm text-muted md:block">
              Aeon Terminal is for the 90% of recurring tasks where the right
              answer is &quot;just get it done.&quot;
            </p>
          </div>
          <ul className="grid gap-px overflow-hidden rounded border border-border bg-border md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                t: "Skills, not scripts.",
                d: "Each skill is a single markdown file with a prompt, a schedule, and a contract. Composable. Forkable. Replaceable.",
              },
              {
                t: "Schedule-first.",
                d: "Cron expressions for what to do every morning. Reactive triggers for what to do when something changes.",
              },
              {
                t: "Voice-matched.",
                d: "Your soul/ directory teaches the agent how you write. Output reads like you, not like ChatGPT.",
              },
              {
                t: "Self-healing.",
                d: "When a skill fails, the agent files an issue, patches the skill, and verifies the fix before notifying you.",
              },
              {
                t: "One inbox.",
                d: "Telegram, Discord, Slack — fan-out is a single line. Each channel is opt-in and silently skipped when missing.",
              },
              {
                t: "Run from anywhere.",
                d: "A real terminal, a web terminal, or a scheduled action. Same skills. Same memory. No new mental model.",
              },
            ].map((p) => (
              <li key={p.t} className="bg-surface p-5">
                <p className="text-sm text-accent">{p.t}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">{p.d}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* FEATURED SKILLS */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-muted">
                $ ls skills/featured
              </p>
              <h2 className="mt-1 text-2xl tracking-tight text-foreground sm:text-3xl">
                A few skills to start with.
              </h2>
            </div>
            <Link
              href="/skills"
              className="text-sm text-muted transition-colors hover:text-accent"
            >
              view all {SKILLS.length} →
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURED_SLUGS.map((slug) => {
              const s = SKILLS.find((x) => x.slug === slug);
              if (!s) return null;
              return <SkillCard key={slug} skill={s} />;
            })}
          </div>
          <div className="mt-10 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {(
              Object.entries(CATEGORIES) as Array<
                [SkillCategory, (typeof CATEGORIES)[SkillCategory]]
              >
            ).map(([key, cat]) => (
              <Link
                key={key}
                href={`/skills#${key}`}
                className="group rounded border border-border bg-surface p-3 transition-colors hover:border-border-strong"
              >
                <p className={`text-xs ${cat.accent}`}>{cat.label}</p>
                <p className="mt-1 text-lg text-foreground">
                  {SKILL_COUNT_BY_CATEGORY[key]}
                  <span className="text-muted-2 text-sm"> skills</span>
                </p>
                <p className="text-[11px] text-muted line-clamp-2">
                  {cat.description}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* COMPARISON */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="mb-8">
            <p className="text-[11px] uppercase tracking-widest text-muted">
              why a terminal
            </p>
            <h2 className="mt-1 text-2xl tracking-tight text-foreground sm:text-3xl">
              Most agents are interactive tools.{" "}
              <span className="text-muted">Aeon Terminal isn&apos;t.</span>
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
              Approve-this-tool-call agents are great for live coding. For
              monitoring, research, recaps, and digests — you don&apos;t want
              to be in the loop at all. The most autonomous agent is the one
              that never asks.
            </p>
          </div>
          <div className="overflow-hidden rounded border border-border bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2 text-left text-[11px] uppercase tracking-widest text-muted">
                  <th className="px-4 py-3 font-normal">capability</th>
                  <th className="px-4 py-3 font-normal text-accent">
                    aeon terminal
                  </th>
                  <th className="px-4 py-3 font-normal text-muted-2">
                    typical chat agent
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) => (
                  <tr
                    key={row.label}
                    className={
                      i % 2 === 0
                        ? "border-b border-border"
                        : "border-b border-border bg-surface-2/40"
                    }
                  >
                    <td className="px-4 py-3 text-foreground">{row.label}</td>
                    <td className="px-4 py-3 text-accent">yes</td>
                    <td className="px-4 py-3 text-muted">{row.other}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section>
        <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
          <p className="text-[11px] uppercase tracking-widest text-muted">
            $ aeon connect
          </p>
          <h2 className="mt-3 text-3xl tracking-tight text-foreground sm:text-4xl">
            Boot the terminal.{" "}
            <span className="text-accent glow-accent">Run a skill.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted">
            Open the interactive terminal and try{" "}
            <code className="rounded bg-surface px-1.5 py-0.5 text-foreground">
              ask hello
            </code>{" "}
            or{" "}
            <code className="rounded bg-surface px-1.5 py-0.5 text-foreground">
              run morning-brief
            </code>
            . Backed by Claude. No login required.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/terminal"
              className="inline-flex items-center gap-2 rounded border border-accent bg-accent/10 px-5 py-2.5 text-sm text-accent transition-colors hover:bg-accent/20"
            >
              <span aria-hidden>{">"}</span> launch terminal
            </Link>
            <Link
              href="/about"
              className="inline-flex items-center gap-2 rounded border border-border bg-surface px-5 py-2.5 text-sm text-foreground transition-colors hover:border-border-strong"
            >
              read the manifesto
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
