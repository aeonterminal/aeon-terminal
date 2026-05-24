export type SkillCategory =
  | "research"
  | "dev"
  | "crypto"
  | "social"
  | "productivity"
  | "meta";

export type Skill = {
  slug: string;
  name: string;
  category: SkillCategory;
  summary: string;
  cron?: string;
  inputs?: string[];
  outputs?: string[];
  selfHealing?: boolean;
  /**
   * True when the skill is in the catalog but not yet backed by a real
   * integration. Renders with a "Coming Soon" badge in /skills, and the
   * worker short-circuits run calls with an honest message.
   */
  comingSoon?: boolean;
  /**
   * Short description of what's needed before the skill can be enabled.
   * Only meaningful when `comingSoon: true`.
   */
  requires?: string;
};

export const CATEGORIES: Record<
  SkillCategory,
  { label: string; description: string; accent: string }
> = {
  research: {
    label: "Research & Content",
    description:
      "Digest the world: arxiv papers, RSS feeds, HN, and ad-hoc deep dives.",
    accent: "text-cyan",
  },
  dev: {
    label: "Dev & Code",
    description:
      "Pull live data from GitHub: repo stats, PR diffs, dep health, vuln advisories.",
    accent: "text-accent",
  },
  crypto: {
    label: "Crypto & Markets",
    description:
      "CoinGecko price movers, DefiLlama TVL deltas, treasury composition.",
    accent: "text-amber",
  },
  social: {
    label: "Social & Writing",
    description:
      "Threads, replies, campaigns, syndication. Mostly waiting on the X/Farcaster APIs.",
    accent: "text-pink",
  },
  productivity: {
    label: "Productivity",
    description:
      "Routines, recaps, goals, idea capture. Needs a personal data store, not shipped yet.",
    accent: "text-foreground",
  },
  meta: {
    label: "Meta / Agent",
    description:
      "Self-improvement: audit, repair, evolve. Needs the agent fleet, also not shipped yet.",
    accent: "text-muted",
  },
};

