"use client";

import { useEffect, useMemo, useState } from "react";

import { SKILLS } from "@/lib/skills";

type Probe = {
  ok: boolean;
  latency_ms: number;
  error?: string;
  result?: string;
  block_number?: number;
};

type StatusPayload = {
  ok: boolean;
  now: number;
  now_iso: string;
  day: string;
  probes: {
    d1: Probe;
    base_rpc: Probe;
    dexscreener: Probe;
    github: Probe;
  };
  counters: {
    users_total: number;
    users_24h: number;
    wallets_linked: number;
    asks_today: number;
    runs_today: number;
    active_today: number;
  };
  skills: {
    total: number;
    live: number;
    coming_soon: number;
    recent: SkillRecent[];
    recent_note: string;
  };
  took_ms: number;
};

type SkillRecent = {
  slug: string;
  last_at: number | null;
  last_ago_sec: number | null;
  recent_runs: number;
};

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; data: StatusPayload; fetchedAt: number }
  | { kind: "err"; message: string; fetchedAt: number };

const POLL_MS = 30_000;
const SLOW_THRESHOLD_MS = 500;

function pillClasses(probe: Probe): string {
  if (!probe.ok) return "border-red/40 bg-red/10 text-red";
  if (probe.latency_ms > SLOW_THRESHOLD_MS) {
    return "border-amber/40 bg-amber/10 text-amber";
  }
  return "border-accent-2/40 bg-accent-2/10 text-accent-2";
}

function pillLabel(probe: Probe): string {
  if (!probe.ok) return "down";
  if (probe.latency_ms > SLOW_THRESHOLD_MS) return "slow";
  return "ok";
}

