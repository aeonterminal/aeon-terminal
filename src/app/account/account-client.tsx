"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { SKILLS } from "@/lib/skills";
import { TOKEN, shortAddress } from "@/lib/token";

type Wallet = {
  address: string;
  chain_id: number;
  balance_wei: string;
  balance_at: number;
  verified_at: number;
  tier: "free" | "paid";
};

type TierInfo = {
  tier: "free" | "paid";
  plan: "free" | "paid";
  source: "plan" | "holder";
  wallet: Wallet | null;
  threshold_wei?: string;
};

type MeResponse = {
  user: { id: string; email: string | null; name: string | null } | null;
  tier: TierInfo | null;
};

type Subscription = {
  status: string;
  plan: "free" | "paid";
  current_period_end: number | null;
  cancel_at_period_end: boolean;
  has_payment_method: boolean;
};

type BillingMe = {
  configured: boolean;
  subscription: Subscription | null;
};

type Schedule = {
  id: string;
  skill: string;
  prompt: string;
  cron: string;
  cron_label: string;
  enabled: boolean;
  next_run_at: number;
  last_run_at: number | null;
  last_status: string | null;
  last_summary: string | null;
  created_at: number;
  updated_at: number;
};

type SchedulesData = {
  schedules: Schedule[];
  limit: number;
  tier: "free" | "paid";
  tier_source: string;
  cron_tick_min: number;
};

type LoadState =
  | { kind: "loading" }
  | { kind: "anon" }
  | { kind: "ok"; tier: TierInfo }
  | { kind: "err"; message: string };

// Browser-injected Solana wallet provider. Phantom, Solflare, Backpack, etc.
// attach `window.solana` (or `window.phantom?.solana`). We avoid any wallet SDK
// so the dependency footprint stays at zero.
type SolanaProvider = {
  isPhantom?: boolean;
  connect(): Promise<{ publicKey: { toBytes(): Uint8Array; toString(): string } }>;
  signMessage(message: Uint8Array, encoding: string): Promise<{ signature: Uint8Array }>;
  disconnect(): Promise<void>;
  publicKey: { toBytes(): Uint8Array; toString(): string } | null;
};

function getSolana(): SolanaProvider | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    solana?: SolanaProvider;
    phantom?: { solana?: SolanaProvider };
  };
  return w.phantom?.solana ?? w.solana ?? null;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// SPL tokens typically use 9 decimals. Just trim and floor for the display
// strip. We don't need formatting fidelity beyond "this is roughly how many
// tokens you hold".
function formatTokenAmount(wei: string, decimals = 9): string {
  let s = wei;
  if (!/^-?\d+$/.test(s)) return "0";
  const negative = s.startsWith("-");
  if (negative) s = s.slice(1);
  if (s.length <= decimals) s = s.padStart(decimals + 1, "0");
  const whole = s.slice(0, s.length - decimals);
  const frac = s.slice(s.length - decimals, s.length - decimals + 4);
  const trimmedFrac = frac.replace(/0+$/, "");
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (negative ? "-" : "") + withCommas + (trimmedFrac ? "." + trimmedFrac : "");
}

