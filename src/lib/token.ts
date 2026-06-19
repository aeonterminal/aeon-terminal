export const TOKEN = {
  symbol: "aeonterminal",
  address: "", // SPL mint address — set once deployed on Solana
  chain: "Solana",
  launchpad: "Pump.fun",
  buyUrl: "https://pump.fun",
  scanUrl: "", // solscan URL — set once mint is live
  dexscreenerUrl: "", // dexscreener URL — set once mint is live
} as const;

export function shortAddress(addr: string, n = 4): string {
  if (addr.length <= n * 2 + 2) return addr;
  return `${addr.slice(0, n)}…${addr.slice(-n)}`;
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
      "Link any Solana wallet on /account. We read your $aeonterminal SPL token balance via a public RPC. Hold ≥ 100,000 tokens and the paid quota turns on instantly — no Stripe, no card, no waitlist. Sell, and on the next refresh (≤ 1h) the account rolls back to free.",
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
      "/status hits the worker, D1, Solana RPC, Dexscreener, and GitHub on every load and reports real latency + error states. Counters and skill activity come from the same tables the rest of the app writes to. No fudged numbers, no demo mode.",
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
    slug: "scheduled-runs",
    title: "Scheduled skill runs",
    summary:
      "Wire a skill to a cron — daily morning brief, hourly monitor, weekly digest. Output lands in memory.",
    detail:
      "Cloudflare Cron Triggers fire the worker every 15 min. The scheduled() handler picks up due rows from user_schedules and runs each through the same path /api/exec uses — same model, same tools, same memory. Paid + holder tier gets 3 schedules each. Free tier sees the section disabled with a clear 'hold to unlock' hint. Hourly / every6h / daily@H / weekly@DOW@H presets are exposed in /account; output stashes into per-skill memory so the next interactive run sees what the cron produced.",
    status: "live",
  },
  {
    slug: "stripe-billing",
    title: "Paid plan via Stripe",
    summary:
      "Card checkout + customer portal — alternative paid path for non-holders. Same quota as the holder unlock.",
    detail:
      "Stripe Checkout + Customer Portal wired into /account. Real webhook listener updates plan state from Stripe events (no polling). Holders still get paid quota free via the wallet path — Stripe is the card-payment alternative. Live when STRIPE_SECRET_KEY + STRIPE_PRICE_ID + STRIPE_WEBHOOK_SECRET land in the Worker config; the route paths return 503 stripe_not_configured until then.",
    status: "next",
    blockedBy: "Stripe account + price id + webhook secret",
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
