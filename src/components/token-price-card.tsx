"use client";

import { useEffect, useState } from "react";

import {
  fetchTokenPrice,
  formatCompactUsd,
  formatPercentChange,
  formatPriceUsd,
  type TokenPriceSnapshot,
} from "@/lib/dexscreener";
import { TOKEN } from "@/lib/token";

const POLL_MS = 60_000;

type CardState =
  | { kind: "loading" }
  | { kind: "ok"; snap: TokenPriceSnapshot; updatedAt: number }
  | { kind: "hidden" };

export function TokenPriceCard() {
  const [state, setState] = useState<CardState>({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    const load = async () => {
      const result = await fetchTokenPrice(controller.signal);
      if (cancelled) return;
      if (!result) {
        setState((prev) =>
          prev.kind === "ok" ? prev : { kind: "hidden" },
        );
        return;
      }
      setState({ kind: "ok", snap: result, updatedAt: Date.now() });
    };

    void load();
    timer = setInterval(() => void load(), POLL_MS);

    return () => {
      cancelled = true;
      controller.abort();
      if (timer) clearInterval(timer);
    };
  }, []);

  if (state.kind === "hidden") return null;

  if (state.kind === "loading") {
    return (
      <div className="rounded border border-border bg-surface p-5">
        <p className="text-[11px] uppercase tracking-widest text-muted-2">
          $ aeon token --price · loading…
        </p>
        <div className="mt-4 grid gap-px overflow-hidden rounded border border-border bg-border sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-surface p-4">
              <div className="h-3 w-16 animate-pulse rounded bg-border" />
              <div className="mt-3 h-5 w-24 animate-pulse rounded bg-border" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const { snap, updatedAt } = state;
  const up = snap.change24h >= 0;
  const changeColor = up ? "text-accent-2" : "text-[#ff6e6e]";
  const changeGlow = up ? "glow-accent-2" : "";
  const updated = new Date(updatedAt);
  const updatedLabel = `${updated.getUTCHours().toString().padStart(2, "0")}:${updated
    .getUTCMinutes()
    .toString()
    .padStart(2, "0")} UTC`;

  const tiles = [
    {
      label: "price",
      value: formatPriceUsd(snap.priceUsd),
      cls: "text-foreground",
    },
    {
      label: "24h change",
      value: formatPercentChange(snap.change24h),
      cls: `${changeColor} ${changeGlow}`,
    },
    {
      label: "market cap",
      value: formatCompactUsd(snap.marketCap),
      cls: "text-foreground",
    },
    {
      label: "24h volume",
      value: formatCompactUsd(snap.volume24h),
      cls: "text-foreground",
    },
  ];

  return (
    <div className="rounded border border-border bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2 text-[11px] text-muted">
        <span>
          <span className="text-muted-2">$</span> aeon token --price
        </span>
        <span className="inline-flex items-center gap-2 text-muted-2">
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent-2 shadow-[0_0_8px_var(--accent-2)]"
          />
          live · {updatedLabel}
        </span>
      </div>
      <div className="grid gap-px overflow-hidden bg-border sm:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="bg-surface px-4 py-4">
            <p className="text-[10px] uppercase tracking-widest text-muted-2">
              {t.label}
            </p>
            <p className={`mt-2 text-lg sm:text-xl ${t.cls}`}>{t.value}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2 text-[11px] text-muted-2">
        <span>
          source:{" "}
          <a
            href={snap.pairUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted hover:text-foreground"
          >
            dexscreener · {TOKEN.chain.toLowerCase()} ↗
          </a>
        </span>
        <span>refresh every 60s</span>
      </div>
    </div>
  );
}
