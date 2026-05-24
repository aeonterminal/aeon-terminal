"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

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

type LoadState =
  | { kind: "loading" }
  | { kind: "anon" }
  | { kind: "ok"; tier: TierInfo }
  | { kind: "err"; message: string };

// Browser-injected EIP-1193 provider. Each wallet (MetaMask, Rabby, Coinbase
// Wallet, etc.) attaches `window.ethereum`. We avoid any wallet SDK so the
// dependency footprint stays at zero.
type Eip1193Provider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
};

function getEthereum(): Eip1193Provider | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { ethereum?: Eip1193Provider };
  return w.ethereum ?? null;
}

// 18 decimals; just trim and floor for the display strip. We don't need
// formatting fidelity beyond "this is roughly how many tokens you hold".
function formatTokenAmount(wei: string, decimals = 18): string {
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
  const [busy, setBusy] = useState<
    null | "connect" | "refresh" | "disconnect" | "checkout" | "portal"
  >(null);
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
    const ethereum = getEthereum();
    if (!ethereum) {
      setFlash({
        kind: "err",
        message:
          "no wallet detected — install MetaMask, Rabby, or Coinbase Wallet and refresh.",
      });
      return;
    }
    if (busy) return;
    setBusy("connect");
    setFlash(null);
    try {
      const accounts = (await ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];
      const address = accounts && accounts[0];
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

      const signature = (await ethereum.request({
        method: "personal_sign",
        params: [message, address],
      })) as string;

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
      // user-cancellation surfaces as a noisy provider error; soften it
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

      <section className="rounded border border-border bg-surface/80 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] uppercase tracking-[0.3em] text-muted">
            $ wallet --status
          </p>
          <p className="text-[11px] text-muted-2">
            chain:{" "}
            <span className="text-foreground">{TOKEN.chain} · 8453</span>
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
                href={`https://basescan.org/address/${wallet.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="self-start rounded border border-border px-2.5 py-1 text-[11px] text-muted hover:border-accent hover:text-accent"
              >
                basescan ↗
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
              <a
                href={TOKEN.buyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto rounded border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs text-accent hover:bg-accent/20"
              >
                buy ${TOKEN.symbol} ↗
              </a>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-foreground">
              No wallet linked yet. Connect an EVM wallet on{" "}
              <span className="text-foreground">Base</span> and we&apos;ll
              check your{" "}
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
                in your wallet (MetaMask / Rabby / Coinbase / etc.).
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
              <a
                href={TOKEN.buyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded border border-border px-3 py-2 text-xs text-muted hover:border-border-strong hover:text-foreground"
              >
                buy ${TOKEN.symbol} ↗
              </a>
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
            call <code className="text-foreground">balanceOf(you)</code> on
            Base. No transactions, no approvals, no token movements.
          </li>
          <li>
            <span className="text-foreground">Signature only.</span> Linking is
            a single off-chain personal_sign — same flow MetaMask uses for
            &ldquo;Sign in with Ethereum&rdquo;. Zero gas.
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