function formatRelative(ts: number): string {
  if (!ts) return "never";
  const delta = Math.max(0, Math.floor(Date.now() / 1000) - ts);
  if (delta < 60) return `${delta}s ago`;
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`;
  return `${Math.floor(delta / 86400)}d ago`;
}

export function AccountClient() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [billing, setBilling] = useState<BillingMe | null>(null);
  const [schedules, setSchedules] = useState<SchedulesData | null>(null);
  const [busy, setBusy] = useState<
    null | "connect" | "refresh" | "disconnect" | "checkout" | "portal"
  >(null);
  // Schedule operations have their own busy slot keyed by id (or "create")
  // so a slow toggle on one row doesn't lock the entire page out.
  const [scheduleBusy, setScheduleBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<{
    kind: "ok" | "err";
    message: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      // Pull the post-checkout banner out of the URL first so the flash sets
      // before the slower /api/me fetch resolves. Strip the query so a
      // refresh doesn't keep re-flashing.
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const billingParam = params.get("billing");
        if (billingParam === "success") {
          if (!cancelled) {
            setFlash({
              kind: "ok",
              message: "checkout complete — plan updates within a few seconds.",
            });
          }
          const u = new URL(window.location.href);
          u.searchParams.delete("billing");
          u.searchParams.delete("session_id");
          window.history.replaceState({}, "", u.toString());
        } else if (billingParam === "cancel") {
          if (!cancelled) {
            setFlash({ kind: "err", message: "checkout cancelled." });
          }
          const u = new URL(window.location.href);
          u.searchParams.delete("billing");
          window.history.replaceState({}, "", u.toString());
        }
      }
      try {
        const res = await fetch("/api/me", { credentials: "include" });
        if (cancelled) return;
        if (!res.ok) {
          setState({ kind: "err", message: `HTTP ${res.status}` });
          return;
        }
        const data = (await res.json()) as MeResponse;
        if (cancelled) return;
        if (!data.user) {
          setState({ kind: "anon" });
          return;
        }
        if (!data.tier) {
          setState({
            kind: "ok",
            tier: {
              tier: "free",
              plan: "free",
              source: "plan",
              wallet: null,
            },
          });
        } else {
          setState({ kind: "ok", tier: data.tier });
        }
        // Billing state is independent; ignore failures so the page still
        // works when Stripe isn't configured.
        const bRes = await fetch("/api/billing/me", { credentials: "include" });
        if (cancelled) return;
        if (bRes.ok) {
          setBilling((await bRes.json()) as BillingMe);
        }
        // Schedules state is independent too; failures fall through silently
        // so the page still renders.
        const sRes = await fetch("/api/schedules", { credentials: "include" });
        if (cancelled) return;
        if (sRes.ok) {
          setSchedules((await sRes.json()) as SchedulesData);
        }
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setState({ kind: "err", message: msg });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const upgradeCheckout = useCallback(async () => {
    if (busy) return;
    setBusy("checkout");
    setFlash(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ success_path: "/account", cancel_path: "/account" }),
      });
      const j = (await res.json()) as { url?: string; error?: string; message?: string };
      if (!res.ok || !j.url) {
        throw new Error(j.message || j.error || `checkout_failed_${res.status}`);
      }
      window.location.href = j.url;
    } catch (err) {
      setFlash({
        kind: "err",
        message: err instanceof Error ? err.message : String(err),
      });
      setBusy(null);
    }
  }, [busy]);

  const refreshSchedules = useCallback(async () => {
    const res = await fetch("/api/schedules", { credentials: "include" });
    if (res.ok) {
      setSchedules((await res.json()) as SchedulesData);
    }
  }, []);

  const createSchedule = useCallback(
    async (input: {
      skill: string;
      cron: string;
      prompt: string;
    }): Promise<boolean> => {
      if (scheduleBusy) return false;
      setScheduleBusy("create");
      setFlash(null);
      try {
        const res = await fetch("/api/schedules", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        });
        const j = (await res.json()) as {
          error?: string;
          message?: string;
        };
        if (!res.ok) {
          throw new Error(j.message || j.error || `schedule_create_${res.status}`);
        }
        setFlash({ kind: "ok", message: "schedule saved." });
        await refreshSchedules();
        return true;
      } catch (err) {
        setFlash({
          kind: "err",
          message: err instanceof Error ? err.message : String(err),
        });
        return false;
      } finally {
        setScheduleBusy(null);
      }
    },
    [scheduleBusy, refreshSchedules],
  );

  const toggleSchedule = useCallback(
    async (id: string, enabled: boolean) => {
      if (scheduleBusy) return;
      setScheduleBusy(id);
      setFlash(null);
      try {
        const res = await fetch(`/api/schedules/${id}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ enabled }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as {
            error?: string;
            message?: string;
          };
          throw new Error(j.message || j.error || `schedule_patch_${res.status}`);
        }
        await refreshSchedules();
      } catch (err) {
        setFlash({
          kind: "err",
          message: err instanceof Error ? err.message : String(err),
        });
      } finally {
        setScheduleBusy(null);
      }
    },
    [scheduleBusy, refreshSchedules],
  );

  const deleteSchedule = useCallback(
    async (id: string) => {
      if (scheduleBusy) return;
      setScheduleBusy(id);
      setFlash(null);
      try {
        const res = await fetch(`/api/schedules/${id}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as {
            error?: string;
            message?: string;
          };
          throw new Error(j.message || j.error || `schedule_delete_${res.status}`);
        }
        await refreshSchedules();
      } catch (err) {
        setFlash({
          kind: "err",
          message: err instanceof Error ? err.message : String(err),
        });
      } finally {
        setScheduleBusy(null);
      }
    },
    [scheduleBusy, refreshSchedules],
  );

  const openPortal = useCallback(async () => {
    if (busy) return;
    setBusy("portal");
    setFlash(null);
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ return_path: "/account" }),
      });
      const j = (await res.json()) as { url?: string; error?: string; message?: string };
      if (!res.ok || !j.url) {
        throw new Error(j.message || j.error || `portal_failed_${res.status}`);
      }
      window.location.href = j.url;
    } catch (err) {
      setFlash({
        kind: "err",
        message: err instanceof Error ? err.message : String(err),
      });
      setBusy(null);
    }
  }, [busy]);

  const connect = useCallback(async () => {
    const solana = getSolana();
    if (!solana) {
      setFlash({
        kind: "err",
        message:
          "no Solana wallet detected — install Phantom, Solflare, or Backpack and refresh.",
      });
      return;
    }
    if (busy) return;
    setBusy("connect");
    setFlash(null);
    try {
      const resp = await solana.connect();
      const address = resp.publicKey.toString();
      if (!address) throw new Error("no account selected in your wallet");

      const nonceRes = await fetch("/api/wallet/nonce", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address }),
      });
      if (!nonceRes.ok) {
        const j = await nonceRes.json().catch(() => ({ error: "nonce_failed" }));
        throw new Error(j.error || "nonce_failed");
      }
      const { nonce, issued_at, message } = (await nonceRes.json()) as {
        nonce: string;
        issued_at: string;
        message: string;
      };
      if (!message) throw new Error("missing message");

      const encodedMessage = new TextEncoder().encode(message);
      const { signature: sigBytes } = await solana.signMessage(
        encodedMessage,
        "utf8",
      );
      const signature = bytesToBase64(sigBytes);

      const verifyRes = await fetch("/api/wallet/verify", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address, signature, nonce, issued_at }),
      });
      const verifyJson = (await verifyRes.json()) as
        | { ok: true; tier: TierInfo; transferred?: boolean }
        | { error: string; message?: string };
      if (!verifyRes.ok || !("ok" in verifyJson)) {
        const errMsg = "error" in verifyJson ? verifyJson.error : "verify_failed";
        throw new Error(errMsg);
      }
      const transferNote = verifyJson.transferred
        ? " (transferred from another aeon.terminal account)"
        : "";
      setFlash({
        kind: "ok",
        message:
          verifyJson.tier.wallet?.tier === "paid"
            ? `wallet linked · holder tier unlocked.${transferNote}`
            : `wallet linked · balance below holder threshold (still free tier).${transferNote}`,
      });
      setState({ kind: "ok", tier: verifyJson.tier });
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      const msg = /reject|denied|cancel|user/i.test(raw)
        ? "sign-in cancelled in your wallet."
        : raw;
      setFlash({ kind: "err", message: msg });
    } finally {
      setBusy(null);
    }
  }, [busy]);

  const refresh = useCallback(async () => {
    if (busy) return;
    setBusy("refresh");
    setFlash(null);
    try {
      const res = await fetch("/api/wallet/refresh", {
        method: "POST",
        credentials: "include",
      });
      const json = (await res.json()) as
        | { ok: true; tier: TierInfo }
        | { error: string };
      if (!res.ok || !("ok" in json)) {
        const errMsg = "error" in json ? json.error : "refresh_failed";
        throw new Error(errMsg);
      }
      setState({ kind: "ok", tier: json.tier });
      setFlash({ kind: "ok", message: "balance refreshed." });
    } catch (err) {
      setFlash({
        kind: "err",
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(null);
    }
  }, [busy]);

  const disconnect = useCallback(async () => {
    if (busy) return;
    if (typeof window !== "undefined") {
      const ok = window.confirm(
        "Unlink wallet? Your account will roll back to the free tier until you connect again.",
      );
      if (!ok) return;
    }
    setBusy("disconnect");
    setFlash(null);
    try {
      const res = await fetch("/api/wallet/me", {
        method: "DELETE",
        credentials: "include",
      });
      const json = (await res.json()) as
        | { ok: true; tier: TierInfo }
        | { error: string };
      if (!res.ok || !("ok" in json)) throw new Error("disconnect_failed");
      setState({ kind: "ok", tier: json.tier });
      setFlash({ kind: "ok", message: "wallet unlinked." });
    } catch (err) {
      setFlash({
        kind: "err",
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(null);
    }
  }, [busy]);

  if (state.kind === "loading") {
    return (
      <div className="rounded border border-border bg-surface/80 px-5 py-6 text-sm text-muted">
        loading…
      </div>
    );
  }

  if (state.kind === "anon") {
    return (
      <div className="space-y-3 rounded border border-border bg-surface/80 px-5 py-6">
        <p className="text-sm text-foreground">
          $ aeon account — sign in first.
        </p>
        <p className="text-xs leading-relaxed text-muted">
          A wallet links to your aeon.terminal account, so you need to be
          signed in before connecting.
        </p>
        <Link
          href={`/login?redirect=${encodeURIComponent("/account")}`}
          className="inline-flex items-center gap-2 rounded border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs text-accent hover:bg-accent/20"
        >
          → sign in
        </Link>
      </div>
    );
  }

  if (state.kind === "err") {
    return (
      <div className="rounded border border-red/40 bg-red/10 px-5 py-6 text-sm text-red">
        {state.message}
      </div>
    );
  }

  const { tier } = state;
  const wallet = tier.wallet;
  const isHolder = tier.tier === "paid" && tier.source === "holder";
  const balanceFormatted = wallet
    ? formatTokenAmount(wallet.balance_wei)
    : "0";
  const thresholdFormatted = tier.threshold_wei
    ? formatTokenAmount(tier.threshold_wei)
    : "100,000";

  return (
    <div className="space-y-6">
      {flash ? (
        <div
          className={`rounded border px-4 py-2 text-xs ${
            flash.kind === "ok"
              ? "border-accent-2/40 bg-accent-2/10 text-accent-2"
              : "border-red/40 bg-red/10 text-red"
          }`}
          role="status"
        >
          {flash.message}
        </div>
      ) : null}

      <section className="rounded border border-border bg-surface/80 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-muted">
              effective tier
            </p>
            <p className="mt-1 text-2xl text-foreground">
              {isHolder ? (
                <span className="text-accent-2 glow-accent-2">$ holder</span>
              ) : tier.tier === "paid" ? (
                <span className="text-accent glow-accent">$ paid</span>
              ) : (
                <span className="text-muted">$ free</span>
              )}
            </p>
            <p className="mt-1 text-[11px] text-muted-2">
              source: <span className="text-foreground">{tier.source}</span> ·
              plan: <span className="text-foreground">{tier.plan}</span>
            </p>
          </div>
          <div className="text-right text-[11px] leading-relaxed text-muted">
            <div>
              asks · runs ·
              <br />
              {tier.tier === "paid" ? (
                <span className="text-foreground">200 / 50 per day</span>
              ) : (
                <span className="text-foreground">30 / 10 per day</span>
              )}
            </div>
            <div className="mt-1">
              custom skills ·{" "}
              <span className="text-foreground">
                {tier.tier === "paid" ? 25 : 3} max
              </span>
            </div>
          </div>
        </div>
      </section>

      <SubscriptionSection
        billing={billing}
        tier={tier}
        busy={busy}
        onCheckout={upgradeCheckout}
        onPortal={openPortal}
      />

      <SchedulesSection
        data={schedules}
        tier={tier}
        scheduleBusy={scheduleBusy}
        onCreate={createSchedule}
        onToggle={toggleSchedule}
        onDelete={deleteSchedule}
      />

      <section className="rounded border border-border bg-surface/80 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] uppercase tracking-[0.3em] text-muted">
            $ wallet --status
          </p>
          <p className="text-[11px] text-muted-2">
            chain:{" "}
            <span className="text-foreground">{TOKEN.chain} · mainnet-beta</span>
          </p>
        </div>

        {wallet ? (
          <div className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-widest text-muted-2">
                  address
                </p>
                <p className="mt-1 break-all font-mono text-sm text-foreground">
                  {wallet.address}
                </p>
                <p className="mt-1 text-[11px] text-muted">
                  short: {shortAddress(wallet.address, 6)} · linked{" "}
                  {formatRelative(wallet.verified_at)}
                </p>
              </div>
              <a
                href={`https://solscan.io/account/${wallet.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="self-start rounded border border-border px-2.5 py-1 text-[11px] text-muted hover:border-accent hover:text-accent"
              >
                solscan ↗
              </a>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded border border-border bg-surface px-4 py-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-2">
                  ${TOKEN.symbol} balance
                </p>
                <p className="mt-1 font-mono text-lg text-foreground">
                  {balanceFormatted}
                </p>
                <p className="mt-1 text-[11px] text-muted">
                  refreshed {formatRelative(wallet.balance_at)} · cache 1h
                </p>
              </div>
              <div
                className={`rounded border px-4 py-3 ${
                  isHolder
                    ? "border-accent-2/40 bg-accent-2/10"
                    : "border-border bg-surface"
                }`}
              >
                <p className="text-[10px] uppercase tracking-widest text-muted-2">
                  holder threshold
                </p>
                <p className="mt-1 font-mono text-lg text-foreground">
                  {thresholdFormatted}
                </p>
                <p
                  className={`mt-1 text-[11px] ${
                    isHolder ? "text-accent-2" : "text-muted"
                  }`}
                >
                  {isHolder
                    ? "≥ threshold · paid quota unlocked"
                    : "< threshold · still on free quota"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={refresh}
                disabled={busy !== null}
                className="rounded border border-border px-3 py-1.5 text-xs text-muted hover:border-accent hover:text-accent disabled:opacity-50"
              >
                {busy === "refresh" ? "refreshing…" : "refresh balance"}
              </button>
              <button
                type="button"
                onClick={connect}
                disabled={busy !== null}
                className="rounded border border-border px-3 py-1.5 text-xs text-muted hover:border-accent hover:text-accent disabled:opacity-50"
              >
                {busy === "connect" ? "signing…" : "relink wallet"}
              </button>
              <button
                type="button"
                onClick={disconnect}
                disabled={busy !== null}
                className="rounded border border-border px-3 py-1.5 text-xs text-muted hover:border-red hover:text-red disabled:opacity-50"
              >
                {busy === "disconnect" ? "unlinking…" : "unlink"}
              </button>
              <span
                className="ml-auto rounded border border-border bg-surface px-3 py-1.5 text-xs text-muted"
                title="$aeonterminal launch coming soon"
              >
                buy · launch coming soon
              </span>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-foreground">
              No wallet linked yet. Connect a Solana wallet and
              we&apos;ll check your{" "}
              <span className="text-foreground">${TOKEN.symbol}</span>{" "}
              balance.
            </p>
            <ol className="space-y-1 text-xs leading-relaxed text-muted">
              <li>
                <span className="text-muted-2">1.</span> Click{" "}
                <span className="text-foreground">connect wallet</span> below.
              </li>
              <li>
                <span className="text-muted-2">2.</span> Approve the connection
                in your wallet (Phantom / Solflare / Backpack / etc.).
              </li>
              <li>
                <span className="text-muted-2">3.</span> Sign a one-time
                message to prove ownership. No gas, no on-chain transaction.
              </li>
              <li>
                <span className="text-muted-2">4.</span> If your balance is ≥{" "}
                <span className="text-foreground">
                  {thresholdFormatted} ${TOKEN.symbol}
                </span>
                , holder tier turns on instantly.
              </li>
            </ol>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={connect}
                disabled={busy !== null}
                className="rounded border border-accent bg-accent/10 px-4 py-2 text-sm text-accent hover:bg-accent/20 disabled:opacity-50"
              >
                {busy === "connect" ? "signing…" : "→ connect wallet"}
              </button>
              <span
                className="rounded border border-border px-3 py-2 text-xs text-muted"
                title="$aeonterminal launch coming soon"
              >
                buy · launch coming soon
              </span>
            </div>
          </div>
        )}
      </section>

      <section className="rounded border border-border bg-surface/40 p-5 text-xs leading-relaxed text-muted sm:p-6">
        <p className="text-[11px] uppercase tracking-[0.3em] text-muted-2">
          $ aeon account --explain
        </p>
        <ul className="mt-3 space-y-2">
          <li>
            <span className="text-foreground">Read-only.</span> We only ever
            read your SPL token balance on Solana. No transactions, no
            approvals, no token movements.
          </li>
          <li>
            <span className="text-foreground">Signature only.</span> Linking is
            a single off-chain signMessage — same flow Phantom uses for
            &ldquo;Sign In With Solana&rdquo;. Zero gas.
          </li>
          <li>
            <span className="text-foreground">Tier follows balance.</span>{" "}
            Balance is re-checked at most every hour, or whenever you click
            &ldquo;refresh balance&rdquo;. Sell, and the next refresh rolls
            you back to free.
          </li>
          <li>
            <span className="text-foreground">One wallet, one account.</span>{" "}
            Each aeon.terminal account links at most one wallet, and each
            wallet links to at most one account at a time. Linking a wallet
            that&apos;s already on another account transfers the link to this
            one — holder quota can&apos;t be multiplied across accounts.
            Unlink anytime to detach.
          </li>
        </ul>
      </section>
    </div>
  );
}

function formatPeriodEnd(ts: number | null): string {
  if (!ts) return "—";
  try {
    return new Date(ts * 1000).toISOString().slice(0, 10);
  } catch {
    return "—";
  }
}

function subscriptionLabel(status: string): { text: string; tone: "ok" | "warn" | "off" } {
  switch (status) {
    case "active":
    case "trialing":
      return { text: status, tone: "ok" };
    case "past_due":
      return { text: "past due", tone: "warn" };
    case "unpaid":
    case "incomplete":
    case "incomplete_expired":
      return { text: status.replace("_", " "), tone: "warn" };
    case "canceled":
    case "paused":
      return { text: status, tone: "off" };
    default:
      return { text: status || "unknown", tone: "off" };
  }
}

type SubscriptionSectionProps = {
  billing: BillingMe | null;
  tier: TierInfo;
  busy: null | "connect" | "refresh" | "disconnect" | "checkout" | "portal";
  onCheckout: () => void;
  onPortal: () => void;
};

function SubscriptionSection({
  billing,
  tier,
  busy,
  onCheckout,
  onPortal,
}: SubscriptionSectionProps) {
  // Three modes: configured-no-sub (show upgrade button), configured-with-sub
  // (show details + portal), and not-configured (honest 'wiring pending').
  const sub = billing?.subscription ?? null;
  const isActive = !!sub && (sub.status === "active" || sub.status === "trialing");
  const isHolder = tier.tier === "paid" && tier.source === "holder";

  return (
    <section className="rounded border border-border bg-surface/80 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] uppercase tracking-[0.3em] text-muted">
          $ subscription --status
        </p>
        <p className="text-[11px] text-muted-2">
          billing via{" "}
          <a
            href="https://stripe.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground hover:text-accent"
          >
            stripe
          </a>
        </p>
      </div>

      {billing && billing.configured && isActive && sub ? (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded border border-accent/40 bg-accent/10 px-4 py-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-2">
                plan
              </p>
              <p className="mt-1 font-mono text-lg text-accent">
                $ paid
              </p>
              <p className="mt-1 text-[11px] text-muted">
                200 asks · 50 runs · 25 custom skills per day
              </p>
            </div>
            <div className="rounded border border-border bg-surface px-4 py-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-2">
                next renewal
              </p>
              <p className="mt-1 font-mono text-lg text-foreground">
                {formatPeriodEnd(sub.current_period_end)}
              </p>
              <p className="mt-1 text-[11px] text-muted">
                status:{" "}
                <span className="text-foreground">
                  {subscriptionLabel(sub.status).text}
                </span>
                {sub.cancel_at_period_end ? " · cancels at period end" : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={onPortal}
              disabled={busy !== null}
              className="rounded border border-accent bg-accent/10 px-4 py-2 text-sm text-accent hover:bg-accent/20 disabled:opacity-50"
            >
              {busy === "portal" ? "opening portal…" : "→ manage subscription"}
            </button>
            <p className="text-[11px] text-muted">
              cancel · change card · view invoices via Stripe Customer Portal
            </p>
          </div>
        </div>
      ) : billing && billing.configured ? (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-foreground">
            No active subscription. Pay by card to unlock paid quota — or hold
            ${TOKEN.symbol} to get the same quota free.
          </p>
          <ul className="space-y-1 text-xs leading-relaxed text-muted">
            <li>
              <span className="text-foreground">paid plan ·</span> 200 asks +
              50 skill runs per day · 25 custom skills · billed monthly
            </li>
            <li>
              <span className="text-foreground">holder unlock ·</span> same
              quota, free, no card · hold the holder threshold in ${TOKEN.symbol}
            </li>
            <li>
              <span className="text-foreground">cancel anytime ·</span> Stripe
              Customer Portal handles cancel + card update + invoices
            </li>
          </ul>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={onCheckout}
              disabled={busy !== null || isHolder}
              className="rounded border border-accent bg-accent/10 px-4 py-2 text-sm text-accent hover:bg-accent/20 disabled:opacity-50"
              title={isHolder ? "you already get paid quota via the holder unlock" : undefined}
            >
              {busy === "checkout" ? "opening checkout…" : "→ upgrade plan"}
            </button>
            {isHolder ? (
              <p className="text-[11px] text-accent-2">
                you already have paid quota via the holder unlock — no need to
                pay.
              </p>
            ) : (
              <p className="text-[11px] text-muted">
                opens stripe checkout · price shown there · no charge until
                confirmed
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-foreground">
            Card billing pending — Stripe keys haven&apos;t landed in the
            worker config yet.
          </p>
          <p className="text-xs leading-relaxed text-muted">
            Routes (<code className="text-foreground">/api/billing/checkout</code>,{" "}
            <code className="text-foreground">/api/billing/portal</code>,{" "}
            <code className="text-foreground">/api/billing/webhook</code>) are
            wired and return{" "}
            <code className="text-foreground">503 stripe_not_configured</code>{" "}
            until the secrets ship. Until then, holders get paid quota free via
            the wallet card below — no card needed.
          </p>
        </div>
      )}
    </section>
  );
}

// Catalog skill slugs that have a real backend wired up. Coming-soon skills
// would refuse to run at execute time, so we don't even let users pick them
// for a schedule.
const SCHEDULABLE_SKILLS: { slug: string; name: string }[] = SKILLS
  .filter((s) => !s.comingSoon)
  .map((s) => ({ slug: s.slug, name: s.name }));

// Hours-of-day options for the daily/weekly preset. UTC-only by design —
// users see "07:00 UTC" everywhere so timezone drift doesn't surprise them.
const HOURS_OF_DAY: number[] = Array.from({ length: 24 }, (_, i) => i);

const DAYS_OF_WEEK: { value: number; label: string }[] = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

type FreqKind = "daily" | "weekly" | "every6h" | "hourly";

function formatScheduleTimestamp(ts: number | null | undefined): string {
  if (!ts) return "—";
  try {
    // Compact UTC stamp: YYYY-MM-DD HH:mm. No locale shifting so the
    // "07:00 UTC" presets match what we display here.
    const d = new Date(ts * 1000);
    const date = d.toISOString().slice(0, 10);
    const time = d.toISOString().slice(11, 16);
    return `${date} ${time}`;
  } catch {
    return "—";
  }
}

type SchedulesSectionProps = {
  data: SchedulesData | null;
  tier: TierInfo;
  scheduleBusy: string | null;
  // Returns true on success so the form can clear the prompt only when the
  // create actually went through (network failures / quota errors keep the
  // user's typed prompt so they don't have to re-enter it).
  onCreate: (input: {
    skill: string;
    cron: string;
    prompt: string;
  }) => Promise<boolean>;
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (id: string) => void;
};

function SchedulesSection({
  data,
  tier,
  scheduleBusy,
  onCreate,
  onToggle,
  onDelete,
}: SchedulesSectionProps) {
  const [formSkill, setFormSkill] = useState<string>(
    SCHEDULABLE_SKILLS[0]?.slug ?? "morning-brief",
  );
  const [formFreq, setFormFreq] = useState<FreqKind>("daily");
  const [formHour, setFormHour] = useState<number>(7); // 07:00 UTC default
  const [formDow, setFormDow] = useState<number>(1); // Monday default
  const [formPrompt, setFormPrompt] = useState<string>("");

  const paid = tier.tier === "paid";
  const limit = data?.limit ?? 0;
  const schedules = data?.schedules ?? [];
  // Wait for the /api/schedules response before deciding we're at the limit
  // — otherwise the brief window between /api/me resolving (which flips the
  // user to paid) and /api/schedules resolving renders "At the 0-schedule
  // limit" instead of the create form.
  const atLimit = data !== null && paid && schedules.length >= limit;
  const tick = data?.cron_tick_min ?? 15;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    let cron: string;
    if (formFreq === "hourly") cron = "hourly";
    else if (formFreq === "every6h") cron = "every6h";
    else if (formFreq === "daily") cron = `daily@${formHour}`;
    else cron = `weekly@${formDow}@${formHour}`;
    // Only clear the prompt on success — keep the user's typed text on
    // network errors / 4xx so they don't have to re-enter it.
    const ok = await onCreate({
      skill: formSkill,
      cron,
      prompt: formPrompt.trim(),
    });
    if (ok) setFormPrompt("");
  };

  return (
    <section className="rounded border border-border bg-surface/80 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] uppercase tracking-[0.3em] text-muted">
          $ schedules --cron
        </p>
        <p className="text-[11px] text-muted-2">
          paid tier ·{" "}
          <span className="text-foreground">
            up to {limit || 3} schedules
          </span>{" "}
          · ticks every{" "}
          <span className="text-foreground">{tick}min</span>
        </p>
      </div>

      {!paid ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-foreground">
            Scheduled runs are a paid feature — your skills fire on a cron
            (e.g. `morning-brief` daily at 07:00 UTC) and stash output to
            memory.
          </p>
          <p className="text-xs leading-relaxed text-muted">
            Hold ${TOKEN.symbol} to unlock the same paid quota without a card,
            or upgrade above. Free tier disables this section to keep the worker
            cron quota predictable.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {schedules.length === 0 ? (
            <p className="text-xs text-muted">
              No schedules yet — pick a skill below to wire your first cron.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded border border-border bg-surface">
              {schedules.map((s) => {
                const rowBusy = scheduleBusy === s.id;
                return (
                  <li
                    key={s.id}
                    className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <code className="text-sm text-foreground">
                          {s.skill}
                        </code>
                        <span
                          className={`rounded border px-1.5 py-0.5 text-[10px] uppercase ${
                            s.enabled
                              ? "border-accent-2/40 text-accent-2"
                              : "border-border text-muted"
                          }`}
                        >
                          {s.enabled ? "enabled" : "paused"}
                        </span>
                        <span className="text-[11px] text-muted-2">
                          {s.cron_label}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-muted">
                        next:{" "}
                        <span className="text-foreground">
                          {formatScheduleTimestamp(s.next_run_at)}
                        </span>
                        {s.last_run_at ? (
                          <>
                            {" · "}
                            last:{" "}
                            <span className="text-foreground">
                              {formatScheduleTimestamp(s.last_run_at)}
                            </span>{" "}
                            (
                            <span
                              className={
                                s.last_status === "ok"
                                  ? "text-accent-2"
                                  : "text-red"
                              }
                            >
                              {s.last_status || "?"}
                            </span>
                            )
                          </>
                        ) : null}
                      </p>
                      {s.last_summary ? (
                        <p className="mt-1 line-clamp-2 text-[11px] text-muted-2">
                          ↳ {s.last_summary}
                        </p>
                      ) : null}
                      {s.prompt ? (
                        <p className="mt-1 text-[11px] text-muted-2">
                          prompt:{" "}
                          <code className="text-foreground">{s.prompt}</code>
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onToggle(s.id, !s.enabled)}
                        disabled={scheduleBusy !== null}
                        className="rounded border border-border px-2.5 py-1 text-[11px] text-muted hover:border-accent hover:text-accent disabled:opacity-50"
                      >
                        {rowBusy
                          ? "…"
                          : s.enabled
                          ? "→ pause"
                          : "→ enable"}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(s.id)}
                        disabled={scheduleBusy !== null}
                        className="rounded border border-border px-2.5 py-1 text-[11px] text-muted hover:border-red hover:text-red disabled:opacity-50"
                      >
                        delete
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {atLimit ? (
            <p className="text-[11px] text-muted">
              At the {limit}-schedule limit. Pause or delete one to add another.
            </p>
          ) : (
            <form
              onSubmit={submit}
              className="space-y-3 rounded border border-border bg-surface px-3 py-3"
            >
              <p className="text-[11px] uppercase tracking-widest text-muted-2">
                + schedule a skill
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[11px] text-muted">skill</span>
                  <select
                    value={formSkill}
                    onChange={(e) => setFormSkill(e.target.value)}
                    className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                  >
                    {SCHEDULABLE_SKILLS.map((s) => (
                      <option key={s.slug} value={s.slug}>
                        {s.slug}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[11px] text-muted">frequency</span>
                  <select
                    value={formFreq}
                    onChange={(e) =>
                      setFormFreq(e.target.value as FreqKind)
                    }
                    className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                  >
                    <option value="hourly">hourly (top of each hour)</option>
                    <option value="every6h">every 6 hours</option>
                    <option value="daily">daily at HH:00 UTC</option>
                    <option value="weekly">weekly · DOW @ HH:00 UTC</option>
                  </select>
                </label>
                {formFreq === "daily" || formFreq === "weekly" ? (
                  <label className="block">
                    <span className="text-[11px] text-muted">hour (UTC)</span>
                    <select
                      value={formHour}
                      onChange={(e) => setFormHour(parseInt(e.target.value, 10))}
                      className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                    >
                      {HOURS_OF_DAY.map((h) => (
                        <option key={h} value={h}>
                          {String(h).padStart(2, "0")}:00
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {formFreq === "weekly" ? (
                  <label className="block">
                    <span className="text-[11px] text-muted">day of week</span>
                    <select
                      value={formDow}
                      onChange={(e) => setFormDow(parseInt(e.target.value, 10))}
                      className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                    >
                      {DAYS_OF_WEEK.map((d) => (
                        <option key={d.value} value={d.value}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
              <label className="block">
                <span className="text-[11px] text-muted">
                  prompt (optional · sent to skill at run time)
                </span>
                <input
                  type="text"
                  value={formPrompt}
                  onChange={(e) => setFormPrompt(e.target.value)}
                  placeholder="leave blank to use the skill's default"
                  maxLength={500}
                  className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground placeholder:text-muted-2"
                />
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="submit"
                  disabled={scheduleBusy !== null}
                  className="rounded border border-accent bg-accent/10 px-3 py-1.5 text-sm text-accent hover:bg-accent/20 disabled:opacity-50"
                >
                  {scheduleBusy === "create" ? "saving…" : "→ save schedule"}
                </button>
                <p className="text-[11px] text-muted">
                  runs in the background · output stored in memory for `run`
                </p>
              </div>
            </form>
          )}

          <p className="text-[11px] leading-relaxed text-muted-2">
            How it works: a Cloudflare Cron Trigger fires every {tick} minutes.
            The worker queries due schedules and executes them via the same
            path <code>$ aeon run</code> uses. Output is appended to your
            per-skill memory so the next interactive run sees what the cron
            produced. Pausing keeps the row; deleting removes it.
          </p>
        </div>
      )}
    </section>
  );
}
