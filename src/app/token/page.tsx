import type { Metadata } from "next";
import Link from "next/link";

import { CopyAddressButton } from "@/components/copy-address-button";
import { TerminalWindow } from "@/components/terminal-window";
import { ROADMAP, statusLabel, type MilestoneStatus } from "@/lib/roadmap";
import { TOKEN, UTILITIES, type UtilityStatus } from "@/lib/token";

export const metadata: Metadata = {
  title: "Token & Roadmap",
  description:
    "$aeonterminal contract address, token utility, and the public roadmap for the agent terminal.",
};

const STATUS_DOT: Record<MilestoneStatus, string> = {
  shipped: "bg-accent-2 shadow-[0_0_10px_var(--accent-2)]",
  wip: "bg-accent shadow-[0_0_10px_var(--accent)]",
  planned: "bg-muted",
  horizon: "border border-muted-2 bg-transparent",
};

const STATUS_LABEL_COLOR: Record<MilestoneStatus, string> = {
  shipped: "text-accent-2",
  wip: "text-accent",
  planned: "text-muted",
  horizon: "text-muted-2",
};

const UTILITY_BADGE: Record<UtilityStatus, { label: string; cls: string }> = {
  live: {
    label: "live",
    cls: "border-accent-2/40 bg-accent-2/10 text-accent-2",
  },
  next: {
    label: "next · in progress",
    cls: "border-accent/40 bg-accent/10 text-accent",
  },
  planned: {
    label: "planned",
    cls: "border-border-strong bg-surface-2 text-muted",
  },
};

const TICKER = `$${TOKEN.symbol}`;

