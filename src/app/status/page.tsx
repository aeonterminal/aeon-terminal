import type { Metadata } from "next";

import { StatusDashboard } from "./status-dashboard";

export const metadata: Metadata = {
  title: "Status · live infrastructure & usage",
  description:
    "Public health & usage signals for Aeon Terminal. Worker, D1, Solana RPC, Dexscreener, GitHub probes plus today's asks/runs and per-skill activity, refreshed every 30s.",
};

export default function StatusPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
      <header className="mb-8 space-y-2">
        <p className="text-[11px] uppercase tracking-[0.3em] text-muted">
          $ aeon status --infra --usage --skills
        </p>
        <h1 className="text-2xl tracking-tight text-foreground sm:text-3xl">
          Live signals,{" "}
          <span className="text-accent glow-accent">no fake dashboards.</span>
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          What you see here is what the worker sees: real probes to D1, Solana
          RPC, Dexscreener, GitHub, plus today&apos;s usage counters from the
          same tables the rest of the app writes to. Polls every 30s. No
          history yet — this page is a trust signal, not a monitoring tool.
        </p>
      </header>

      <StatusDashboard />
    </div>
  );
}
