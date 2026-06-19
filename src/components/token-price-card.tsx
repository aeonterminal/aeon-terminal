// Hidden until token launches. The live price+marketcap card used to
// poll Dexscreener for $aeonterminal every 60s; until launch we render
// a "launch coming soon" placeholder instead.
export function TokenPriceCard() {
  return (
    <div className="rounded border border-border bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2 text-[11px] text-muted">
        <span>
          <span className="text-muted-2">$</span> aeon token --price
        </span>
        <span className="inline-flex items-center gap-2 text-muted-2">
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent shadow-[0_0_8px_var(--accent)]"
          />
          launch coming soon
        </span>
      </div>
      <div className="px-4 py-8 text-center">
        <p className="text-[10px] uppercase tracking-widest text-muted-2">
          $ aeon token --status
        </p>
        <p className="mt-2 text-lg text-accent">launch coming soon</p>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Price, market cap, and volume go live the moment the contract
          deploys on Solana. Until then this card sits dark on purpose.
        </p>
      </div>
    </div>
  );
}