export const SKILLS: Skill[] = [
  // research
  {
    slug: "morning-brief",
    name: "morning-brief",
    category: "research",
    summary:
      "A focused briefing pulled from Hacker News + BBC RSS. Three minutes, grounded sources.",
    cron: "0 7 * * *",
    outputs: ["digest"],
  },
  {
    slug: "deep-research",
    name: "deep-research",
    category: "research",
    summary:
      "Multi-pass investigation of a topic with sourced claims and citations.",
    cron: "@manual",
    inputs: ["topic"],
    outputs: ["article", "summary"],
  },
  {
    slug: "paper-digest",
    name: "paper-digest",
    category: "research",
    summary: "Arxiv + Hugging Face papers, filtered to what matters this week.",
    cron: "0 8 * * 1",
  },
  {
    slug: "hacker-news-digest",
    name: "hacker-news-digest",
    category: "research",
    summary: "Top stories with takes, not just links. Three minute read.",
    cron: "0 6 * * *",
  },
  {
    slug: "rss-digest",
    name: "rss-digest",
    category: "research",
    summary: "Roll up any RSS feed into a single coherent thread.",
    cron: "@daily",
  },
  {
    slug: "technical-explainer",
    name: "technical-explainer",
    category: "research",
    summary: "Convert a paper or PR into a clean explainer you can publish.",
    cron: "@manual",
  },

  // dev
  {
    slug: "pr-review",
    name: "pr-review",
    category: "dev",
    summary:
      "Reviews PRs against project conventions. Leaves inline comments via gh.",
    cron: "*/15 * * * *",
    selfHealing: true,
  },
  {
    slug: "github-monitor",
    name: "github-monitor",
    category: "dev",
    summary:
      "Tracks issues, releases, stars, and trending across a watchlist of repos.",
    cron: "0 */2 * * *",
  },
  {
    slug: "auto-merge",
    name: "auto-merge",
    category: "dev",
    summary:
      "Watches the merge queue. Lands ready PRs that pass policy and CI.",
    cron: "*/5 * * * *",
    comingSoon: true,
    requires: "GitHub OAuth scope `repo` (write access)",
  },
  {
    slug: "code-health",
    name: "code-health",
    category: "dev",
    summary: "Lints repo health: stale deps, dead routes, untyped surfaces.",
    cron: "0 4 * * 1",
  },
  {
    slug: "vuln-scanner",
    name: "vuln-scanner",
    category: "dev",
    summary: "Audits dependencies and CI workflows for known vulnerabilities.",
    cron: "0 5 * * *",
  },
  {
    slug: "deploy-prototype",
    name: "deploy-prototype",
    category: "dev",
    summary:
      "Spins up a Vercel preview from a description. Returns the URL.",
    cron: "@manual",
    inputs: ["prompt"],
    comingSoon: true,
    requires: "Vercel API token",
  },
  {
    slug: "create-skill",
    name: "create-skill",
    category: "dev",
    summary:
      "Generates a new skill from a one-line description and registers it.",
    cron: "@manual",
    comingSoon: true,
    requires: "User-defined skill store (D1 + admin UI)",
  },

  // crypto
  {
    slug: "token-alert",
    name: "token-alert",
    category: "crypto",
    summary:
      "Watches a list of tokens; pings when momentum or unlocks shift.",
    cron: "*/10 * * * *",
  },
  {
    slug: "on-chain-monitor",
    name: "on-chain-monitor",
    category: "crypto",
    summary: "Watches wallets, contracts, and flows for material moves.",
    cron: "*/5 * * * *",
    comingSoon: true,
    requires: "Etherscan/Alchemy API key + watchlist",
  },
  {
    slug: "defi-monitor",
    name: "defi-monitor",
    category: "crypto",
    summary:
      "TVL, yields, exploits — a continuous read on the DeFi landscape.",
    cron: "0 * * * *",
  },
  {
    slug: "unlock-monitor",
    name: "unlock-monitor",
    category: "crypto",
    summary: "Flags token unlocks before they hit, with float context.",
    cron: "0 9 * * *",
    comingSoon: true,
    requires: "TokenUnlocks / Cryptorank API (paid tier)",
  },
  {
    slug: "treasury-info",
    name: "treasury-info",
    category: "crypto",
    summary: "Treasury snapshots for protocols and DAOs.",
    cron: "0 12 * * *",
  },

  // social
  {
    slug: "write-tweet",
    name: "write-tweet",
    category: "social",
    summary: "Drafts tweets in your voice. Threads when the idea deserves it.",
    cron: "@manual",
    comingSoon: true,
    requires: "X/Twitter API v2 + per-user OAuth",
  },
  {
    slug: "thread-formatter",
    name: "thread-formatter",
    category: "social",
    summary: "Turn long-form notes into a readable thread.",
    cron: "@manual",
    comingSoon: true,
    requires: "Style profile + draft store",
  },
  {
    slug: "reply-maker",
    name: "reply-maker",
    category: "social",
    summary:
      "Suggests replies to mentions and DMs. You approve before sending.",
    cron: "*/30 * * * *",
    comingSoon: true,
    requires: "X/Twitter API v2 + per-user OAuth",
  },
  {
    slug: "farcaster-digest",
    name: "farcaster-digest",
    category: "social",
    summary: "Pulls the day from the casts you actually care about.",
    cron: "0 18 * * *",
    comingSoon: true,
    requires: "Neynar / Farcaster Hub API + FID watchlist",
  },
  {
    slug: "syndicate-article",
    name: "syndicate-article",
    category: "social",
    summary: "Push a new post across Twitter, Farcaster, LinkedIn, blog.",
    cron: "@manual",
    comingSoon: true,
    requires: "Per-platform OAuth (X, Farcaster, LinkedIn)",
  },

  // productivity
  {
    slug: "daily-routine",
    name: "daily-routine",
    category: "productivity",
    summary:
      "Reminds you of your routine without being annoying about it.",
    cron: "0 7,12,18 * * *",
    comingSoon: true,
    requires: "User routine schema + push channel",
  },
  {
    slug: "evening-recap",
    name: "evening-recap",
    category: "productivity",
    summary: "What happened today, what shipped, what you owe people.",
    cron: "0 21 * * *",
    comingSoon: true,
    requires: "Activity ingestion (calendar, git, inbox)",
  },
  {
    slug: "goal-tracker",
    name: "goal-tracker",
    category: "productivity",
    summary: "Keeps your goals visible. Nudges when one slips for a week.",
    cron: "0 8 * * 1",
    comingSoon: true,
    requires: "Per-user goal store + cron nudges",
  },
  {
    slug: "weekly-review",
    name: "weekly-review",
    category: "productivity",
    summary: "Sunday review of the week: shipped, learned, dropped.",
    cron: "0 19 * * 0",
    comingSoon: true,
    requires: "Activity ingestion (calendar, git, inbox)",
  },
  {
    slug: "idea-capture",
    name: "idea-capture",
    category: "productivity",
    summary: "Sticky-notes voice notes and Telegram thoughts into memory/.",
    cron: "@reactive",
    comingSoon: true,
    requires: "Telegram / Discord ingestion bot",
  },

  // meta
  {
    slug: "heartbeat",
    name: "heartbeat",
    category: "meta",
    summary:
      "A signal-of-life ping so you know agents are alive and the wiring works.",
    cron: "0 * * * *",
    comingSoon: true,
    requires: "Agent fleet metrics pipeline",
  },
  {
    slug: "skill-repair",
    name: "skill-repair",
    category: "meta",
    summary:
      "When a skill fails, opens an issue, patches the file, and tests the fix.",
    cron: "@reactive",
    selfHealing: true,
    comingSoon: true,
    requires: "Skill repo write access + CI hook",
  },
  {
    slug: "skill-evals",
    name: "skill-evals",
    category: "meta",
    summary:
      "Scores each skill's output quality. Flags drift before you do.",
    cron: "0 3 * * *",
    comingSoon: true,
    requires: "Eval harness + judge model wiring",
  },
  {
    slug: "self-improve",
    name: "self-improve",
    category: "meta",
    summary: "Identifies the lowest-leverage skill and proposes a replacement.",
    cron: "0 4 * * 0",
    comingSoon: true,
    requires: "Skill usage telemetry + proposal pipeline",
  },
  {
    slug: "skill-health",
    name: "skill-health",
    category: "meta",
    summary: "Pass/fail rates, anomalies, recent failures across the fleet.",
    cron: "0 */6 * * *",
    comingSoon: true,
    requires: "Run-result store + anomaly detector",
  },
  {
    slug: "fleet-state",
    name: "fleet-state",
    category: "meta",
    summary: "What other Aeon instances are doing right now.",
    cron: "0 12 * * *",
    comingSoon: true,
    requires: "Federated fleet registry",
  },
];

export const SKILL_COUNT_BY_CATEGORY = SKILLS.reduce<
  Record<SkillCategory, number>
>(
  (acc, s) => {
    acc[s.category] = (acc[s.category] ?? 0) + 1;
    return acc;
  },
  {
    research: 0,
    dev: 0,
    crypto: 0,
    social: 0,
    productivity: 0,
    meta: 0,
  },
);
