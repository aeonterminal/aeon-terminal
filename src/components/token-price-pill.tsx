// Hidden until token launches. The live price chip used to ping
// Dexscreener every 60s; until launch we render a static
// "launch coming soon" pill instead.
export function TokenPricePill() {
  return (
    <span
      className="inline-flex w-fit items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-[11px] text-accent"
      aria-label="$aeonterminal launch coming soon"
    >
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent shadow-[0_0_8px_var(--accent)]"
      />
      <span className="text-muted-2">$</span>
      <span>aeonterminal</span>
      <span className="text-muted-2">·</span>
      <span>launch coming soon</span>
    </span>
  );
}
