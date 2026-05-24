export const TOKEN = {
  symbol: "aeonterminal",
  address: "0xda3ffca86273037CdDCf71AAE2cDEa6aef313285",
  chain: "Base",
  launchpad: "Virtuals Protocol",
  buyUrl: "https://app.virtuals.io/virtuals/78419",
  scanUrl:
    "https://basescan.org/token/0xda3ffca86273037CdDCf71AAE2cDEa6aef313285",
  dexscreenerUrl:
    "https://dexscreener.com/base/0xda3ffca86273037CdDCf71AAE2cDEa6aef313285",
} as const;

export function shortAddress(addr: string, n = 6): string {
  if (addr.length <= 2 + n * 2) return addr;
  return `${addr.slice(0, 2 + n)}…${addr.slice(-n)}`;
}

export type UtilityStatus = "live" | "next" | "planned";

export interface TokenUtility {
  slug: string;
  title: string;
  summary: string;
  detail: string;
  status: UtilityStatus;
  blockedBy?: string;
}

export const UTILITIES: readonly TokenUtility[] = [
  {
    slug: "quota-unlock",
    title: "Hold to unlock paid quota",
    summary:
      "200 asks + 50 skill runs / day · 25 custom skills · free for $aeonterminal holders.",
    detail:
      "Link any EVM wallet on /account. We read your $aeonterminal balance on Base via a public RPC. Hold ≥ 100,000 tokens and the paid quota turns on instantly — no Stripe, no card, no waitlist. Sell, and on the next refresh (≤ 1h) the account rolls back to free.",
    status: "live",
  },
  {
    slug: "custom-skills",
    title: "Build your own skill",
    summary:
      "Name a Claude persona, run it from the terminal, share it as a link.",
    detail:
      "Custom skills are live for every signed-in user. Free accounts get 3 saved skills; $aeonterminal holders get 25. Higher-cost model templates ship next on the holder tier.",
    status: "live",
  },
  {
    slug: "live-status",
    title: "Live status & usage page",
    summary:
      "Public health probes, today's asks/runs counters, per-skill activity — refreshed every 30s.",
    detail:
      "/status hits the worker, D1, Base RPC, Dexscreener, and GitHub on every load and reports real latency + error states. Counters and skill activity come from the same tables the rest of the app writes to. No fudged numbers, no demo mode.",
    status: "live",
  },
  {
    slug: "holder-skills",
    title: "Holder-only skills",
    summary:
      "Premium catalog slots — write-access, alpha signals, multi-platform syndication — reserved for holders.",
    detail:
      "First 3 holder-only skills tagged in the catalog now: auto-merge (GitHub write access), unlock-monitor (token unlock signals), syndicate-article (cross-platform post). When each ships its real integration, holders run them free; non-holders hit a clear 'hold 100k $aeonterminal' gate at the worker. Gate is enforced server-side in handleExec, not just visual.",
    status: "live",
  },
  {
    slug: "skill-vote",
    title: "Prioritisation vote",
    summary:
      "Holders signal which coming-soon skill ships next, weighted by balance.",
    detail:
      "Snapshot-style off-chain vote each cycle. 21 skills are scaffolded but waiting on an integration — holders break the tie. Results published on /roadmap with the next ship date.",
    status: "planned",
    blockedBy: "Snapshot space + cycle automation",
  },
  {
    slug: "buyback-burn",
    title: "Revenue → buyback & burn",
    summary:
      "A fixed share of paid-plan revenue is used to buy $aeonterminal back and burn it.",
    detail:
      "Once Stripe billing is live, a transparent percentage of monthly net revenue is routed to a buyback wallet and burned. On-chain receipts published each cycle. Until then this remains 'planned' — no buybacks are running.",
    status: "planned",
    blockedBy: "Stripe billing live + revenue flowing",
  },
] as const;