function formatRelative(secAgo: number | null): string {
  if (secAgo === null) return "no recent runs";
  if (secAgo < 60) return `${secAgo}s ago`;
  if (secAgo < 3600) return `${Math.floor(secAgo / 60)}m ago`;
  if (secAgo < 86400) return `${Math.floor(secAgo / 3600)}h ago`;
  return `${Math.floor(secAgo / 86400)}d ago`;
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

const liveSlugSet = new Set(
  SKILLS.filter((s) => !s.comingSoon).map((s) => s.slug),
);

export function StatusDashboard() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [secondsSince, setSecondsSince] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/status", { cache: "no-store" });
        if (cancelled) return;
        if (!res.ok) {
          setState({
            kind: "err",
            message: `http_${res.status}`,
            fetchedAt: Date.now(),
          });
          setSecondsSince(0);
          return;
        }
        const data = (await res.json()) as StatusPayload;
        if (cancelled) return;
        setState({ kind: "ok", data, fetchedAt: Date.now() });
        setSecondsSince(0);
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "request_failed";
        setState({ kind: "err", message: msg, fetchedAt: Date.now() });
        setSecondsSince(0);
      }
    }
    void load();
    const fetchId = setInterval(() => void load(), POLL_MS);
    const tickId = setInterval(() => setSecondsSince((s) => s + 1), 1000);
    return () => {
      cancelled = true;
      clearInterval(fetchId);
      clearInterval(tickId);
    };
  }, []);

  const probeRows = useMemo(() => {
    if (state.kind !== "ok") return null;
    const p = state.data.probes;
    return [
      { key: "worker", label: "worker", probe: { ok: true, latency_ms: 0 } as Probe, detail: "responding" },
      {
        key: "d1",
        label: "d1 (sqlite)",
        probe: p.d1,
        detail: p.d1.ok ? `${p.d1.result ?? "pong"} · ${p.d1.latency_ms}ms` : p.d1.error ?? "down",
      },
      {
        key: "base_rpc",
        label: "base rpc",
        probe: p.base_rpc,
        detail: p.base_rpc.ok
          ? `block ${formatNumber(p.base_rpc.block_number ?? 0)} · ${p.base_rpc.latency_ms}ms`
          : p.base_rpc.error ?? "down",
      },
      {
        key: "dexscreener",
        label: "dexscreener",
        probe: p.dexscreener,
        detail: p.dexscreener.ok
          ? `200 · ${p.dexscreener.latency_ms}ms`
          : p.dexscreener.error ?? "down",
      },
      {
        key: "github",
        label: "github",
        probe: p.github,
        detail: p.github.ok ? `200 · ${p.github.latency_ms}ms` : p.github.error ?? "down",
      },
    ];
  }, [state]);

  const skillsSorted = useMemo(() => {
    if (state.kind !== "ok") return [];
    const recentMap = new Map(state.data.skills.recent.map((s) => [s.slug, s]));
    return SKILLS.filter((s) => !s.comingSoon && liveSlugSet.has(s.slug))
      .map((s) => {
        const stat = recentMap.get(s.slug);
        return {
          slug: s.slug,
          name: s.name,
          category: s.category,
          last_ago_sec: stat ? stat.last_ago_sec : null,
          recent_runs: stat ? stat.recent_runs : 0,
        };
      })
      .sort((a, b) => {
        if (a.last_ago_sec === null && b.last_ago_sec === null) {
          return a.slug.localeCompare(b.slug);
        }
        if (a.last_ago_sec === null) return 1;
        if (b.last_ago_sec === null) return -1;
        return a.last_ago_sec - b.last_ago_sec;
      });
  }, [state]);

  if (state.kind === "loading") {
    return (
      <div className="rounded border border-border bg-surface/80 px-5 py-8 text-sm text-muted">
        $ aeon status --wait{" "}
        <span className="inline-block animate-pulse">...</span>
      </div>
    );
  }

  if (state.kind === "err") {
    return (
      <div className="space-y-3 rounded border border-red/40 bg-red/10 px-5 py-6">
        <p className="text-sm text-red">
          $ aeon status — fetch failed: {state.message}
        </p>
        <p className="text-xs text-muted">
          Auto-retrying every {POLL_MS / 1000}s.
        </p>
      </div>
    );
  }

  const { data } = state;
  const refreshedLabel =
    secondsSince < 5 ? "just now" : `${secondsSince}s ago`;
  const overallOk = data.ok;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-2">
        <span>
          last fetch:{" "}
          <span className="text-foreground">{refreshedLabel}</span> · took{" "}
          <span className="text-foreground">{data.took_ms}ms</span> · next in{" "}
          <span className="text-foreground">
            {Math.max(0, POLL_MS / 1000 - secondsSince)}s
          </span>
        </span>
        <span
          className={`inline-flex items-center gap-2 rounded border px-2 py-0.5 ${
            overallOk
              ? "border-accent-2/40 bg-accent-2/10 text-accent-2"
              : "border-amber/40 bg-amber/10 text-amber"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              overallOk ? "bg-accent-2" : "bg-amber"
            }`}
          />
          {overallOk ? "all systems nominal" : "degraded probes"}
        </span>
      </div>

      <section className="rounded border border-border bg-surface/80 p-5 sm:p-6">
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <p className="text-[11px] uppercase tracking-[0.3em] text-muted">
            $ aeon status --infra
          </p>
          <p className="text-[11px] text-muted-2">
            slow &gt; <span className="text-foreground">{SLOW_THRESHOLD_MS}ms</span>
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {probeRows?.map((row) => (
            <div
              key={row.key}
              className="flex items-start justify-between gap-3 rounded border border-border bg-bg/40 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-foreground">{row.label}</p>
                <p className="mt-0.5 truncate text-[11px] text-muted-2">
                  {row.detail}
                </p>
              </div>
              <span
                className={`shrink-0 rounded border px-2 py-0.5 text-[10px] uppercase tracking-wider ${pillClasses(
                  row.probe,
                )}`}
              >
                {pillLabel(row.probe)}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded border border-border bg-surface/80 p-5 sm:p-6">
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <p className="text-[11px] uppercase tracking-[0.3em] text-muted">
            $ aeon status --usage
          </p>
          <p className="text-[11px] text-muted-2">
            day: <span className="text-foreground">{data.day}</span> · utc
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <CounterTile label="asks today" value={data.counters.asks_today} accent="accent" />
          <CounterTile label="runs today" value={data.counters.runs_today} accent="accent-2" />
          <CounterTile
            label="active today"
            value={data.counters.active_today}
            accent="amber"
          />
          <CounterTile label="users total" value={data.counters.users_total} />
          <CounterTile label="users · 24h" value={data.counters.users_24h} />
          <CounterTile
            label="wallets linked"
            value={data.counters.wallets_linked}
          />
        </div>
      </section>

      <section className="rounded border border-border bg-surface/80 p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
          <p className="text-[11px] uppercase tracking-[0.3em] text-muted">
            $ aeon status --skills
          </p>
          <p className="text-[11px] text-muted-2">
            <span className="text-foreground">{data.skills.live}</span> live ·{" "}
            <span className="text-foreground">{data.skills.coming_soon}</span>{" "}
            coming-soon · total{" "}
            <span className="text-foreground">{data.skills.total}</span>
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-2">
                <th className="pb-2 pr-3 font-normal">slug</th>
                <th className="pb-2 pr-3 font-normal">category</th>
                <th className="pb-2 pr-3 font-normal">last run</th>
                <th className="pb-2 text-right font-normal">recent runs</th>
              </tr>
            </thead>
            <tbody>
              {skillsSorted.map((row) => {
                const isFresh =
                  row.last_ago_sec !== null && row.last_ago_sec < 3600;
                return (
                  <tr key={row.slug} className="border-t border-border/60">
                    <td className="py-2 pr-3 text-foreground">{row.slug}</td>
                    <td className="py-2 pr-3 text-muted">{row.category}</td>
                    <td
                      className={`py-2 pr-3 ${
                        isFresh
                          ? "text-accent-2"
                          : row.last_ago_sec === null
                            ? "text-muted-2"
                            : "text-muted"
                      }`}
                    >
                      {formatRelative(row.last_ago_sec)}
                    </td>
                    <td className="py-2 text-right text-foreground">
                      {row.recent_runs}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-muted-2">
          {data.skills.recent_note}
        </p>
      </section>
    </div>
  );
}

function CounterTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "accent" | "accent-2" | "amber";
}) {
  const accentClass =
    accent === "accent"
      ? "text-accent"
      : accent === "accent-2"
        ? "text-accent-2"
        : accent === "amber"
          ? "text-amber"
          : "text-foreground";
  return (
    <div className="rounded border border-border bg-bg/40 px-3 py-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-2">
        {label}
      </p>
      <p className={`mt-1 text-xl tabular-nums ${accentClass}`}>
        {formatNumber(value)}
      </p>
    </div>
  );
}
