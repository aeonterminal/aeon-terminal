import Link from "next/link";
import { HeroTerminal } from "@/components/hero-terminal";
import { LiveSkillPanel } from "@/components/live-skill-panel";
import { TerminalWindow } from "@/components/terminal-window";
import { SkillCard } from "@/components/skill-card";
import { TokenPricePill } from "@/components/token-price-pill";
import {
  CATEGORIES,
  SKILLS,
  SKILL_COUNT_BY_CATEGORY,
  type SkillCategory,
} from "@/lib/skills";
import { ROADMAP } from "@/lib/roadmap";
import { TOKEN } from "@/lib/token";

const FEATURED_SLUGS = [
  "morning-brief",
  "pr-review",
  "token-alert",
  "code-health",
  "deep-research",
  "defi-monitor",
];

const COMPARISON = [
  { label: "Skill catalog you can scroll, not chat into", you: "yes", other: "chat-only" },
  { label: "Persistent memory across sessions", you: "yes", other: "session only" },
  { label: "Pulls live data (GitHub, RSS, CoinGecko, DefiLlama)", you: "yes", other: "sometimes" },
  { label: "Per-user daily quota, no surprise bills", you: "yes", other: "meter\u2011on\u2011token" },
  { label: "Zero infrastructure to host", you: "yes", other: "yours to host" },
  { label: "Honest about what's not built yet", you: "yes", other: "rarely" },
];

