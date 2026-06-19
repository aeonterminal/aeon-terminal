"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { TOKEN, shortAddress } from "@/lib/token";

type Me = {
  user: {
    id: string;
    email: string | null;
    name: string | null;
    avatar_url: string | null;
    provider: string | null;
    plan: string;
  } | null;
  tier?: {
    tier: "free" | "paid";
    plan: "free" | "paid";
    source: "plan" | "holder";
    wallet: {
      address: string;
      tier: "free" | "paid";
      balance_wei?: string;
    } | null;
    threshold_wei?: string;
  } | null;
  usage?: {
    day: string;
    asks: number;
    runs: number;
    limits: { asks: number; runs: number };
  } | null;
};

// Format a wei string (18 decimals) as a short integer balance with k/M
// suffix. Used in the menu where we want a glanceable size, not precision.
// Avoids BigInt literals so the file can be transpiled to older targets.
function formatTokenShort(wei: string | undefined): string {
  if (!wei || !/^-?\d+$/.test(wei)) return "0";
  // Drop the last 18 digits (= integer wei → integer token units).
  let whole = wei.length > 18 ? wei.slice(0, wei.length - 18) : "0";
  whole = whole.replace(/^0+(?=\d)/, "") || "0";
  // ~16 digits is the safe range for Number conversion.
  const num = whole.length > 15 ? Number.POSITIVE_INFINITY : Number(whole);
  if (!Number.isFinite(num)) return `${whole.slice(0, -9)}B+`;
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(num >= 10_000_000 ? 0 : 1)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(num >= 10_000 ? 0 : 1)}k`;
  }
  return num.toString();
}

function pct(used: number, limit: number): number {
  if (!limit) return 0;
  return Math.max(0, Math.min(100, Math.round((used / limit) * 100)));
}

export function UserBadge() {
  const [me, setMe] = useState<Me | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/me", { credentials: "include" });
        if (cancelled) return;
        if (!res.ok) {
          setMe({ user: null });
          return;
        }
        const data = (await res.json()) as Me;
        if (cancelled) return;
        setMe(data);
      } catch {
        if (!cancelled) setMe({ user: null });
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("click", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const signOut = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // ignore
    }
    setOpen(false);
    setMe({ user: null });
  }, []);

  if (me === null) {
    return (
      <span
        aria-hidden
        className="inline-block h-6 w-16 animate-pulse rounded bg-surface-2"
      />
    );
  }

  if (!me.user) {
    return (
      <Link
        href="/login"
        className="inline-flex items-center rounded border border-border px-2 py-1 text-xs text-muted transition-colors hover:border-accent hover:text-accent"
      >
        sign in
      </Link>
    );
  }

  const user = me.user;
  const label = user.name || user.email || "operator";
  const initial = (label[0] || "?").toUpperCase();
  const asks = me.usage?.asks ?? 0;
  const runs = me.usage?.runs ?? 0;
  const askLimit = me.usage?.limits.asks ?? 30;
  const runLimit = me.usage?.limits.runs ?? 10;
  const askPct = pct(asks, askLimit);
  const runPct = pct(runs, runLimit);
  const tierLabel =
    me.tier?.source === "holder" ? "holder" : me.tier?.tier ?? user.plan;
  const isHolder = tierLabel === "holder";
  const isPaid = tierLabel === "paid";
  const tierClass = isHolder
    ? "text-accent-2"
    : isPaid
      ? "text-accent"
      : "text-muted";
  const tierBorderClass = isHolder
    ? "border-accent-2/40 bg-accent-2/5"
    : isPaid
      ? "border-accent/40 bg-accent/5"
      : "border-border bg-surface-2/40";
  const wallet = me.tier?.wallet ?? null;
  const walletLinked = !!wallet;
  const balanceShort = wallet ? formatTokenShort(wallet.balance_wei) : null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded border border-border px-1.5 py-1 text-xs text-foreground transition-colors hover:border-accent"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {user.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatar_url}
            alt=""
            className="h-5 w-5 rounded-full border border-border object-cover"
          />
        ) : (
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border bg-surface-2 text-[10px] uppercase text-muted">
            {initial}
          </span>
        )}
        <span className="hidden max-w-[120px] truncate text-foreground sm:inline">
          {label}
        </span>
        <span className="hidden text-muted sm:inline">·</span>
        <span className={`hidden sm:inline ${tierClass}`}>{tierLabel}</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-[18rem] max-w-[calc(100vw-1rem)] overflow-hidden rounded border border-border bg-surface text-xs shadow-[0_8px_32px_rgba(0,0,0,0.45)]"
        >
          <div className="flex items-start gap-3 border-b border-border bg-surface-2/40 p-3">
            {user.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatar_url}
                alt=""
                className={`h-10 w-10 rounded-full border object-cover ${
                  isHolder
                    ? "border-accent-2"
                    : isPaid
                      ? "border-accent"
                      : "border-border"
                }`}
              />
            ) : (
              <span
                className={`inline-flex h-10 w-10 items-center justify-center rounded-full border bg-surface text-base uppercase text-foreground ${
                  isHolder
                    ? "border-accent-2"
                    : isPaid
                      ? "border-accent"
                      : "border-border"
                }`}
              >
                {initial}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-foreground">{label}</div>
              {user.email && user.email !== label ? (
                <div className="truncate text-[11px] text-muted">
                  {user.email}
                </div>
              ) : null}
              <div className="mt-0.5 text-[10px] uppercase tracking-widest text-muted-2">
                via{" "}
                <span className="normal-case tracking-normal text-muted">
                  {user.provider || "—"}
                </span>
              </div>
            </div>
          </div>

          <div className={`m-3 rounded border p-2.5 ${tierBorderClass}`}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[10px] uppercase tracking-widest text-muted-2">
                $ tier
              </span>
              <span className={`font-mono text-sm ${tierClass}`}>
                {tierLabel}
              </span>
            </div>
            <div className="mt-1 text-[10px] leading-snug text-muted">
              {isHolder ? (
                <>
                  unlocked by holding{" "}
                  <span className="text-foreground">100k ${TOKEN.symbol}</span>{" "}
                  on Solana.
                </>
              ) : isPaid ? (
                <>active paid plan.</>
              ) : (
                <>
                  hold{" "}
                  <span className="text-foreground">100k ${TOKEN.symbol}</span>{" "}
                  on Solana to unlock <span className="text-accent">paid</span>{" "}
                  quota.
                </>
              )}
            </div>
            {!isHolder && !isPaid ? (
              <Link
                href="/account"
                onClick={() => setOpen(false)}
                className="mt-2 inline-flex items-center rounded border border-accent/50 bg-accent/10 px-2 py-1 text-[10px] uppercase tracking-widest text-accent transition-colors hover:bg-accent/20"
              >
                → upgrade
              </Link>
            ) : null}
          </div>

          <div className="mx-3 mb-2">
            <div className="text-[10px] uppercase tracking-widest text-muted-2">
              $ usage --today
            </div>
            <div className="mt-1.5 space-y-2">
              <UsageRow label="asks" used={asks} limit={askLimit} pct={askPct} />
              <UsageRow label="runs" used={runs} limit={runLimit} pct={runPct} />
            </div>
          </div>

          {walletLinked && wallet ? (
            <div className="mx-3 mb-2 border-t border-border pt-2">
              <div className="text-[10px] uppercase tracking-widest text-muted-2">
                $ wallet
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <code className="truncate font-mono text-[11px] text-foreground">
                  {shortAddress(wallet.address, 6)}
                </code>
                <span className="text-[11px] text-muted">
                  {balanceShort} {TOKEN.symbol}
                </span>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col border-t border-border bg-surface-2/30 p-2">
            <MenuLink
              href="/terminal"
              onClick={() => setOpen(false)}
              label="open terminal"
              hint="ask & run"
            />
            <MenuLink
              href="/skills/mine"
              onClick={() => setOpen(false)}
              label="my custom skills"
              hint="create & share"
            />
            <MenuLink
              href="/account"
              onClick={() => setOpen(false)}
              label={walletLinked ? "wallet & tier" : "connect wallet"}
              hint={walletLinked ? "manage link" : "unlock paid"}
            />
            <MenuLink
              href="/token"
              onClick={() => setOpen(false)}
              label={`$${TOKEN.symbol}`}
              hint="utility & roadmap"
            />
            <button
              type="button"
              onClick={signOut}
              className="mt-1 flex items-center justify-between rounded px-2 py-1.5 text-left text-muted transition-colors hover:bg-surface-2 hover:text-red"
            >
              <span>→ sign out</span>
              <span className="text-[10px] uppercase tracking-widest text-muted-2">
                end session
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function UsageRow({
  label,
  used,
  limit,
  pct: percent,
}: {
  label: string;
  used: number;
  limit: number;
  pct: number;
}) {
  const fillClass =
    percent >= 90
      ? "bg-red"
      : percent >= 70
        ? "bg-amber"
        : "bg-accent";
  return (
    <div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted">{label}</span>
        <span className="font-mono text-foreground">
          {used} <span className="text-muted">/ {limit}</span>
        </span>
      </div>
      <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-surface-2">
        <div
          className={`h-full ${fillClass} transition-all`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function MenuLink({
  href,
  onClick,
  label,
  hint,
}: {
  href: string;
  onClick: () => void;
  label: string;
  hint: string;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center justify-between rounded px-2 py-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
    >
      <span>→ {label}</span>
      <span className="text-[10px] uppercase tracking-widest text-muted-2">
        {hint}
      </span>
    </Link>
  );
}
