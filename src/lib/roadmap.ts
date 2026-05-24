export type MilestoneStatus = "shipped" | "wip" | "planned" | "horizon";

export interface Milestone {
  label: string;
  detail: string;
}

export interface RoadmapPhase {
  slug: string;
  quarter: string;
  title: string;
  status: MilestoneStatus;
  items: readonly Milestone[];
}

export const ROADMAP: readonly RoadmapPhase[] = [
  {
    slug: "q1-2026",
    quarter: "Q1 · 2026",
    title: "foundation",
    status: "shipped",
    items: [
      {
        label: "multi-tenant auth",
        detail: "google oauth + github oauth + email magic link via resend",
      },
      {
        label: "per-user memory",
        detail: "d1 sqlite · last 8 asks + 5 runs · resumes next session",
      },
      {
        label: "per-user daily quota",
        detail: "30 asks + 10 skill runs · free tier · no surprise bills",
      },
      {
        label: "13 real skills",
        detail: "rss · github api · npm registry · osv.dev · coingecko · defillama",
      },
      {
        label: "$aeonterminal token launch",
        detail: "ca live on base via virtuals · banner + footer + /token page",
      },
      {
        label: "custom skill creator",
        detail:
          "build your own claude persona · name it, run it, share it · free 3 / holder 25",
      },
      {
        label: "hold to unlock paid quota",
        detail:
          "wallet connect + on-chain balance check on base · holders skip the subscription · 200 asks + 50 runs/day",
      },
    ],
  },
  {
    slug: "q2-2026",
    quarter: "Q2 · 2026",
    title: "billing + scheduling",
    status: "wip",
    items: [
      {
        label: "stripe billing",
        detail: "paid plan · checkout + portal · alternative to wallet-tier",
      },
      {
        label: "scheduled skill runs",
        detail: "cloudflare cron triggers · per-skill schedule from the catalog",
      },
      {
        label: "rate limit transparency",
        detail: "live usage badge in header · countdown to daily reset",
      },
    ],
  },
  {
    slug: "q3-2026",
    quarter: "Q3 · 2026",
    title: "fan-out + holder utility",
    status: "planned",
    items: [
      {
        label: "telegram / discord / slack fan-out",
        detail: "skill runs land in your channel of choice · per-skill routing",
      },
      {
        label: "telegram bot · /ask /run",
        detail: "use the terminal from chat · same memory · same quota",
      },
      {
        label: "github write-access skills",
        detail: "auto-merge · pr-write · gated to $aeonterminal holders",
      },
      {
        label: "holder skill catalog",
        detail: "advanced research + 32k context jobs · token-gated route guard",
      },
      {
        label: "prioritisation vote",
        detail: "holders pick which coming-soon skill ships next, by balance",
      },
    ],
  },
  {
    slug: "q4-2026",
    quarter: "Q4 · 2026",
    title: "fleet + buyback",
    status: "horizon",
    items: [
      {
        label: "agent fleet",
        detail: "skill-health · skill-evals · self-improve · skill-repair loops",
      },
      {
        label: "voice-matched output",
        detail: "soul/ directory · STYLE.md · per-user persona files",
      },
      {
        label: "revenue → buyback & burn",
        detail: "fixed % of paid-plan revenue routed to a public burn wallet",
      },
      {
        label: "on-chain memory anchoring",
        detail: "merkle-root run logs anchored to base · receipts portable",
      },
      {
        label: "skill marketplace",
        detail: "user-defined skills · share by short url · usage royalties",
      },
    ],
  },
] as const;

export function statusLabel(s: MilestoneStatus): string {
  switch (s) {
    case "shipped":
      return "shipped";
    case "wip":
      return "in progress";
    case "planned":
      return "planned";
    case "horizon":
      return "horizon";
  }
}