export default function HomePage() {
  return (
    <div className="relative">
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-border">
        <div aria-hidden className="absolute inset-0 dots opacity-50" />
        <div className="relative mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:gap-10 sm:px-6 sm:py-16 lg:grid-cols-2 lg:gap-14 lg:py-24">
          <div className="flex flex-col justify-center gap-6">
            <div className="flex flex-wrap items-center gap-2">
              <p className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-[11px] uppercase tracking-widest text-muted">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_var(--accent)]" />
                autonomous agent terminal · v0.1.0
              </p>
              <TokenPricePill />
            </div>
            <h1 className="text-balance text-[1.75rem] leading-[1.1] tracking-tight text-foreground sm:text-4xl md:text-5xl">
              <span className="text-muted">$</span>{" "}
              <span className="text-foreground">aeon</span>
              <span className="text-muted">·</span>
              <span className="text-accent glow-accent">terminal</span>
              <span className="caret align-middle" />
            </h1>
            <p className="max-w-xl text-balance text-base leading-relaxed text-muted">
              A terminal-first control surface for AI agents. Sign in, run one
              of {SKILLS.filter((s) => !s.comingSoon).length} live skills, or
              just <span className="text-foreground">ask</span> anything backed
              by Claude with live web tools. No approval loops, no chat
              babysitting.
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
                {
                  k: "live skills",
                  v: SKILLS.filter((s) => !s.comingSoon).length.toString(),
                },
                { k: "total catalog", v: SKILLS.length.toString() },
                {
                  k: "free / day",
                  v: "30",
                },
              ].map((s) => (
                <div key={s.k} className="bg-surface px-2 py-3 sm:px-4">
                  <dt className="text-[10px] uppercase tracking-widest text-muted-2">
                    {s.k}
                  </dt>
                  <dd className="text-base text-foreground sm:text-lg">
                    {s.v}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="lg:pl-4">
            <TerminalWindow title="aeon@local" host="~/agents/me">
              <HeroTerminal />
            </TerminalWindow>
          </div>
        </div>
      </section>

      {/* PRINCIPLES */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
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
                d: "Each skill is a prompt with a contract. Pick one from the catalog, type its slug, and the agent fetches what it needs and returns a finished artifact.",
              },
              {
                t: "Live data, not vibes.",
                d: "Real skills call real APIs — GitHub, CoinGecko, DefiLlama, OSV.dev, arxiv, HN. If the call fails, the agent says so. It does not invent numbers.",
              },
              {
                t: "Persistent memory.",
                d: "The last few asks and skill runs stay with your account. The next session resumes the thread instead of starting from zero.",
              },
              {
                t: "Per-user quotas.",
                d: "30 asks and 10 skill runs per day on free. No metered tokens, no surprise bills, no credit card to try it.",
              },
              {
                t: "Catalog over chat.",
                d: "Browse a list, pick a skill, run it. No need to remember the perfect prompt — the prompt lives in the skill file.",
              },
              {
                t: "Honest about gaps.",
                d: "Skills that need integrations we haven't shipped (cron, write-access, Telegram) are labelled coming soon, with the exact requirement printed on the card.",
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
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
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

      {/* LIVE SKILL OUTPUT */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-muted">
                $ aeon live --skill github-monitor
              </p>
              <h2 className="mt-1 text-2xl tracking-tight text-foreground sm:text-3xl">
                One skill,{" "}
                <span className="text-accent-2 glow-accent-2">running live.</span>
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
                Below is the actual output of{" "}
                <code className="rounded bg-surface px-1.5 py-0.5 text-foreground">
                  github-monitor
                </code>{" "}
                pointed at this repo. Pulled from the public GitHub API in
                your browser. Refreshes every 5 minutes. No login required.
              </p>
            </div>
            <Link
              href="/skills"
              className="text-sm text-muted transition-colors hover:text-accent"
            >
              browse the catalog →
            </Link>
          </div>
          <LiveSkillPanel />
        </div>
      </section>

      {/* COMPARISON */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
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
          <div className="overflow-x-auto rounded border border-border bg-surface">
            <table className="w-full min-w-[36rem] text-sm">
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
                    <td className="px-4 py-3 text-accent">{row.you}</td>
                    <td className="px-4 py-3 text-muted">{row.other}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* TOKEN + ROADMAP TEASER */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="mb-8 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-muted">
                $ aeon token --summary
              </p>
              <h2 className="mt-1 text-2xl tracking-tight text-foreground sm:text-3xl">
                <span className="text-muted">$</span>
                <span className="text-accent glow-accent">aeonterminal</span>
                <span className="text-muted"> · </span>access &amp; steering
                for the terminal.
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
                Hold $aeonterminal to unlock paid quota, holder-only skills,
                and a vote on which scaffolded skill ships next. Token launch
                on {TOKEN.chain} via {TOKEN.launchpad} is coming soon.
              </p>
            </div>
            <Link
              href="/token"
              className="inline-flex w-fit items-center gap-2 rounded border border-accent bg-accent/10 px-4 py-2 text-sm text-accent transition-colors hover:bg-accent/20"
            >
              <span aria-hidden>{">"}</span> token &amp; roadmap
            </Link>
          </div>
          <ol className="grid gap-px overflow-hidden rounded border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {ROADMAP.map((phase) => {
              const tone =
                phase.status === "shipped"
                  ? "text-accent-2"
                  : phase.status === "wip"
                    ? "text-accent"
                    : "text-muted";
              const dot =
                phase.status === "shipped"
                  ? "bg-accent-2 shadow-[0_0_10px_var(--accent-2)]"
                  : phase.status === "wip"
                    ? "bg-accent shadow-[0_0_10px_var(--accent)]"
                    : phase.status === "planned"
                      ? "bg-muted"
                      : "border border-muted-2 bg-transparent";
              return (
                <li key={phase.slug} className="bg-surface p-4">
                  <p className="text-[10px] uppercase tracking-widest text-muted-2">
                    {phase.quarter}
                  </p>
                  <p className="mt-2 flex items-center gap-2 text-sm text-foreground">
                    <span
                      aria-hidden
                      className={`inline-block h-2 w-2 rounded-full ${dot}`}
                    />
                    {phase.title}
                  </p>
                  <p
                    className={`mt-1 text-[10px] uppercase tracking-widest ${tone}`}
                  >
                    {phase.status === "shipped"
                      ? "shipped"
                      : phase.status === "wip"
                        ? "in progress"
                        : phase.status === "planned"
                          ? "planned"
                          : "horizon"}
                  </p>
                  <p className="mt-2 text-[11px] leading-relaxed text-muted">
                    {phase.items[0].label}
                    {phase.items.length > 1 ? (
                      <span className="text-muted-2">
                        {" "}
                        · {phase.items.length - 1} more
                      </span>
                    ) : null}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* CTA */}
      <section>
        <div className="mx-auto max-w-3xl px-4 py-14 text-center sm:px-6 sm:py-20">
          <p className="text-[11px] uppercase tracking-widest text-muted">
            $ aeon connect
          </p>
          <h2 className="mt-3 text-2xl tracking-tight text-foreground sm:text-3xl md:text-4xl">
            Boot the terminal.{" "}
            <span className="text-accent glow-accent">Run a skill.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted">
            Sign in with Google, GitHub, or a magic link. 30 asks and 10 skill
            runs every day, free. Try{" "}
            <code className="rounded bg-surface px-1.5 py-0.5 text-foreground">
              ask 2 + 2
            </code>{" "}
            or{" "}
            <code className="rounded bg-surface px-1.5 py-0.5 text-foreground">
              run morning-brief
            </code>
            . No credit card.
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