export default function TokenPage() {
  return (
    <div className="relative">
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-border">
        <div aria-hidden className="absolute inset-0 dots opacity-50" />
        <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
          <p className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-[11px] uppercase tracking-widest text-muted">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_var(--accent)]" />
            $ cat token.md
          </p>
          <h1 className="mt-4 text-3xl leading-[1.1] tracking-tight text-foreground sm:text-4xl md:text-5xl">
            <span className="text-muted">$</span>
            <span className="text-accent glow-accent">aeonterminal</span>
            <span className="text-muted"> · </span>
            <span className="text-foreground">one token,</span>{" "}
            <span className="text-accent-2 glow-accent-2">one terminal.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-balance text-sm leading-relaxed text-muted sm:text-base">
            {TICKER} is the access layer for Aeon Terminal. Holders skip the
            paid subscription, get exclusive skills, and steer which scaffolded
            skill ships next. Token launched on{" "}
            <span className="text-foreground">{TOKEN.chain}</span> via{" "}
            <span className="text-foreground">{TOKEN.launchpad}</span>.
          </p>

          <TerminalWindow
            title="aeon@token"
            host="~/token/contract"
            className="mt-8"
          >
            <div className="bg-[#050708] px-4 py-4 text-[13px] leading-7 sm:px-5">
              <div className="grid grid-cols-[80px_1fr] gap-x-3 gap-y-1">
                <span className="text-muted-2">[symbol]</span>
                <span className="text-accent">{TICKER}</span>
                <span className="text-muted-2">[chain]</span>
                <span className="text-foreground">{TOKEN.chain}</span>
                <span className="text-muted-2">[launch]</span>
                <span className="text-foreground">{TOKEN.launchpad}</span>
                <span className="text-muted-2">[contract]</span>
                <span className="flex min-w-0 flex-wrap items-center gap-2">
                  <code className="break-all text-accent">
                    {TOKEN.address}
                  </code>
                  <CopyAddressButton className="text-muted-2 hover:text-foreground" />
                </span>
              </div>
            </div>
          </TerminalWindow>

          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href={TOKEN.buyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded border border-accent bg-accent/10 px-4 py-2 text-sm text-accent transition-colors hover:bg-accent/20"
            >
              <span aria-hidden>{">"}</span> buy on virtuals ↗
            </a>
            <a
              href={TOKEN.dexscreenerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded border border-border bg-surface px-4 py-2 text-sm text-foreground transition-colors hover:border-border-strong"
            >
              dexscreener ↗
            </a>
            <a
              href={TOKEN.scanUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded border border-border bg-surface px-4 py-2 text-sm text-muted transition-colors hover:border-border-strong hover:text-foreground"
            >
              basescan ↗
            </a>
          </div>
        </div>
      </section>

      {/* UTILITY */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-muted">
                $ aeon token --utility
              </p>
              <h2 className="mt-2 text-2xl tracking-tight text-foreground sm:text-3xl">
                What the token{" "}
                <span className="text-accent glow-accent">actually does.</span>
              </h2>
            </div>
            <p className="max-w-md text-xs leading-relaxed text-muted">
              No revenue share. No yield promises. Token gives access to the
              terminal and steering rights over its roadmap.
            </p>
          </div>

          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {UTILITIES.map((u) => {
              const badge = UTILITY_BADGE[u.status];
              return (
                <li
                  key={u.slug}
                  className="group rounded border border-border bg-surface p-5 transition-colors hover:border-border-strong"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base text-foreground">
                      <span className="text-accent">{">"}</span> {u.title}
                    </h3>
                    <span
                      className={`inline-flex flex-shrink-0 rounded border px-2 py-0.5 text-[10px] uppercase tracking-widest ${badge.cls}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-muted">
                    {u.summary}
                  </p>
                  <p className="mt-2 text-[12px] leading-relaxed text-muted-2">
                    {u.detail}
                  </p>
                  {u.blockedBy ? (
                    <p className="mt-3 text-[11px] text-muted-2">
                      <span className="text-muted-2">needs: </span>
                      <span className="text-muted">{u.blockedBy}</span>
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>

          <p className="mt-6 text-[11px] leading-relaxed text-muted-2">
            Each utility above is either live today or on the roadmap with the
            integration it depends on. Nothing here is a return promise; the
            token is for access and governance, not yield.
          </p>
        </div>
      </section>

      {/* ROADMAP */}
      <section className="border-b border-border bg-surface/40">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-muted">
                $ aeon roadmap --honest
              </p>
              <h2 className="mt-2 text-2xl tracking-tight text-foreground sm:text-3xl">
                The full year,{" "}
                <span className="text-accent-2 glow-accent-2">in writing.</span>
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] uppercase tracking-widest text-muted-2">
              {(["shipped", "wip", "planned", "horizon"] as const).map((s) => (
                <span key={s} className="inline-flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className={`inline-block h-2 w-2 rounded-full ${STATUS_DOT[s]}`}
                  />
                  <span className={STATUS_LABEL_COLOR[s]}>
                    {statusLabel(s)}
                  </span>
                </span>
              ))}
            </div>
          </div>

          <ol className="relative mt-10 space-y-10 border-l border-border pl-6 sm:pl-8">
            {ROADMAP.map((phase) => (
              <li key={phase.slug} className="relative">
                <span
                  aria-hidden
                  className={`absolute -left-[33px] top-1.5 inline-block h-3 w-3 rounded-full sm:-left-[37px] ${STATUS_DOT[phase.status]}`}
                />
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-[11px] uppercase tracking-widest text-muted-2">
                    {phase.quarter}
                  </span>
                  <h3 className="text-lg text-foreground">{phase.title}</h3>
                  <span
                    className={`text-[10px] uppercase tracking-widest ${STATUS_LABEL_COLOR[phase.status]}`}
                  >
                    [{statusLabel(phase.status)}]
                  </span>
                </div>
                <ul className="mt-4 space-y-2 text-sm">
                  {phase.items.map((item) => (
                    <li
                      key={item.label}
                      className="grid grid-cols-[14px_1fr] gap-x-3"
                    >
                      <span
                        aria-hidden
                        className={
                          phase.status === "shipped"
                            ? "text-accent-2"
                            : phase.status === "wip"
                              ? "text-accent"
                              : "text-muted-2"
                        }
                      >
                        {phase.status === "shipped"
                          ? "✓"
                          : phase.status === "wip"
                            ? "~"
                            : "·"}
                      </span>
                      <span>
                        <span className="text-foreground">{item.label}</span>
                        <span className="text-muted"> — {item.detail}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>

          <p className="mt-10 text-[11px] leading-relaxed text-muted-2">
            Dates are quarters not days. Anything tagged{" "}
            <span className="text-muted">[planned]</span> or{" "}
            <span className="text-muted-2">[horizon]</span> can slip, get cut,
            or get reordered by the holder vote. {TICKER} is not a presale of
            any of the items below.
          </p>
        </div>
      </section>

      {/* DISCLAIMER + CTA */}
      <section>
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <div className="rounded border border-border bg-surface p-5">
            <p className="text-[11px] uppercase tracking-widest text-muted">
              $ aeon disclaimer --read-me
            </p>
            <h2 className="mt-1 text-base text-foreground">
              Be sensible about this.
            </h2>
            <ul className="mt-3 space-y-1 text-[12px] leading-relaxed text-muted">
              <li>
                · {TICKER} is a utility token for access to a software product.
                It is not an investment contract, not a security, and not a
                promise of return.
              </li>
              <li>
                · Anything on the roadmap can change. The only commitment is
                that we ship in public and update this page as we go.
              </li>
              <li>
                · Don&apos;t buy more than you can lose. Confirm the contract
                address from this page before buying — phishing tokens
                impersonating us will appear.
              </li>
            </ul>
          </div>
          <div className="mt-8 text-center">
            <p className="text-[11px] uppercase tracking-widest text-muted">
              $ aeon connect
            </p>
            <h2 className="mt-3 text-2xl tracking-tight text-foreground sm:text-3xl">
              Try the terminal first.{" "}
              <span className="text-accent glow-accent">Buy if it ships.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted">
              The 30-asks-a-day free tier doesn&apos;t need {TICKER}. Run a
              skill, see if it earns your trust, then decide.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href="/terminal"
                className="inline-flex items-center gap-2 rounded border border-accent bg-accent/10 px-5 py-2.5 text-sm text-accent transition-colors hover:bg-accent/20"
              >
                <span aria-hidden>{">"}</span> launch terminal
              </Link>
              <a
                href={TOKEN.buyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded border border-border bg-surface px-5 py-2.5 text-sm text-foreground transition-colors hover:border-border-strong"
              >
                buy on virtuals ↗
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
