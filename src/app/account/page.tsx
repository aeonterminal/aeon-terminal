import type { Metadata } from "next";

import { TOKEN } from "@/lib/token";

import { AccountClient } from "./account-client";

export const metadata: Metadata = {
  title: "Account · wallet",
  description:
    "Link your wallet to unlock holder-tier quota. Aeon Terminal checks your $aeonterminal balance on Base; hold the threshold and the paid quota turns on without a subscription.",
};

export default function AccountPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-12">
      <header className="mb-8 space-y-2">
        <p className="text-[11px] uppercase tracking-[0.3em] text-muted">
          $ aeon account --wallet
        </p>
        <h1 className="text-2xl tracking-tight text-foreground sm:text-3xl">
          Link a wallet, unlock{" "}
          <span className="text-accent glow-accent">holder tier.</span>
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          Connect any EVM wallet on Base. We&apos;ll check your{" "}
          <span className="text-foreground">${TOKEN.symbol}</span> balance and,
          if you hold the threshold, raise your daily quota to the paid tier —
          no Stripe required. Sell the position and your account rolls back to
          free the next time we refresh.
        </p>
      </header>

      <AccountClient />
    </div>
  );
}
