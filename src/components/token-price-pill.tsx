"use client";

import { useEffect, useState } from "react";

import {
  fetchTokenPrice,
  formatPercentChange,
  formatPriceUsd,
  type TokenPriceSnapshot,
} from "@/lib/dexscreener";
import { TOKEN } from "@/lib/token";

const POLL_MS = 60_000;

type PillState =
  | { kind: "loading" }
  | { kind: "ok"; snap: TokenPriceSnapshot }
  | { kind: "hidden" };

export function TokenPricePill() {
  const [state, setState] = useState<PillState>({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    const load = async () => {
      const result = await fetchTokenPrice(controller.signal);
      if (cancelled) return;
      if (!result) {
        setState((prev) => (prev.kind === "ok" ? prev : { kind: "hidden" }));
        return;
      }
      setState({ kind: "ok", snap: result });
    };

    void load();
    timer = setInterval(() => void load(), POLL_MS);

    return () => {
      cancelled = true;
      controller.abort();
      if (timer) clearInterval(timer);
    };
  }, []);

  if (state.kind !== "ok") return null;

  const { snap } = state;
  const up = snap.change24h >= 0;
  const changeColor = up ? "text-accent-2" : "text-[#ff6e6e]";

  return (
    <a
      href={snap.pairUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group inline-flex w-fit items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-[11px] text-muted transition-colors hover:border-border-strong hover:text-foreground"
      aria-label={`$${TOKEN.symbol} price ${formatPriceUsd(snap.priceUsd)} ${formatPercentChange(snap.change24h)}`}
    >
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent-2 shadow-[0_0_8px_var(--accent-2)]"
      />
      <span className="text-muted-2">$</span>
      <span className="text-accent">{TOKEN.symbol}</span>
      <span className="text-muted-2">·</span>
      <span className="text-foreground">{formatPriceUsd(snap.priceUsd)}</span>
      <span className="text-muted-2">·</span>
      <span className={changeColor}>{formatPercentChange(snap.change24h)}</span>
      <span className="text-muted-2 transition-colors group-hover:text-muted">
        ↗
      </span>
    </a>
  );
}
