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
    slug: "custom-skills",
    title: "Build your own skill",
    summary:
      "Name a Claude persona, run it from the terminal, share it as a link.",
    detail:
      "Custom skills are live for every signed-in user (3 per account on the free tier). Once wallet-connect ships, $aeonterminal holders get a higher cap (25+) and access to skill templates that require higher-cost models.",
    status: "live",
    blockedBy: "Wallet-connect for holder cap unlock — Q2",
  },
  {
    slug: "quota-unlock",
    title: "Hold to unlock paid quota",
    summary: "200 asks + 50 skill runs / day, free for $aeonterminal holders.",
    detail:
      "Connect your wallet on the billing page. If you hold the threshold balance on Base, paid-tier limits are unlocked without a Stripe subscription. Sell, and the account rolls back to the free tier on the next UTC day.",
    status: "next",
    blockedBy: "Stripe billing + on-chain balance check",
  },
  {
    slug: "holder-skills",
    title: "Holder-only skills",
    summary:
      "Advanced research, write-access GitHub flows, and longer context windows.",
    detail:
      "Higher-cost skills — multi-step deep research, GitHub PR write-access (auto-merge, pr-comment), 32k context jobs — gated to holders. The catalog will label these explicitly on each card.",
    status: "planned",
    blockedBy: "Token-gated route guard + write OAuth scope",
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
