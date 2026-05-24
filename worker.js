// Aeon Terminal Cloudflare Worker.
//
// Routes:
//   POST   /api/exec     — proxy to Anthropic Claude (with tool use), streams SSE back.
//   GET    /api/memory   — return the current session's memory (turns + runs).
//   DELETE /api/memory   — wipe the current session's memory.
//   *                    — delegated to the static asset binding (out/).
//
// Per-session memory uses the optional AEON_MEMORY KV binding. If the binding
// is missing, the Worker degrades to stateless mode (each request fresh).

import { secp256k1 } from "@noble/curves/secp256k1.js";
import { keccak_256 } from "@noble/hashes/sha3.js";

// Skill registry. Keys are the slugs the terminal sends in `skill` field.
// Each entry has either a real `persona` (instructs Claude how to use the
// fetch_url / read_rss tools to produce real output) or `comingSoon: true`
// (handleExec short-circuits with an honest "not yet available" response).
const SKILL_REGISTRY = {
  // --- research (all real, RSS + fetch-driven) ---

  "morning-brief": {
    name: "morning-brief",
    summary:
      "A focused, voice-matched briefing of the world before you open your laptop.",
    persona:
      "Produce a 6-8 bullet morning briefing: 2 tech, 2 markets, 1 culture, 1 inbox-style nudge. Use the read_rss tool on https://hnrss.org/frontpage and https://feeds.bbci.co.uk/news/world/rss.xml to pull real headlines, then synthesize. Each bullet one line, cite the source domain at the end of the line.",
  },
  "deep-research": {
    name: "deep-research",
    summary:
      "Multi-pass investigation of a topic with sourced claims and citations.",
    persona:
      "If the user prompt contains a URL, fetch_url it first. Then either fetch_url the top relevant result or rely on knowledge. Output: one-line topic restatement, 3 numbered findings each with a citation (URL + source domain), and one open question. Do not invent URLs — only cite domains you fetched or know exist.",
  },
  "paper-digest": {
    name: "paper-digest",
    summary: "Arxiv + Hugging Face papers, filtered to what matters this week.",
    persona:
      "Call read_rss on http://export.arxiv.org/rss/cs.AI to get the latest AI papers. Pick the 3 most interesting, output title + real arxiv link + one-line takeaway each. End with 'Skim queue: <n> · Read queue: 3' where <n> is the remaining items.",
  },
  "hacker-news-digest": {
    name: "hacker-news-digest",
    summary: "Top stories with takes, not just links. Three minute read.",
    persona:
      "Call read_rss on https://hnrss.org/frontpage?count=15 to pull real HN headlines. Pick 4 top stories, list each with a snarky-but-useful one-line take and the real URL. End with 'Skipped: <n> low-signal' where <n> is items dropped.",
  },
  "rss-digest": {
    name: "rss-digest",
    summary: "Roll up any RSS feed into a single coherent thread.",
    persona:
      "Expect a feed URL in the prompt. Call read_rss on it. Synthesize the latest 5 items into one 4-line narrative paragraph that cites at least 2 item titles verbatim. If no URL given, default to https://hnrss.org/frontpage and say so.",
  },
  "technical-explainer": {
    name: "technical-explainer",
    summary: "Convert a paper or PR into a clean explainer you can publish.",
    persona:
      "If a URL is provided, fetch_url it. Output: one-line hook, three 'what changed' lines, one 'why it matters' line, ending with a citation line 'source: <domain>'. If no URL, ask the user to provide one in a single short sentence.",
  },

  // --- dev ---

  "pr-review": {
    name: "pr-review",
    summary:
      "Reviews PRs against project conventions. Leaves inline comments via gh.",
    persona:
      "Expect a GitHub PR URL in the prompt (format: https://github.com/<owner>/<repo>/pull/<n>). Steps: 1) fetch_url https://api.github.com/repos/<owner>/<repo>/pulls/<n> to get PR metadata (title, author, base/head, additions/deletions). 2) fetch_url https://patch-diff.githubusercontent.com/raw/<owner>/<repo>/pull/<n>.diff to get the actual code diff. 3) Review the diff. Output header 'PR #<n> · <owner>/<repo> · +<additions>/-<deletions>'. Then 3-5 inline comments formatted as 'path/to/file.ext:<line>  <observation>'. End with one of: 'Verdict: LGTM', 'Verdict: LGTM with nits', or 'Verdict: Block — <one-line reason>'. If no PR URL in the prompt, reply with one line asking the user to paste one.",
  },
  "github-monitor": {
    name: "github-monitor",
    summary:
      "Tracks issues, releases, stars, and trending across a watchlist of repos.",
    persona:
      "Expect one or more GitHub repos in the prompt (format: <owner>/<repo> or full URL). For each repo, fetch_url https://api.github.com/repos/<owner>/<repo> for stars/forks/open_issues, then fetch_url https://api.github.com/repos/<owner>/<repo>/releases/latest for the latest release tag. Output one line per repo: '<owner>/<repo> · <stars>★ · <open_issues> issues · latest: <tag> (<published_at slice 0,10>)'. If no repo provided, ask the user for one in a single short line.",
  },
  "auto-merge": {
    name: "auto-merge",
    summary: "Watches the merge queue. Lands ready PRs that pass policy and CI.",
    comingSoon: true,
    requires: "GitHub OAuth scope `repo` (write access) — not yet wired.",
  },
  "code-health": {
    name: "code-health",
    summary: "Lints repo health: stale deps, dead routes, untyped surfaces.",
    persona:
      "Expect a GitHub repo in the prompt (format: <owner>/<repo>). Steps: 1) fetch_url https://api.github.com/repos/<owner>/<repo>/contents/package.json to read package.json (the response is a JSON object with a base64-encoded `content` field — decode the dependencies and devDependencies maps). 2) For each of up to 6 production deps, fetch_url https://registry.npmjs.org/<pkg>/latest to get the latest version. 3) Compare with the version pinned in package.json. Output header 'code-health · <owner>/<repo>'. Then up to 6 lines like '<pkg>  pinned <a> → latest <b>  <stale?>' where stale is 'stale' if minor/major behind, else 'ok'. End with one-line suggestion. If no repo or no package.json, say so in one line.",
  },
  "vuln-scanner": {
    name: "vuln-scanner",
    summary: "Audits dependencies and CI workflows for known vulnerabilities.",
    persona:
      "Expect either an npm package name or a GitHub repo in the prompt. If a package name: fetch_url https://api.osv.dev/v1/query with body {\"package\":{\"name\":\"<pkg>\",\"ecosystem\":\"npm\"}} (note: OSV requires POST — instead use GET fetch_url to https://api.osv.dev/v1/vulns?package=<pkg>&ecosystem=npm to look up known IDs). If a GitHub repo: fetch_url https://api.github.com/repos/<owner>/<repo>/vulnerability-alerts (returns 204 if alerts on, 404 if not — note: this requires repo admin perms; if it fails, fall back to package.json scanning). Output header 'vuln-scan · <target>'. List up to 4 advisories: 'GHSA/CVE id · severity · summary'. End with 'Reviewed <n> deps · <high> high · <mod> moderate'. If OSV/GH return nothing, say 'no known advisories found' honestly.",
  },
  "deploy-prototype": {
    name: "deploy-prototype",
    summary: "Spins up a Vercel preview from a description. Returns the URL.",
    comingSoon: true,
    requires: "Vercel API token — not yet wired.",
  },
  "create-skill": {
    name: "create-skill",
    summary:
      "Generates a new skill from a one-line description and registers it.",
    comingSoon: true,
    requires:
      "Skill-creation UI + D1 schema for user-defined skills — not yet wired.",
  },

  // --- crypto ---

  "token-alert": {
    name: "token-alert",
    summary: "Watches a list of tokens; pings when momentum or unlocks shift.",
    persona:
      "Call fetch_url on https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=12&page=1&price_change_percentage=24h to get real prices. Pick the 4 movers with the largest absolute 24h % change. Output one line per mover formatted as '<symbol upper> <signed pct>%  vol/mcap=<turnover>x  $<price formatted>'. End with one one-line read (one sentence, no hedging).",
  },
  "on-chain-monitor": {
    name: "on-chain-monitor",
    summary: "Watches wallets, contracts, and flows for material moves.",
    comingSoon: true,
    requires:
      "Etherscan / Alchemy API key + wallet watchlist — not yet wired.",
  },
  "defi-monitor": {
    name: "defi-monitor",
    summary:
      "TVL, yields, exploits — a continuous read on the DeFi landscape.",
    persona:
      "Call fetch_url on https://api.llama.fi/protocols to get real DeFi TVL. From the response, pick the 3 protocols with the largest absolute change1d (1-day TVL change). Output one line per protocol formatted as '<name>  TVL $<tvl in B/M>  <signed 1d %>%  cat: <category>'. End with one risk/opportunity read (one sentence, grounded in the data).",
  },
  "unlock-monitor": {
    name: "unlock-monitor",
    summary: "Flags token unlocks before they hit, with float context.",
    comingSoon: true,
    requires: "TokenUnlocks/Cryptorank API (paid tier) — not yet wired.",
  },
  "treasury-info": {
    name: "treasury-info",
    summary: "DAO treasury composition and burn-rate, plus recent movements.",
    persona:
      "Expect a protocol slug in the prompt (e.g., 'uniswap', 'lido', 'arbitrum'). Call fetch_url on https://api.llama.fi/treasury/<slug>. From the response, summarize total treasury value and the top 3 token holdings by USD value. Output header 'treasury · <protocol> · $<total formatted>'. Then 3 lines '<token>  $<value formatted>  <pct>% of treasury'. End with a one-line composition note. If the slug returns 404, suggest 2-3 slugs the user can try.",
  },

  // --- social (all coming soon — no public API for posting without user OAuth) ---

  "write-tweet": {
    name: "write-tweet",
    summary: "Drafts tweets in your voice. Threads when the idea deserves it.",
    comingSoon: true,
    requires: "X/Twitter API v2 + per-user OAuth — not yet wired.",
  },
  "thread-formatter": {
    name: "thread-formatter",
    summary: "Turn long-form notes into a readable thread.",
    comingSoon: true,
    requires: "Style profile + draft store — not yet wired.",
  },
  "reply-maker": {
    name: "reply-maker",
    summary:
      "Suggests replies to mentions and DMs. You approve before sending.",
    comingSoon: true,
    requires: "X/Twitter API v2 + per-user OAuth — not yet wired.",
  },
  "farcaster-digest": {
    name: "farcaster-digest",
    summary: "Pulls the day from the casts you actually care about.",
    comingSoon: true,
    requires: "Neynar/Farcaster Hub API key + FID watchlist — not yet wired.",
  },
  "syndicate-article": {
    name: "syndicate-article",
    summary: "Push a new post across Twitter, Farcaster, LinkedIn, blog.",
    comingSoon: true,
    requires: "Per-platform OAuth (X, Farcaster, LinkedIn) — not yet wired.",
  },

  // --- productivity (all coming soon — need user data integration) ---

  "daily-routine": {
    name: "daily-routine",
    summary:
      "Reminds you of your routine without being annoying about it.",
    comingSoon: true,
    requires: "User routine schema + push channel — not yet wired.",
  },
  "evening-recap": {
    name: "evening-recap",
    summary: "What happened today, what shipped, what you owe people.",
    comingSoon: true,
    requires:
      "Activity ingestion (calendar, git, inbox) — not yet wired.",
  },
  "goal-tracker": {
    name: "goal-tracker",
    summary: "Keeps your goals visible. Nudges when one slips for a week.",
    comingSoon: true,
    requires: "Per-user goal store + cron nudges — not yet wired.",
  },
  "weekly-review": {
    name: "weekly-review",
    summary: "Sunday review of the week: shipped, learned, dropped.",
    comingSoon: true,
    requires:
      "Activity ingestion (calendar, git, inbox) — not yet wired.",
  },
  "idea-capture": {
    name: "idea-capture",
    summary: "Sticky-notes voice notes and Telegram thoughts into memory/.",
    comingSoon: true,
    requires: "Telegram/Discord ingestion bot — not yet wired.",
  },

  // --- meta (all coming soon — agent fleet infra not yet built) ---

  heartbeat: {
    name: "heartbeat",
    summary:
      "A signal-of-life ping so you know agents are alive and the wiring works.",
    comingSoon: true,
    requires: "Agent fleet metrics pipeline — not yet wired.",
  },
  "skill-repair": {
    name: "skill-repair",
    summary:
      "When a skill fails, opens an issue, patches the file, and tests the fix.",
    comingSoon: true,
    requires: "Skill repo write access + CI hook — not yet wired.",
  },
  "skill-evals": {
    name: "skill-evals",
    summary:
      "Scores each skill's output quality. Flags drift before you do.",
    comingSoon: true,
    requires: "Eval harness + judge model wiring — not yet wired.",
  },
  "self-improve": {
    name: "self-improve",
    summary: "Identifies the lowest-leverage skill and proposes a replacement.",
    comingSoon: true,
    requires: "Skill usage telemetry + proposal pipeline — not yet wired.",
  },
  "skill-health": {
    name: "skill-health",
    summary: "Pass/fail rates, anomalies, recent failures across the fleet.",
    comingSoon: true,
    requires: "Run-result store + anomaly detector — not yet wired.",
  },
  "fleet-state": {
    name: "fleet-state",
    summary: "What other Aeon instances are doing right now.",
    comingSoon: true,
    requires: "Federated fleet registry — not yet wired.",
  },
};

const SYSTEM_BASE = `You are running inside Aeon Terminal — a terminal-first
control surface for autonomous AI agents. Your output is rendered in a
monospace web terminal panel.

You have two real tools:
- fetch_url(url): Fetch any http/https URL and return up to ~15KB of body text.
  For api.github.com requests the worker automatically attaches its
  GITHUB_API_TOKEN, so authenticated rate limits apply.
- read_rss(url, limit?): Read an RSS or Atom feed; returns latest items
  with title, link, date, summary.

When real data exists, USE THE TOOLS. Do not fabricate when you can fetch.
Cite the URL or source domain you actually used. Never invent URLs, repo
names, tickers, prices, CVE ids, or any other concrete identifier — if the
tool call fails or returns nothing useful, say so in one line and stop.

Style rules (strict):
- Plain text only. No markdown headers (# or ##). No emoji.
- No chatty preamble. Get straight to output.
- Lines under ~90 chars. Total output under 22 lines.
- Use ASCII markers when natural: ✓ ✗ · » →
- If a fetch fails, say so briefly and continue with what you have.
- Do not refuse, do not add disclaimers, do not mention you are an AI.`;

function buildSystem(skillSlug, mode, customSkill) {
  if (mode === "run" && customSkill) {
    return `${SYSTEM_BASE}\n\nYou are the '${customSkill.name}' skill (a user-defined skill, created via the Aeon Terminal skill builder).\nPurpose: ${customSkill.summary}\nFormat: ${customSkill.persona}`;
  }
  const skill = skillSlug ? SKILL_REGISTRY[skillSlug] : null;
  if (mode === "run" && skill) {
    return `${SYSTEM_BASE}\n\nYou are the '${skill.name}' skill.\nPurpose: ${skill.summary}\nFormat: ${skill.persona}`;
  }
  return `${SYSTEM_BASE}\n\nThe user is exploring the Aeon Terminal demo through a free-form prompt. Respond like a terse, in-terminal assistant — informative, no fluff.`;
}

const TOOLS_SPEC = [
  {
    name: "fetch_url",
    description:
      "Fetch the contents of an HTTP(S) URL and return the response body (HTML stripped, truncated to ~15KB). Use this for live web content, articles, JSON APIs, search results. The worker auto-attaches GITHUB_API_TOKEN for api.github.com calls.",
    input_schema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The URL to fetch. Must be http or https.",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "read_rss",
    description:
      "Read an RSS or Atom feed and return the latest items: title, link, date, summary. Use this for blogs, news sites, podcast feeds.",
    input_schema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The RSS or Atom feed URL.",
        },
        limit: {
          type: "number",
          description: "Max items to return (default 8, max 15).",
        },
      },
      required: ["url"],
    },
  },
];

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, GET, DELETE, OPTIONS",
  "access-control-allow-headers": "content-type, x-session-id",
};

// Per-plan quotas (asks + skill runs per UTC day). Anonymous users fall back
// to the legacy IP-based rate limit.
const PLAN_LIMITS = {
  free: { asks: 30, runs: 10 },
  paid: { asks: 200, runs: 50 },
};

const SESSION_COOKIE = "aeon_session";
const SESSION_TTL_DAYS = 30;
const OAUTH_STATE_TTL_SECONDS = 600;
const AUTH_REDIRECT_AFTER_LOGIN = "/terminal";

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...CORS,
      ...(init.headers ?? {}),
    },
  });
}

// Stream a single SSE payload (text + done) to the client. Used for honest
// "coming soon" replies and other server-known short responses that should
// render in the existing terminal stream without touching Claude.
function streamOneShotSse(text) {
  const encoder = new TextEncoder();
  const lines = [
    `data: ${JSON.stringify({ type: "text", delta: text })}\n\n`,
    `data: ${JSON.stringify({ type: "done", remaining: null })}\n\n`,
  ];
  const stream = new ReadableStream({
    start(controller) {
      for (const line of lines) controller.enqueue(encoder.encode(line));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: {
      ...CORS,
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
    },
  });
}

async function checkRateLimit(ip) {
  if (!ip) return { ok: true, remaining: 30 };
  const cache = caches.default;
  const key = new Request(`https://ratelimit.aeon-terminal/${ip}`);
  const stored = await cache.match(key);
  let count = 0;
  if (stored) count = Number(await stored.text()) || 0;
  if (count >= 30) return { ok: false, remaining: 0 };
  await cache.put(
    key,
    new Response(String(count + 1), {
      headers: { "cache-control": "max-age=86400" },
    }),
  );
  return { ok: true, remaining: 30 - (count + 1) };
}

// --- tools ---

function isUnsafeUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return true;
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host === "0.0.0.0") return true;
    if (/^127\./.test(host)) return true;
    if (/^10\./.test(host)) return true;
    if (/^192\.168\./.test(host)) return true;
    if (/^169\.254\./.test(host)) return true;
    if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)) return true;
    return false;
  } catch {
    return true;
  }
}

function stripHtml(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

const FETCH_MAX_BYTES = 15000;

function buildToolFetchHeaders(url, env) {
  const headers = {
    "user-agent": "AeonTerminal/0.1 (+https://aeonterminal.org)",
  };
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host === "api.github.com") {
      headers.accept = "application/vnd.github+json";
      headers["x-github-api-version"] = "2022-11-28";
      if (env?.GITHUB_API_TOKEN) {
        headers.authorization = `Bearer ${env.GITHUB_API_TOKEN}`;
      }
    } else if (
      host === "githubusercontent.com" ||
      host.endsWith(".githubusercontent.com")
    ) {
      if (env?.GITHUB_API_TOKEN) {
        headers.authorization = `Bearer ${env.GITHUB_API_TOKEN}`;
      }
    }
  } catch {
    // ignore — URL parsing already handled upstream
  }
  return headers;
}

async function toolFetchUrl(input, env) {
  const url = String(input?.url ?? "").trim();
  if (!url) return { content: "error: missing url", isError: true, summary: "no url" };
  if (isUnsafeUrl(url))
    return { content: "blocked: invalid or private URL", isError: true, summary: "blocked" };

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 8000);
  try {
    const res = await fetch(url, {
      signal: ac.signal,
      redirect: "follow",
      headers: buildToolFetchHeaders(url, env),
    });
    clearTimeout(timer);
    const ct = (res.headers.get("content-type") ?? "").toLowerCase();
    let body = await res.text();
    const originalLen = body.length;
    if (ct.includes("text/html") || /<html/i.test(body.slice(0, 200))) {
      body = stripHtml(body);
    }
    const truncated = body.slice(0, FETCH_MAX_BYTES);
    return {
      content: `${res.status} ${res.statusText} · ${(originalLen / 1024).toFixed(1)}KB raw\n\n${truncated}`,
      summary: `${(originalLen / 1024).toFixed(1)}KB · ${res.status}`,
      isError: !res.ok,
    };
  } catch (err) {
    clearTimeout(timer);
    const msg = err && err.message ? err.message : String(err);
    return { content: `fetch error: ${msg}`, isError: true, summary: `failed: ${msg.slice(0, 40)}` };
  }
}

function extractTag(xml, tag) {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = xml.match(re);
  if (!m) return "";
  let s = m[1];
  const cdata = s.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  if (cdata) s = cdata[1];
  return stripHtml(s);
}

function extractAttr(xml, tag, attr) {
  const re = new RegExp(`<${tag}[^>]*\\s${attr}="([^"]*)"`, "i");
  const m = xml.match(re);
  return m ? m[1] : "";
}

function parseEntry(xml, kind) {
  const title = extractTag(xml, "title");
  const summary =
    extractTag(xml, "description") ||
    extractTag(xml, "summary") ||
    extractTag(xml, "content");
  let link = "";
  if (kind === "rss") link = extractTag(xml, "link");
  if (!link) link = extractAttr(xml, "link", "href");
  const date =
    extractTag(xml, "pubDate") ||
    extractTag(xml, "published") ||
    extractTag(xml, "updated");
  return { title, link, date, summary };
}

function parseFeed(xml) {
  const items = [];
  const itemRe = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = itemRe.exec(xml))) items.push(parseEntry(m[1], "rss"));
  if (items.length === 0) {
    const entryRe = /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi;
    while ((m = entryRe.exec(xml))) items.push(parseEntry(m[1], "atom"));
  }
  return items;
}

async function toolReadRss(input) {
  const url = String(input?.url ?? "").trim();
  const limit = Math.min(Math.max(Number(input?.limit ?? 8) || 8, 1), 15);
  if (!url) return { content: "error: missing url", isError: true, summary: "no url" };
  if (isUnsafeUrl(url))
    return { content: "blocked: invalid or private URL", isError: true, summary: "blocked" };

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 8000);
  try {
    const res = await fetch(url, {
      signal: ac.signal,
      redirect: "follow",
      headers: { "user-agent": "AeonTerminal/0.1 (+https://aeonterminal.org)" },
    });
    clearTimeout(timer);
    if (!res.ok)
      return {
        content: `feed error: ${res.status} ${res.statusText}`,
        isError: true,
        summary: `feed ${res.status}`,
      };
    const xml = await res.text();
    const items = parseFeed(xml).slice(0, limit);
    if (items.length === 0)
      return { content: "no items found in feed", isError: false, summary: "0 items" };
    const formatted = items
      .map(
        (it, i) =>
          `${i + 1}. ${it.title}\n   url: ${it.link}\n   date: ${it.date}\n   ${(it.summary || "").slice(0, 220)}`,
      )
      .join("\n\n");
    return {
      content: formatted,
      summary: `${items.length} items`,
      isError: false,
    };
  } catch (err) {
    clearTimeout(timer);
    const msg = err && err.message ? err.message : String(err);
    return { content: `feed error: ${msg}`, isError: true, summary: `failed: ${msg.slice(0, 40)}` };
  }
}

async function runTool(name, input, env) {
  if (name === "fetch_url") return toolFetchUrl(input, env);
  if (name === "read_rss") return toolReadRss(input);
  return { content: `unknown tool: ${name}`, isError: true, summary: "unknown tool" };
}

// --- streaming ---

async function callAnthropic(env, system, messages) {
  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 2048,
      system,
      tools: TOOLS_SPEC,
      stream: true,
      messages,
    }),
  });
}

// Parses one streaming Anthropic response. Calls onTextDelta(text) for every
// text chunk, and returns { stopReason, contentBlocks } at end of stream.
async function parseStream(response, onTextDelta) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const blocks = [];
  const toolBuf = {};
  let stopReason = null;
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const raw of lines) {
      const line = raw.trim();
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      let evt;
      try {
        evt = JSON.parse(payload);
      } catch {
        continue;
      }

      if (evt.type === "content_block_start") {
        const cb = evt.content_block;
        if (cb.type === "text") {
          blocks[evt.index] = { type: "text", text: "" };
        } else if (cb.type === "tool_use") {
          blocks[evt.index] = {
            type: "tool_use",
            id: cb.id,
            name: cb.name,
            input: {},
          };
          toolBuf[evt.index] = "";
        }
      } else if (evt.type === "content_block_delta") {
        const idx = evt.index;
        if (evt.delta.type === "text_delta" && blocks[idx]?.type === "text") {
          blocks[idx].text += evt.delta.text;
          if (evt.delta.text) await onTextDelta(evt.delta.text);
        } else if (evt.delta.type === "input_json_delta") {
          toolBuf[idx] = (toolBuf[idx] ?? "") + evt.delta.partial_json;
        }
      } else if (evt.type === "content_block_stop") {
        const idx = evt.index;
        if (blocks[idx]?.type === "tool_use") {
          try {
            blocks[idx].input = JSON.parse(toolBuf[idx] || "{}");
          } catch {
            blocks[idx].input = {};
          }
        }
      } else if (evt.type === "message_delta") {
        if (evt.delta?.stop_reason) stopReason = evt.delta.stop_reason;
      } else if (evt.type === "message_stop") {
        return { stopReason, contentBlocks: blocks.filter(Boolean) };
      }
    }
  }
  return { stopReason, contentBlocks: blocks.filter(Boolean) };
}

async function handleExec(request, env) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, { status: 405 });
  }
  if (!env.ANTHROPIC_API_KEY) {
    return json({ error: "not_configured" }, { status: 503 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad_json" }, { status: 400 });
  }

  const mode = body.mode === "run" ? "run" : "ask";
  const skill = typeof body.skill === "string" ? body.skill : null;
  const skillId = typeof body.skillId === "string" ? body.skillId : null;
  const prompt = String(body.prompt ?? "").slice(0, 2000).trim();
  if (!prompt) return json({ error: "empty_prompt" }, { status: 400 });

  // Resolve user identity early so we can look up user-owned custom skills.
  const user = await currentUser(request, env);

  // Resolve the skill: catalog first, then custom (by id, then by slug for owner).
  let customSkill = null;
  let effectiveSkillKey = skill;
  if (mode === "run") {
    if (skillId) {
      if (!hasDb(env)) {
        return json({ error: "db_not_configured" }, { status: 503 });
      }
      await ensureSchema(env);
      customSkill = await dbGetUserSkillById(env, skillId);
      if (!customSkill) {
        return json({ error: "unknown_skill" }, { status: 404 });
      }
      if (customSkill.visibility !== "public" && customSkill.user_id !== user?.id) {
        return json({ error: "skill_not_accessible" }, { status: 403 });
      }
      effectiveSkillKey = `u:${customSkill.id}`;
    } else if (skill && SKILL_REGISTRY[skill]) {
      // Catalog skill — handled below.
    } else if (skill && user) {
      await ensureSchema(env);
      customSkill = await dbGetUserSkillBySlug(env, user.id, skill);
      if (!customSkill) {
        return json({ error: "unknown_skill" }, { status: 400 });
      }
      effectiveSkillKey = `u:${customSkill.id}`;
    } else {
      return json({ error: "unknown_skill" }, { status: 400 });
    }
  }

  // Honest short-circuit for catalog skills that aren't yet wired to a real backend.
  if (mode === "run" && !customSkill && SKILL_REGISTRY[skill]?.comingSoon) {
    const reg = SKILL_REGISTRY[skill];
    const reason = reg.requires
      ? `Needs: ${reg.requires}`
      : "Pipeline scaffolded; integration pending.";
    const realSlugs = Object.entries(SKILL_REGISTRY)
      .filter(([, v]) => !v.comingSoon)
      .map(([k]) => k);
    const suggestions = realSlugs.slice(0, 5).join(", ");
    return streamOneShotSse(
      [
        `» ${skill} · coming soon`,
        reason,
        "",
        `Try a real skill: ${suggestions}`,
      ].join("\n"),
    );
  }

  // Custom skills require a signed-in user (memory + quota are attached to user).
  if (mode === "run" && customSkill && !user) {
    return json(
      {
        error: "sign_in_required",
        message: "Sign in to run custom skills.",
      },
      { status: 401 },
    );
  }

  // Authenticated users get per-user memory + per-tier daily quota. Tier is
  // max(billing plan, holder-wallet tier) so $aeonterminal holders unlock the
  // paid quota without needing a subscription.
  let limit;
  if (user) {
    let tier;
    try {
      tier = await resolveUserTier(env, user);
    } catch {
      tier = { tier: user.plan === "paid" ? "paid" : "free", source: "plan" };
    }
    try {
      limit = await dbCheckAndBumpUsage(env, user.id, mode, tier.tier);
    } catch {
      limit = { ok: true, remaining: null };
    }
    if (!limit.ok) {
      const sourceLabel = tier.source === "holder" ? "holder" : limit.plan;
      return json(
        {
          error: "rate_limited",
          message: `${mode === "ask" ? "asks" : "runs"}: ${limit.used}/${limit.limit} used today (${sourceLabel}). Resets at UTC midnight.`,
        },
        { status: 429 },
      );
    }
  } else {
    const ip = request.headers.get("cf-connecting-ip");
    limit = await checkRateLimit(ip);
    if (!limit.ok) {
      return json(
        {
          error: "rate_limited",
          message: "30 requests/day per IP. Sign in for higher limits.",
        },
        { status: 429 },
      );
    }
  }

  const mem = user
    ? await dbGetMemory(env, user.id).catch(() => ({ turns: [], runs: [] }))
    : { turns: [], runs: [] };

  let system = buildSystem(skill, mode, customSkill);
  if (mode === "run") {
    system = appendRunContext(system, mem.runs, effectiveSkillKey);
  }

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const sendEvent = async (obj) => {
    try {
      await writer.write(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
    } catch {
      // writer closed
    }
  };
  const sendText = (text) => sendEvent({ type: "text", delta: text });

  (async () => {
    // For ask mode, inject prior turns so the model has conversation history.
    // For run mode, history sits in the system prompt instead (see above).
    const messages = injectAskHistory(
      [{ role: "user", content: prompt }],
      mode === "ask" ? mem.turns : [],
    );
    const MAX_ITERS = 5;
    let finalAssistantText = "";
    let completed = false;
    try {
      for (let iter = 0; iter < MAX_ITERS; iter++) {
        const upstream = await callAnthropic(env, system, messages);
        if (!upstream.ok || !upstream.body) {
          const errText = await upstream.text().catch(() => "");
          await sendEvent({
            type: "error",
            message: `upstream ${upstream.status}: ${errText.slice(0, 200)}`,
          });
          return;
        }

        const { stopReason, contentBlocks } = await parseStream(upstream, sendText);

        // Accumulate plain text from this assistant turn (last turn wins for
        // memory purposes; intermediate tool-use turns also carry text deltas).
        for (const block of contentBlocks) {
          if (block.type === "text" && block.text) {
            finalAssistantText += block.text;
          }
        }

        if (stopReason !== "tool_use") {
          completed = true;
          await sendEvent({ type: "done", remaining: limit.remaining });
          return;
        }

        messages.push({ role: "assistant", content: contentBlocks });

        const toolResults = [];
        for (const block of contentBlocks) {
          if (block.type !== "tool_use") continue;
          const argPreview = previewArgs(block.input);
          await sendText(`\n» ${block.name}${argPreview ? " " + argPreview : ""}\n`);
          const result = await runTool(block.name, block.input, env);
          await sendText(`  · ${result.summary}\n`);
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: result.content,
            is_error: result.isError === true,
          });
        }
        messages.push({ role: "user", content: toolResults });
      }
      await sendEvent({
        type: "error",
        message: "max tool iterations reached (5)",
      });
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      await sendEvent({ type: "error", message: msg.slice(0, 200) });
    } finally {
      // Persist memory only on successful completion, only for authenticated
      // users. Failures and cancellations skip the write.
      if (completed && user && hasDb(env) && finalAssistantText) {
        try {
          if (mode === "ask") {
            await dbAppendTurn(env, user.id, prompt, finalAssistantText);
          } else if (mode === "run" && effectiveSkillKey) {
            await dbAppendRun(env, user.id, effectiveSkillKey, prompt, finalAssistantText);
          }
        } catch {
          // swallow — memory write is best-effort
        }
      }
      try {
        await writer.close();
      } catch {
        // already closed
      }
    }
  })();

  return new Response(readable, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
      ...CORS,
    },
  });
}

// --- D1 schema + auth + per-user memory ---

const MEM_MAX_TURNS = 5; // ask: last N user/assistant pairs
const MEM_MAX_RUNS = 10; // run: last N skill executions
const MEM_TRUNC_USER = 500;
const MEM_TRUNC_ASSISTANT = 1200;

function hasDb(env) {
  return !!(env && env.DB && typeof env.DB.prepare === "function");
}

let schemaReady = false;

async function ensureSchema(env) {
  if (schemaReady || !hasDb(env)) return;
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT,
      name TEXT,
      avatar_url TEXT,
      primary_provider TEXT,
      plan TEXT NOT NULL DEFAULT 'free',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
    `CREATE TABLE IF NOT EXISTS user_providers (
      provider TEXT NOT NULL,
      external_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      external_login TEXT,
      external_email TEXT,
      avatar_url TEXT,
      access_token TEXT,
      refresh_token TEXT,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (provider, external_id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_user_providers_user ON user_providers(user_id)`,
    `CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      ip TEXT,
      user_agent TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`,
    `CREATE TABLE IF NOT EXISTS memory_turns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      user_msg TEXT NOT NULL,
      assistant_msg TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_memory_turns_user_time ON memory_turns(user_id, created_at)`,
    `CREATE TABLE IF NOT EXISTS memory_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      skill TEXT NOT NULL,
      prompt TEXT NOT NULL,
      summary TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_memory_runs_user_time ON memory_runs(user_id, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_memory_runs_user_skill ON memory_runs(user_id, skill, created_at)`,
    `CREATE TABLE IF NOT EXISTS usage_daily (
      user_id TEXT NOT NULL,
      day TEXT NOT NULL,
      asks INTEGER NOT NULL DEFAULT 0,
      runs INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, day)
    )`,
    `CREATE TABLE IF NOT EXISTS oauth_states (
      state TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      code_verifier TEXT,
      redirect_to TEXT,
      expires_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS email_login_tokens (
      token TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      redirect_to TEXT,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      consumed_at INTEGER
    )`,
    `CREATE INDEX IF NOT EXISTS idx_email_tokens_email ON email_login_tokens(email)`,
    `CREATE TABLE IF NOT EXISTS user_skills (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      slug TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      summary TEXT NOT NULL,
      persona TEXT NOT NULL,
      visibility TEXT NOT NULL DEFAULT 'private',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_user_skills_user_slug ON user_skills(user_id, slug)`,
    `CREATE INDEX IF NOT EXISTS idx_user_skills_visibility ON user_skills(visibility, created_at)`,
    // One linked wallet per user. address is lowercase 0x-prefixed.
    // balance_wei is a decimal string (uint256 can overflow Number); balance_at
    // tracks the last on-chain refresh so we can cache.
    `CREATE TABLE IF NOT EXISTS user_wallets (
      user_id TEXT PRIMARY KEY,
      address TEXT NOT NULL,
      chain_id INTEGER NOT NULL,
      verified_at INTEGER NOT NULL,
      balance_wei TEXT NOT NULL DEFAULT '0',
      balance_at INTEGER NOT NULL DEFAULT 0
    )`,
    // Older deploys had only this non-unique index. We keep it for backward
    // compatibility and add a UNIQUE index below (after deduping any stragglers)
    // so the 1-wallet-1-account invariant is enforced at the DB layer too.
    `CREATE INDEX IF NOT EXISTS idx_user_wallets_addr ON user_wallets(address)`,
    // Short-lived nonces signed by the wallet during the connect flow.
    `CREATE TABLE IF NOT EXISTS wallet_nonces (
      nonce TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      consumed_at INTEGER
    )`,
  ];
  for (const sql of statements) {
    await env.DB.prepare(sql).run();
  }
  await ensureWalletAddressUniqueIndex(env);
  schemaReady = true;
}

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

function newId() {
  return crypto.randomUUID();
}

function newToken() {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

function utcDay(ts = nowSec()) {
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

function b64urlEncode(buf) {
  const bin = String.fromCharCode(...new Uint8Array(buf));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256(input) {
  const buf = new TextEncoder().encode(input);
  return crypto.subtle.digest("SHA-256", buf);
}

async function pkcePair() {
  const verifier = newToken() + newToken();
  const challenge = b64urlEncode(await sha256(verifier));
  return { verifier, challenge };
}

// --- D1: users + providers ---

async function dbUpsertOAuthUser(env, profile) {
  const ts = nowSec();
  let userId;

  const existing = await env.DB
    .prepare(`SELECT user_id FROM user_providers WHERE provider = ? AND external_id = ?`)
    .bind(profile.provider, profile.externalId)
    .first();

  if (existing) {
    userId = existing.user_id;
    await env.DB
      .prepare(
        `UPDATE user_providers
            SET external_login = ?, external_email = ?, avatar_url = ?,
                access_token = ?, refresh_token = ?
          WHERE provider = ? AND external_id = ?`,
      )
      .bind(
        profile.externalLogin || null,
        profile.email || null,
        profile.avatarUrl || null,
        profile.accessToken || null,
        profile.refreshToken || null,
        profile.provider,
        profile.externalId,
      )
      .run();
    await env.DB
      .prepare(
        `UPDATE users
            SET name = COALESCE(?, name),
                avatar_url = COALESCE(?, avatar_url),
                updated_at = ?
          WHERE id = ?`,
      )
      .bind(profile.name || null, profile.avatarUrl || null, ts, userId)
      .run();
    return userId;
  }

  if (profile.email) {
    const sameEmail = await env.DB
      .prepare(`SELECT id FROM users WHERE email = ?`)
      .bind(profile.email)
      .first();
    if (sameEmail) userId = sameEmail.id;
  }

  if (!userId) {
    userId = newId();
    await env.DB
      .prepare(
        `INSERT INTO users (id, email, name, avatar_url, primary_provider, plan, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'free', ?, ?)`,
      )
      .bind(
        userId,
        profile.email || null,
        profile.name || profile.externalLogin || null,
        profile.avatarUrl || null,
        profile.provider,
        ts,
        ts,
      )
      .run();
  }

  await env.DB
    .prepare(
      `INSERT OR REPLACE INTO user_providers
         (provider, external_id, user_id, external_login, external_email, avatar_url, access_token, refresh_token, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      profile.provider,
      profile.externalId,
      userId,
      profile.externalLogin || null,
      profile.email || null,
      profile.avatarUrl || null,
      profile.accessToken || null,
      profile.refreshToken || null,
      ts,
    )
    .run();

  return userId;
}

async function dbUpsertEmailUser(env, email) {
  const ts = nowSec();
  const existing = await env.DB
    .prepare(`SELECT id FROM users WHERE email = ?`)
    .bind(email)
    .first();
  if (existing) return existing.id;
  const userId = newId();
  await env.DB
    .prepare(
      `INSERT INTO users (id, email, name, avatar_url, primary_provider, plan, created_at, updated_at)
       VALUES (?, ?, ?, NULL, 'email', 'free', ?, ?)`,
    )
    .bind(userId, email, email.split("@")[0], ts, ts)
    .run();
  return userId;
}

// --- D1: sessions ---

async function dbCreateSession(env, userId, request) {
  const token = newToken();
  const ts = nowSec();
  const expires = ts + SESSION_TTL_DAYS * 24 * 60 * 60;
  const ip = request.headers.get("cf-connecting-ip") || null;
  const ua = (request.headers.get("user-agent") || "").slice(0, 200);
  await env.DB
    .prepare(
      `INSERT INTO sessions (token, user_id, expires_at, created_at, ip, user_agent)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(token, userId, expires, ts, ip, ua)
    .run();
  return { token, expires };
}

async function dbGetSessionUser(env, token) {
  if (!token) return null;
  const row = await env.DB
    .prepare(
      `SELECT u.id, u.email, u.name, u.avatar_url, u.primary_provider, u.plan, s.expires_at
         FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.token = ? AND s.expires_at > ?`,
    )
    .bind(token, nowSec())
    .first();
  return row || null;
}

async function dbDeleteSession(env, token) {
  if (!token) return;
  await env.DB.prepare(`DELETE FROM sessions WHERE token = ?`).bind(token).run();
}

// --- D1: memory ---

async function dbGetMemory(env, userId) {
  const [turnsRes, runsRes] = await Promise.all([
    env.DB
      .prepare(
        `SELECT user_msg, assistant_msg, created_at
           FROM memory_turns WHERE user_id = ?
           ORDER BY created_at DESC LIMIT ?`,
      )
      .bind(userId, MEM_MAX_TURNS)
      .all(),
    env.DB
      .prepare(
        `SELECT skill, prompt, summary, created_at
           FROM memory_runs WHERE user_id = ?
           ORDER BY created_at DESC LIMIT ?`,
      )
      .bind(userId, MEM_MAX_RUNS)
      .all(),
  ]);
  const turns = (turnsRes.results || []).reverse().map((r) => ({
    user: r.user_msg,
    assistant: r.assistant_msg,
    ts: new Date(r.created_at * 1000).toISOString().slice(0, 16).replace("T", " "),
  }));
  const runs = (runsRes.results || []).reverse().map((r) => ({
    skill: r.skill,
    prompt: r.prompt,
    summary: r.summary,
    ts: new Date(r.created_at * 1000).toISOString().slice(0, 16).replace("T", " "),
  }));
  return { turns, runs };
}

async function dbAppendTurn(env, userId, userMsg, assistantMsg) {
  await env.DB
    .prepare(
      `INSERT INTO memory_turns (user_id, user_msg, assistant_msg, created_at)
       VALUES (?, ?, ?, ?)`,
    )
    .bind(
      userId,
      trunc(userMsg, MEM_TRUNC_USER),
      trunc(assistantMsg, MEM_TRUNC_ASSISTANT),
      nowSec(),
    )
    .run();
  await env.DB
    .prepare(
      `DELETE FROM memory_turns WHERE user_id = ? AND id NOT IN (
         SELECT id FROM memory_turns WHERE user_id = ? ORDER BY created_at DESC LIMIT ?
       )`,
    )
    .bind(userId, userId, MEM_MAX_TURNS)
    .run();
}

async function dbAppendRun(env, userId, skill, prompt, summary) {
  await env.DB
    .prepare(
      `INSERT INTO memory_runs (user_id, skill, prompt, summary, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(
      userId,
      skill,
      trunc(prompt, MEM_TRUNC_USER),
      trunc(summary, MEM_TRUNC_ASSISTANT),
      nowSec(),
    )
    .run();
  await env.DB
    .prepare(
      `DELETE FROM memory_runs WHERE user_id = ? AND id NOT IN (
         SELECT id FROM memory_runs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?
       )`,
    )
    .bind(userId, userId, MEM_MAX_RUNS)
    .run();
}

async function dbClearMemory(env, userId) {
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM memory_turns WHERE user_id = ?`).bind(userId),
    env.DB.prepare(`DELETE FROM memory_runs WHERE user_id = ?`).bind(userId),
  ]);
}

// --- D1: custom user skills ---

// Until token-balance check ships (Q2 wallet connect), free-tier holds at 3
// custom skills per user. The /token page describes the holder unlock path.
const FREE_CUSTOM_SKILL_LIMIT = 3;
const PAID_CUSTOM_SKILL_LIMIT = 25;

function customSkillLimit(plan) {
  return plan === "paid" ? PAID_CUSTOM_SKILL_LIMIT : FREE_CUSTOM_SKILL_LIMIT;
}

const VALID_SKILL_CATEGORIES = new Set([
  "research",
  "dev",
  "crypto",
  "social",
  "productivity",
  "meta",
]);

function sanitizeSlug(input) {
  return String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

function validateUserSkillInput(body) {
  const slug = sanitizeSlug(body.slug ?? body.name ?? "");
  const name = String(body.name ?? "").trim().slice(0, 60);
  const category = String(body.category ?? "").trim();
  const summary = String(body.summary ?? "").trim().slice(0, 240);
  const persona = String(body.persona ?? "").trim().slice(0, 4000);
  const visibility = body.visibility === "public" ? "public" : "private";

  if (!slug || slug.length < 3) return { error: "slug must be 3-32 chars (a-z, 0-9, -)" };
  if (SKILL_REGISTRY[slug]) return { error: `slug '${slug}' is reserved by the catalog` };
  if (!name) return { error: "name is required" };
  if (!VALID_SKILL_CATEGORIES.has(category)) return { error: "invalid category" };
  if (!summary || summary.length < 8) return { error: "summary must be at least 8 chars" };
  if (!persona || persona.length < 40) return { error: "persona must be at least 40 chars" };

  return { ok: true, value: { slug, name, category, summary, persona, visibility } };
}

async function dbCountUserSkills(env, userId) {
  const row = await env.DB
    .prepare(`SELECT COUNT(*) AS c FROM user_skills WHERE user_id = ?`)
    .bind(userId)
    .first();
  return row ? Number(row.c) : 0;
}

async function dbCreateUserSkill(env, userId, input) {
  const id = newId();
  const ts = nowSec();
  await env.DB
    .prepare(
      `INSERT INTO user_skills
         (id, user_id, slug, name, category, summary, persona, visibility, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      userId,
      input.slug,
      input.name,
      input.category,
      input.summary,
      input.persona,
      input.visibility,
      ts,
      ts,
    )
    .run();
  return dbGetUserSkillById(env, id);
}

async function dbListUserSkillsByUser(env, userId) {
  const res = await env.DB
    .prepare(
      `SELECT id, user_id, slug, name, category, summary, persona, visibility,
              created_at, updated_at
         FROM user_skills WHERE user_id = ? ORDER BY created_at DESC`,
    )
    .bind(userId)
    .all();
  return res.results || [];
}

async function dbListPublicUserSkills(env, limit = 20) {
  const res = await env.DB
    .prepare(
      `SELECT id, user_id, slug, name, category, summary, persona, visibility,
              created_at, updated_at
         FROM user_skills WHERE visibility = 'public'
         ORDER BY created_at DESC LIMIT ?`,
    )
    .bind(limit)
    .all();
  return res.results || [];
}

async function dbGetUserSkillById(env, id) {
  return env.DB
    .prepare(
      `SELECT id, user_id, slug, name, category, summary, persona, visibility,
              created_at, updated_at
         FROM user_skills WHERE id = ? LIMIT 1`,
    )
    .bind(id)
    .first();
}

async function dbGetUserSkillBySlug(env, userId, slug) {
  return env.DB
    .prepare(
      `SELECT id, user_id, slug, name, category, summary, persona, visibility,
              created_at, updated_at
         FROM user_skills WHERE user_id = ? AND slug = ? LIMIT 1`,
    )
    .bind(userId, slug)
    .first();
}

async function dbDeleteUserSkill(env, userId, id) {
  const res = await env.DB
    .prepare(`DELETE FROM user_skills WHERE id = ? AND user_id = ?`)
    .bind(id, userId)
    .run();
  return res.meta?.changes ?? res.changes ?? 0;
}

function serializeUserSkill(row, opts = {}) {
  if (!row) return null;
  const out = {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    summary: row.summary,
    visibility: row.visibility,
    created_at: row.created_at,
    updated_at: row.updated_at,
    owner: opts.includeOwner ? row.user_id : undefined,
    persona: opts.includePersona ? row.persona : undefined,
  };
  // Remove undefined props for compact JSON.
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  return out;
}

// --- D1: quota ---

async function dbCheckAndBumpUsage(env, userId, kind, plan) {
  const day = utcDay();
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
  const limit = kind === "ask" ? limits.asks : limits.runs;
  const col = kind === "ask" ? "asks" : "runs";
  const row = await env.DB
    .prepare(
      `INSERT INTO usage_daily (user_id, day, ${col}) VALUES (?, ?, 1)
       ON CONFLICT(user_id, day) DO UPDATE SET ${col} = ${col} + 1
       RETURNING asks, runs`,
    )
    .bind(userId, day)
    .first();
  const used = row[col];
  if (used > limit) {
    await env.DB
      .prepare(`UPDATE usage_daily SET ${col} = ${col} - 1 WHERE user_id = ? AND day = ?`)
      .bind(userId, day)
      .run();
    return { ok: false, used: used - 1, limit, plan, remaining: 0 };
  }
  return { ok: true, used, limit, plan, remaining: limit - used };
}

async function dbGetUsage(env, userId, plan) {
  const day = utcDay();
  const row = await env.DB
    .prepare(`SELECT asks, runs FROM usage_daily WHERE user_id = ? AND day = ?`)
    .bind(userId, day)
    .first();
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
  return {
    day,
    asks: row?.asks ?? 0,
    runs: row?.runs ?? 0,
    limits,
  };
}

// --- token-gated tier ---
//
// A signed-in user's effective tier is the max of their billing plan and any
// linked wallet that holds ≥ TOKEN_HOLDER_THRESHOLD_WEI of $aeonterminal on
// Base. Free + holder wallet → paid quotas. Stripe paid plan → paid quotas.
//
// Tier resolution caches the on-chain balance in `user_wallets.balance_wei`
// for TOKEN_BALANCE_TTL_SEC. Reads piggyback on `currentUser` callers so the
// balance is refreshed lazily — no background polling required.

const TOKEN_CONTRACT_ADDRESS = "0xda3ffca86273037cddcf71aae2cdea6aef313285";
const TOKEN_CHAIN_ID = 8453;
const TOKEN_RPC_URL_DEFAULT = "https://mainnet.base.org";
// 100,000 $aeonterminal (18 decimals) ≈ 0.01% of the 1B supply. Override via
// the TOKEN_HOLDER_THRESHOLD_WEI worker variable if the unlock bar moves.
const TOKEN_HOLDER_THRESHOLD_WEI_DEFAULT = 100_000n * 10n ** 18n;
const TOKEN_BALANCE_TTL_SEC = 60 * 60; // 1h
const WALLET_NONCE_TTL_SEC = 5 * 60;

function tokenRpcUrl(env) {
  return (env && env.TOKEN_RPC_URL) || TOKEN_RPC_URL_DEFAULT;
}

function tokenHolderThresholdWei(env) {
  const raw = env && env.TOKEN_HOLDER_THRESHOLD_WEI;
  if (!raw) return TOKEN_HOLDER_THRESHOLD_WEI_DEFAULT;
  try {
    return BigInt(String(raw));
  } catch {
    return TOKEN_HOLDER_THRESHOLD_WEI_DEFAULT;
  }
}

function bytesToHex(b) {
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex) {
  let h = hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex;
  if (h.length % 2 !== 0) h = "0" + h;
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(h.substr(i * 2, 2), 16);
  }
  return out;
}

function isHexAddress(s) {
  return typeof s === "string" && /^0x[0-9a-fA-F]{40}$/.test(s);
}

function normalizeAddress(s) {
  return s.toLowerCase();
}

// EIP-191 personal_sign recovery. Returns lowercase 0x-prefixed address or
// throws on malformed input. Verified with @noble/curves v2 (recovered format
// puts the v byte first).
function recoverPersonalSignAddress(message, signatureHex) {
  const sig = hexToBytes(signatureHex);
  if (sig.length !== 65) throw new Error("bad_sig_length");
  let v = sig[64];
  if (v >= 27) v -= 27;
  if (v !== 0 && v !== 1) throw new Error("bad_recovery_byte");
  const sigForNoble = new Uint8Array(65);
  sigForNoble[0] = v;
  sigForNoble.set(sig.slice(0, 64), 1);
  const msgBytes = new TextEncoder().encode(message);
  const prefix = new TextEncoder().encode(
    "\x19Ethereum Signed Message:\n" + msgBytes.length,
  );
  const full = new Uint8Array(prefix.length + msgBytes.length);
  full.set(prefix, 0);
  full.set(msgBytes, prefix.length);
  const hash = keccak_256(full);
  const compressed = secp256k1.recoverPublicKey(sigForNoble, hash, {
    prehash: false,
    format: "recovered",
  });
  const uncompressed = secp256k1.Point.fromBytes(compressed).toBytes(false);
  // uncompressed = [0x04 | X(32) | Y(32)]; eth address = last 20 of keccak(X|Y)
  const addrHash = keccak_256(uncompressed.slice(1));
  return "0x" + bytesToHex(addrHash.slice(12));
}

function buildSiweMessage({ domain, address, nonce, issuedAt }) {
  return [
    `${domain} wants you to sign in with your Ethereum account:`,
    address,
    "",
    "Link this wallet to your aeon.terminal account. Holding the threshold balance of $aeonterminal unlocks holder-tier quota.",
    "",
    `URI: https://${domain}/account`,
    `Version: 1`,
    `Chain ID: ${TOKEN_CHAIN_ID}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ].join("\n");
}

async function rpcCall(env, method, params) {
  const res = await fetch(tokenRpcUrl(env), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cf: { cacheTtl: 0, cacheEverything: false },
  });
  if (!res.ok) throw new Error(`rpc_http_${res.status}`);
  const body = await res.json();
  if (body.error) throw new Error(`rpc_error_${body.error.code || ""}`);
  return body.result;
}

// ERC-20 balanceOf(address) selector = 0x70a08231
async function fetchOnChainBalance(env, address) {
  const addr = address.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  const data = "0x70a08231" + addr;
  const result = await rpcCall(env, "eth_call", [
    { to: TOKEN_CONTRACT_ADDRESS, data },
    "latest",
  ]);
  if (!result || result === "0x") return 0n;
  try {
    return BigInt(result);
  } catch {
    return 0n;
  }
}

async function dbUpsertWallet(env, userId, address, balanceWei, ts) {
  await env.DB
    .prepare(
      `INSERT INTO user_wallets (user_id, address, chain_id, verified_at, balance_wei, balance_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         address = excluded.address,
         chain_id = excluded.chain_id,
         verified_at = excluded.verified_at,
         balance_wei = excluded.balance_wei,
         balance_at = excluded.balance_at`,
    )
    .bind(userId, address, TOKEN_CHAIN_ID, ts, balanceWei.toString(), ts)
    .run();
}

async function dbGetWallet(env, userId) {
  return env.DB
    .prepare(
      `SELECT user_id, address, chain_id, verified_at, balance_wei, balance_at
         FROM user_wallets WHERE user_id = ?`,
    )
    .bind(userId)
    .first();
}

async function dbDeleteWallet(env, userId) {
  await env.DB
    .prepare(`DELETE FROM user_wallets WHERE user_id = ?`)
    .bind(userId)
    .run();
}

// Look up which user (if any) currently has a given wallet linked. Used to
// transfer the link when the same address re-verifies under a different
// account.
async function dbWalletOwnerForAddress(env, address) {
  const row = await env.DB
    .prepare(`SELECT user_id FROM user_wallets WHERE address = ? LIMIT 1`)
    .bind(address.toLowerCase())
    .first();
  return row ? row.user_id : null;
}

// Used during verify to enforce "one wallet linked to at most one account at a
// time". Signing again proves current control of the wallet, so transferring
// the link to the new account is safe.
async function dbDeleteWalletByAddress(env, address) {
  await env.DB
    .prepare(`DELETE FROM user_wallets WHERE address = ?`)
    .bind(address.toLowerCase())
    .run();
}

// Promote idx_user_wallets_addr to a UNIQUE index so the 1-wallet-1-account
// invariant is enforced at the DB layer (defense-in-depth on top of the
// application-level lookup-and-transfer in /api/wallet/verify). If a previous
// deploy left duplicate address rows, dedupe (keep most recent rowid) before
// creating the unique index.
async function ensureWalletAddressUniqueIndex(env) {
  try {
    await env.DB
      .prepare(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_user_wallets_addr_unique ON user_wallets(address)`,
      )
      .run();
    return;
  } catch {
    // Most likely cause: duplicate addresses already in the table. Dedupe.
  }
  try {
    await env.DB
      .prepare(
        `DELETE FROM user_wallets WHERE rowid NOT IN (
          SELECT MAX(rowid) FROM user_wallets GROUP BY address
        )`,
      )
      .run();
    await env.DB
      .prepare(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_user_wallets_addr_unique ON user_wallets(address)`,
      )
      .run();
  } catch {
    // Last resort: leave the schema alone. The application-level lookup-and-
    // transfer in /api/wallet/verify still guards against multi-account links.
  }
}

async function dbUpdateWalletBalance(env, userId, balanceWei, ts) {
  await env.DB
    .prepare(
      `UPDATE user_wallets SET balance_wei = ?, balance_at = ? WHERE user_id = ?`,
    )
    .bind(balanceWei.toString(), ts, userId)
    .run();
}

async function dbStoreWalletNonce(env, userId, nonce) {
  const ts = nowSec();
  // Best-effort cleanup of expired nonces for this user before storing the new
  // one — keeps the table small without needing a separate cron.
  try {
    await env.DB
      .prepare(`DELETE FROM wallet_nonces WHERE user_id = ? AND expires_at < ?`)
      .bind(userId, ts)
      .run();
  } catch {
    // ignore
  }
  await env.DB
    .prepare(
      `INSERT INTO wallet_nonces (nonce, user_id, created_at, expires_at)
       VALUES (?, ?, ?, ?)`,
    )
    .bind(nonce, userId, ts, ts + WALLET_NONCE_TTL_SEC)
    .run();
}

async function dbConsumeWalletNonce(env, nonce, userId) {
  const ts = nowSec();
  const row = await env.DB
    .prepare(
      `SELECT user_id, expires_at, consumed_at FROM wallet_nonces WHERE nonce = ?`,
    )
    .bind(nonce)
    .first();
  if (!row) return { ok: false, reason: "unknown_nonce" };
  if (row.consumed_at) return { ok: false, reason: "nonce_used" };
  if (row.expires_at < ts) return { ok: false, reason: "nonce_expired" };
  if (row.user_id !== userId) return { ok: false, reason: "nonce_mismatch" };
  await env.DB
    .prepare(`UPDATE wallet_nonces SET consumed_at = ? WHERE nonce = ?`)
    .bind(ts, nonce)
    .run();
  return { ok: true };
}

function tierFromBalance(balanceWei, thresholdWei) {
  return balanceWei >= thresholdWei ? "paid" : "free";
}

// Resolve a user's effective tier (and refresh the cached on-chain balance if
// stale). Always returns a tier — falls back to plan when wallet calls error.
async function resolveUserTier(env, user) {
  const baselinePlan = user.plan === "paid" ? "paid" : "free";
  if (!hasDb(env)) {
    return {
      tier: baselinePlan,
      plan: baselinePlan,
      source: "plan",
      wallet: null,
    };
  }
  let wallet;
  try {
    wallet = await dbGetWallet(env, user.id);
  } catch {
    wallet = null;
  }
  const threshold = tokenHolderThresholdWei(env);
  if (!wallet) {
    return {
      tier: baselinePlan,
      plan: baselinePlan,
      source: "plan",
      wallet: null,
      threshold_wei: threshold.toString(),
    };
  }
  let balanceWei = 0n;
  try {
    balanceWei = BigInt(wallet.balance_wei || "0");
  } catch {
    balanceWei = 0n;
  }
  const ts = nowSec();
  const stale = (wallet.balance_at || 0) + TOKEN_BALANCE_TTL_SEC < ts;
  if (stale) {
    try {
      balanceWei = await fetchOnChainBalance(env, wallet.address);
      await dbUpdateWalletBalance(env, user.id, balanceWei, ts);
    } catch {
      // Soft-fail on RPC errors: keep the cached balance. We never block the
      // user on a flaky public RPC.
    }
  }
  const walletTier = tierFromBalance(balanceWei, threshold);
  // Effective tier = max(plan, walletTier).
  const tier = baselinePlan === "paid" || walletTier === "paid" ? "paid" : "free";
  return {
    tier,
    plan: baselinePlan,
    source: tier === "paid" && walletTier === "paid" && baselinePlan !== "paid" ? "holder" : "plan",
    wallet: {
      address: wallet.address,
      chain_id: wallet.chain_id,
      balance_wei: balanceWei.toString(),
      balance_at: stale ? ts : wallet.balance_at,
      verified_at: wallet.verified_at,
      tier: walletTier,
    },
    threshold_wei: threshold.toString(),
  };
}

// --- API: /api/wallet ---

async function handleWallet(request, env) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (!hasDb(env)) return json({ error: "db_not_configured" }, { status: 503 });
  await ensureSchema(env);

  const url = new URL(request.url);
  const path = url.pathname;
  const user = await currentUser(request, env);
  if (!user) return json({ error: "sign_in_required" }, { status: 401 });

  if (path === "/api/wallet/me" && request.method === "GET") {
    const tier = await resolveUserTier(env, user);
    return json({ wallet: tier.wallet, tier });
  }

  if (path === "/api/wallet/me" && request.method === "DELETE") {
    await dbDeleteWallet(env, user.id);
    const tier = await resolveUserTier(env, user);
    return json({ ok: true, tier });
  }

  if (path === "/api/wallet/refresh" && request.method === "POST") {
    const wallet = await dbGetWallet(env, user.id);
    if (!wallet) return json({ error: "no_wallet_linked" }, { status: 404 });
    try {
      const bal = await fetchOnChainBalance(env, wallet.address);
      await dbUpdateWalletBalance(env, user.id, bal, nowSec());
    } catch {
      return json({ error: "rpc_failed" }, { status: 502 });
    }
    const tier = await resolveUserTier(env, user);
    return json({ ok: true, tier });
  }

  if (path === "/api/wallet/nonce" && request.method === "POST") {
    let body = {};
    try {
      body = await request.json();
    } catch {
      // empty body is allowed; address is optional and shown in the message
      body = {};
    }
    const rawAddress = body && body.address;
    if (rawAddress != null && !isHexAddress(String(rawAddress))) {
      return json({ error: "bad_address" }, { status: 400 });
    }
    const address = rawAddress ? normalizeAddress(String(rawAddress)) : null;
    const nonce = newToken();
    await dbStoreWalletNonce(env, user.id, nonce);
    const issuedAt = new Date().toISOString();
    const message = address
      ? buildSiweMessage({
          domain: CANONICAL_HOST,
          address,
          nonce,
          issuedAt,
        })
      : null;
    return json({
      nonce,
      issued_at: issuedAt,
      expires_in: WALLET_NONCE_TTL_SEC,
      domain: CANONICAL_HOST,
      chain_id: TOKEN_CHAIN_ID,
      uri: `https://${CANONICAL_HOST}/account`,
      message,
    });
  }

  if (path === "/api/wallet/verify" && request.method === "POST") {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "bad_json" }, { status: 400 });
    }
    const address = body && body.address;
    const signature = body && body.signature;
    const nonce = body && body.nonce;
    const issuedAt = body && body.issued_at;
    if (!isHexAddress(String(address || ""))) {
      return json({ error: "bad_address" }, { status: 400 });
    }
    if (typeof signature !== "string" || !signature.startsWith("0x")) {
      return json({ error: "bad_signature" }, { status: 400 });
    }
    if (typeof nonce !== "string" || !/^[a-f0-9]{16,128}$/.test(nonce)) {
      return json({ error: "bad_nonce" }, { status: 400 });
    }
    if (typeof issuedAt !== "string" || issuedAt.length < 10 || issuedAt.length > 40) {
      return json({ error: "bad_issued_at" }, { status: 400 });
    }
    const normAddr = normalizeAddress(String(address));
    const consumed = await dbConsumeWalletNonce(env, nonce, user.id);
    if (!consumed.ok) return json({ error: consumed.reason }, { status: 400 });
    const message = buildSiweMessage({
      domain: CANONICAL_HOST,
      address: normAddr,
      nonce,
      issuedAt,
    });
    let recovered;
    try {
      recovered = recoverPersonalSignAddress(message, signature);
    } catch {
      return json({ error: "bad_signature" }, { status: 400 });
    }
    if (recovered.toLowerCase() !== normAddr) {
      return json({ error: "signature_mismatch" }, { status: 400 });
    }
    // Enforce 1-wallet-1-account: if this address is already linked to a
    // different user, transfer the link. The signer just proved current
    // control, so the new account wins. This prevents a single holder wallet
    // from unlocking paid quota on N accounts simultaneously.
    //
    // Lookup is wrapped in try/catch because a stale read is benign — the
    // UNIQUE index on user_wallets(address) (see ensureWalletAddressUniqueIndex)
    // will still reject a duplicate at the DB layer. The DELETE, however, is
    // critical: if we found a previous owner but the delete fails, we MUST
    // bail rather than upsert a duplicate row.
    let transferred = false;
    let prevOwner = null;
    try {
      prevOwner = await dbWalletOwnerForAddress(env, normAddr);
    } catch {
      // Lookup failed; rely on the UNIQUE index to catch any duplicate.
    }
    if (prevOwner && prevOwner !== user.id) {
      try {
        await dbDeleteWalletByAddress(env, normAddr);
        transferred = true;
      } catch {
        return json(
          {
            error: "wallet_transfer_failed",
            message:
              "Could not transfer the wallet link from another account. Try again.",
          },
          { status: 500 },
        );
      }
    }
    const ts = nowSec();
    let balanceWei = 0n;
    try {
      balanceWei = await fetchOnChainBalance(env, normAddr);
    } catch {
      // We still link the wallet on RPC failure; balance refresh will retry.
      balanceWei = 0n;
    }
    try {
      await dbUpsertWallet(env, user.id, normAddr, balanceWei, ts);
    } catch {
      // UNIQUE index on user_wallets(address) rejected the insert — most
      // likely a concurrent verify won the race. Surface a retriable error
      // rather than leaving the user in an inconsistent state.
      return json(
        {
          error: "wallet_link_failed",
          message:
            "Wallet link failed (likely a concurrent change). Try again in a moment.",
        },
        { status: 409 },
      );
    }
    const tier = await resolveUserTier(env, user);
    return json({ ok: true, tier, transferred });
  }

  return json({ error: "not_found" }, { status: 404 });
}

// --- D1: OAuth state ---

async function dbStoreOAuthState(env, state, provider, codeVerifier, redirectTo) {
  await env.DB
    .prepare(
      `INSERT INTO oauth_states (state, provider, code_verifier, redirect_to, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(
      state,
      provider,
      codeVerifier || null,
      redirectTo || null,
      nowSec() + OAUTH_STATE_TTL_SECONDS,
    )
    .run();
}

async function dbConsumeOAuthState(env, state) {
  const row = await env.DB
    .prepare(
      `SELECT provider, code_verifier, redirect_to, expires_at FROM oauth_states WHERE state = ?`,
    )
    .bind(state)
    .first();
  if (!row) return null;
  await env.DB.prepare(`DELETE FROM oauth_states WHERE state = ?`).bind(state).run();
  if (row.expires_at < nowSec()) return null;
  return row;
}

// --- D1: magic link ---

async function dbStoreMagicToken(env, email, token, redirectTo) {
  const ts = nowSec();
  await env.DB
    .prepare(
      `INSERT INTO email_login_tokens (token, email, redirect_to, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(token, email, redirectTo || null, ts, ts + 15 * 60)
    .run();
}

async function dbConsumeMagicToken(env, token) {
  const row = await env.DB
    .prepare(
      `SELECT email, redirect_to, expires_at, consumed_at
         FROM email_login_tokens WHERE token = ?`,
    )
    .bind(token)
    .first();
  if (!row || row.consumed_at || row.expires_at < nowSec()) return null;
  await env.DB
    .prepare(`UPDATE email_login_tokens SET consumed_at = ? WHERE token = ?`)
    .bind(nowSec(), token)
    .run();
  return row;
}

// --- cookies + currentUser ---

function parseCookies(request) {
  const header = request.headers.get("cookie") || "";
  const out = {};
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

function sessionCookieHeader(token, expiresAt) {
  const maxAge = Math.max(0, expiresAt - nowSec());
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function clearSessionCookieHeader() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

async function currentUser(request, env) {
  if (!hasDb(env)) return null;
  await ensureSchema(env);
  const cookies = parseCookies(request);
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;
  return dbGetSessionUser(env, token);
}

// --- OAuth: Google ---

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

async function handleGoogleLogin(request, env) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return json({ error: "google_not_configured" }, { status: 503 });
  }
  if (!hasDb(env)) return json({ error: "db_not_configured" }, { status: 503 });
  await ensureSchema(env);
  const url = new URL(request.url);
  const redirect = sanitizeReturnPath(url.searchParams.get("redirect"));
  const state = newToken();
  const { verifier, challenge } = await pkcePair();
  await dbStoreOAuthState(env, state, "google", verifier, redirect);
  const authUrl = new URL(GOOGLE_AUTH_URL);
  authUrl.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", buildOAuthRedirectUri("google"));
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "select_account");
  return Response.redirect(authUrl.toString(), 302);
}

async function handleGoogleCallback(request, env) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return loginError("google_not_configured");
  }
  if (!hasDb(env)) return loginError("db_not_configured");
  await ensureSchema(env);
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errParam = url.searchParams.get("error");
  if (errParam) return loginError(`google_${errParam.slice(0, 40)}`);
  if (!code || !state) return loginError("missing_params");
  const stored = await dbConsumeOAuthState(env, state);
  if (!stored || stored.provider !== "google") return loginError("invalid_state");
  const body = new URLSearchParams({
    code,
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    redirect_uri: buildOAuthRedirectUri("google"),
    grant_type: "authorization_code",
    code_verifier: stored.code_verifier,
  });
  const tokRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!tokRes.ok) return loginError(`google_token_${tokRes.status}`);
  const tok = await tokRes.json();
  const profileRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { authorization: `Bearer ${tok.access_token}` },
  });
  if (!profileRes.ok) return loginError("google_userinfo");
  const profile = await profileRes.json();
  if (!profile.sub) return loginError("google_no_sub");
  const userId = await dbUpsertOAuthUser(env, {
    provider: "google",
    externalId: profile.sub,
    externalLogin: profile.email,
    email: profile.email,
    name: profile.name,
    avatarUrl: profile.picture,
    accessToken: tok.access_token,
    refreshToken: tok.refresh_token || null,
  });
  return loginSuccess(request, env, userId, stored.redirect_to);
}

// --- OAuth: GitHub ---

const GITHUB_AUTH_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_USER_URL = "https://api.github.com/user";
const GITHUB_USER_EMAILS_URL = "https://api.github.com/user/emails";

async function handleGithubLogin(request, env) {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return json({ error: "github_not_configured" }, { status: 503 });
  }
  if (!hasDb(env)) return json({ error: "db_not_configured" }, { status: 503 });
  await ensureSchema(env);
  const url = new URL(request.url);
  const redirect = sanitizeReturnPath(url.searchParams.get("redirect"));
  const state = newToken();
  await dbStoreOAuthState(env, state, "github", null, redirect);
  const authUrl = new URL(GITHUB_AUTH_URL);
  authUrl.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", buildOAuthRedirectUri("github"));
  authUrl.searchParams.set("scope", "read:user user:email");
  authUrl.searchParams.set("state", state);
  return Response.redirect(authUrl.toString(), 302);
}

async function handleGithubCallback(request, env) {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return loginError("github_not_configured");
  }
  if (!hasDb(env)) return loginError("db_not_configured");
  await ensureSchema(env);
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errParam = url.searchParams.get("error");
  if (errParam) return loginError(`github_${errParam.slice(0, 40)}`);
  if (!code || !state) return loginError("missing_params");
  const stored = await dbConsumeOAuthState(env, state);
  if (!stored || stored.provider !== "github") return loginError("invalid_state");
  const body = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    client_secret: env.GITHUB_CLIENT_SECRET,
    code,
    redirect_uri: buildOAuthRedirectUri("github"),
  });
  const tokRes = await fetch(GITHUB_TOKEN_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body,
  });
  if (!tokRes.ok) return loginError(`github_token_${tokRes.status}`);
  const tok = await tokRes.json();
  if (!tok.access_token) return loginError("github_no_token");
  const auth = {
    authorization: `Bearer ${tok.access_token}`,
    "user-agent": "aeon-terminal",
    accept: "application/vnd.github+json",
  };
  const [userRes, emailRes] = await Promise.all([
    fetch(GITHUB_USER_URL, { headers: auth }),
    fetch(GITHUB_USER_EMAILS_URL, { headers: auth }),
  ]);
  if (!userRes.ok) return loginError("github_userinfo");
  const profile = await userRes.json();
  let email = profile.email;
  if (!email && emailRes.ok) {
    const emails = await emailRes.json();
    const primary = Array.isArray(emails)
      ? emails.find((e) => e.primary && e.verified)
      : null;
    email = primary?.email || null;
  }
  const userId = await dbUpsertOAuthUser(env, {
    provider: "github",
    externalId: String(profile.id),
    externalLogin: profile.login,
    email,
    name: profile.name || profile.login,
    avatarUrl: profile.avatar_url,
    accessToken: tok.access_token,
    refreshToken: null,
  });
  return loginSuccess(request, env, userId, stored.redirect_to);
}

// --- Email magic link ---

async function handleEmailRequest(request, env) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, { status: 405 });
  if (!env.RESEND_API_KEY) return json({ error: "email_not_configured" }, { status: 503 });
  if (!hasDb(env)) return json({ error: "db_not_configured" }, { status: 503 });
  await ensureSchema(env);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad_json" }, { status: 400 });
  }
  const email = String(body?.email || "").trim().toLowerCase();
  const redirect = sanitizeReturnPath(body?.redirect);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return json({ error: "invalid_email" }, { status: 400 });
  }
  const token = newToken();
  await dbStoreMagicToken(env, email, token, redirect);
  const verifyUrl = new URL(`https://${CANONICAL_HOST}/api/auth/email/verify`);
  verifyUrl.searchParams.set("token", token);
  const sent = await sendMagicLink(env, email, verifyUrl.toString());
  if (!sent.ok) {
    return json(
      { error: "email_send_failed", detail: (sent.detail || "").slice(0, 200) },
      { status: 502 },
    );
  }
  return json({ ok: true });
}

// Magic link verify is a deliberate two-step:
//   GET  /api/auth/email/verify?token=...  -> render a confirm page (no db write)
//   POST /api/auth/email/verify with token=... (form-encoded) -> consume + session
//
// Email link scanners (gmail, slack, imessage, outlook, etc.) prefetch links
// with GET to check for phishing. If the GET handler consumed the single-use
// token, the scanner would burn the user's link in transit and they'd see
// `token_expired` on first real click. Keeping consumption behind POST means
// only an actual button-click from the real browser completes sign-in.
async function handleEmailVerify(request, env) {
  if (!hasDb(env)) return loginError("db_not_configured");
  await ensureSchema(env);
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  if (method === "GET" || method === "HEAD") {
    const token = url.searchParams.get("token") || "";
    if (!token || !/^[a-f0-9]{32,128}$/.test(token)) return loginError("invalid_token");
    return new Response(method === "HEAD" ? null : renderConfirmPage(token), {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store, max-age=0",
        "x-robots-tag": "noindex, nofollow",
        "referrer-policy": "no-referrer",
      },
    });
  }

  if (method === "POST") {
    let token = "";
    const ct = (request.headers.get("content-type") || "").toLowerCase();
    if (
      ct.includes("application/x-www-form-urlencoded") ||
      ct.includes("multipart/form-data")
    ) {
      try {
        const form = await request.formData();
        token = String(form.get("token") || "");
      } catch {
        token = "";
      }
    } else if (ct.includes("application/json")) {
      try {
        const body = await request.json();
        token = String(body?.token || "");
      } catch {
        token = "";
      }
    }
    if (!token) token = url.searchParams.get("token") || "";
    if (!token || !/^[a-f0-9]{32,128}$/.test(token)) return loginError("invalid_token");
    const row = await dbConsumeMagicToken(env, token);
    if (!row) return loginError("token_expired");
    const userId = await dbUpsertEmailUser(env, row.email);
    return loginSuccess(request, env, userId, row.redirect_to);
  }

  return json({ error: "method_not_allowed" }, { status: 405 });
}

// Token is regex-validated to /^[a-f0-9]{32,128}$/ upstream, so it is safe to
// embed unescaped inside an HTML attribute.
function renderConfirmPage(token) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Confirm sign-in &middot; aeon&middot;terminal</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<style>
:root{--bg:#0a0805;--card:#15110a;--fg:#f0e8da;--muted:#a89e8a;--accent:#FF6B1A;--border:rgba(255,107,26,.18)}
*{box-sizing:border-box}
html,body{margin:0;background:var(--bg);color:var(--fg);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;line-height:1.6;min-height:100%}
body{display:flex;align-items:center;justify-content:center;padding:24px}
main{max-width:480px;width:100%;background:var(--card);border:1px solid var(--border);border-radius:12px;padding:28px}
.prompt{color:var(--accent);font-size:13px;letter-spacing:.04em;margin:0 0 18px;opacity:.85}
h1{font-size:22px;margin:0 0 14px;font-weight:600;letter-spacing:.01em}
p{margin:0 0 16px;font-size:14px}
strong{color:var(--accent);font-weight:600}
form{display:flex;align-items:center;flex-wrap:wrap;gap:14px;margin:18px 0 0}
.btn{display:inline-block;padding:12px 22px;background:var(--accent);color:var(--bg);font-family:inherit;font-size:14px;font-weight:600;border:0;border-radius:8px;cursor:pointer;letter-spacing:.02em}
.btn:hover{filter:brightness(1.08)}
.cancel{color:var(--muted);font-size:13px;text-decoration:none;border-bottom:1px dashed var(--muted)}
.cancel:hover{color:var(--fg)}
.note{margin-top:22px;font-size:12px;color:var(--muted);line-height:1.55}
</style>
</head>
<body>
<main>
  <p class="prompt">$ aeon login --confirm</p>
  <h1>Finish signing in</h1>
  <p>Click below to complete sign-in to <strong>aeon&middot;terminal</strong>. Your one-time token is consumed only after you click.</p>
  <form method="POST" action="/api/auth/email/verify">
    <input type="hidden" name="token" value="${token}">
    <button type="submit" class="btn">$ confirm sign-in &rarr;</button>
    <a class="cancel" href="/login">cancel</a>
  </form>
  <p class="note">this two-step prevents email link scanners (gmail, slack, imessage, outlook) from burning your single-use token before you click. the link expires 15 minutes after request.</p>
</main>
</body>
</html>`;
}

async function sendMagicLink(env, email, link) {
  const from = env.EMAIL_FROM || "Aeon Terminal <login@aeonterminal.org>";
  const subject = "Sign in to Aeon Terminal";
  const text = `Click to finish signing in:\n\n${link}\n\nThe link expires in 15 minutes. If you didn't request this, ignore this email.`;
  const html = `<!doctype html>
<html><body style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:#0a0805;color:#f0e8da;padding:32px;margin:0;">
<div style="max-width:480px;margin:0 auto;background:#15110a;border:1px solid rgba(255,107,26,.18);border-radius:12px;padding:24px;">
<h1 style="font-size:18px;margin:0 0 16px;color:#FF6B1A;letter-spacing:.04em;">&gt;_ aeon&middot;terminal</h1>
<p style="margin:0 0 16px;font-size:14px;line-height:1.6;">Click below to sign in.</p>
<p style="margin:0 0 24px;"><a href="${link}" style="display:inline-block;padding:10px 18px;background:#FF6B1A;color:#0a0805;text-decoration:none;border-radius:6px;font-weight:600;">Sign in</a></p>
<p style="margin:0;font-size:12px;color:#a89e8a;">Or copy this link:</p>
<p style="margin:6px 0 16px;font-size:11px;color:#a89e8a;word-break:break-all;">${link}</p>
<p style="margin:0;font-size:12px;color:#a89e8a;">Expires in 15 minutes. Ignore if you didn't request it.</p>
</div></body></html>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ from, to: [email], subject, text, html }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return { ok: false, detail: `${res.status}: ${detail}` };
  }
  return { ok: true };
}

// --- shared OAuth helpers ---

function buildOAuthRedirectUri(provider) {
  // Provider config registers exactly one redirect_uri so always use canonical.
  return `https://${CANONICAL_HOST}/api/auth/${provider}/callback`;
}

function sanitizeReturnPath(p) {
  if (!p || typeof p !== "string") return null;
  if (!p.startsWith("/")) return null;
  if (p.startsWith("//") || p.startsWith("/\\")) return null;
  if (p.length > 200) return null;
  return p;
}

async function loginSuccess(request, env, userId, redirectTo) {
  const { token, expires } = await dbCreateSession(env, userId, request);
  const target = `https://${CANONICAL_HOST}${redirectTo || AUTH_REDIRECT_AFTER_LOGIN}`;
  return new Response(null, {
    status: 302,
    headers: {
      location: target,
      "set-cookie": sessionCookieHeader(token, expires),
    },
  });
}

function loginError(code) {
  const target = `https://${CANONICAL_HOST}/login?error=${encodeURIComponent(code)}`;
  return Response.redirect(target, 302);
}

// --- /api/me, /api/auth/logout ---

async function handleMe(request, env) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const user = await currentUser(request, env);
  if (!user) return json({ user: null });
  let tier = null;
  try {
    tier = await resolveUserTier(env, user);
  } catch {
    tier = null;
  }
  let usage = null;
  try {
    usage = await dbGetUsage(env, user.id, tier ? tier.tier : user.plan);
  } catch {
    // ignore
  }
  return json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
      provider: user.primary_provider,
      plan: user.plan,
    },
    tier,
    usage,
  });
}

// --- API: /api/skills (user-defined skills) ---

async function handleUserSkills(request, env) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (!hasDb(env)) return json({ error: "db_not_configured" }, { status: 503 });
  await ensureSchema(env);

  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method === "GET" && path === "/api/skills") {
    const user = await currentUser(request, env);
    const includePublic = url.searchParams.get("public") !== "0";
    const mineRows = user ? await dbListUserSkillsByUser(env, user.id) : [];
    const publicRows = includePublic ? await dbListPublicUserSkills(env, 20) : [];
    const mine = mineRows.map((r) => serializeUserSkill(r));
    const publicList = publicRows
      .filter((r) => !user || r.user_id !== user.id)
      .map((r) => serializeUserSkill(r));
    const tier = user ? await resolveUserTier(env, user) : null;
    const limit = user ? customSkillLimit(tier ? tier.tier : user.plan) : null;
    return json({
      mine,
      public: publicList,
      quota: user
        ? {
            used: mine.length,
            limit,
            plan: user.plan,
            tier: tier ? tier.tier : user.plan,
            tier_source: tier ? tier.source : "plan",
          }
        : null,
    });
  }

  if (request.method === "POST" && path === "/api/skills") {
    const user = await currentUser(request, env);
    if (!user) return json({ error: "sign_in_required" }, { status: 401 });
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "bad_json" }, { status: 400 });
    }
    const validation = validateUserSkillInput(body || {});
    if (!validation.ok) {
      return json({ error: "invalid_input", message: validation.error }, { status: 400 });
    }
    const count = await dbCountUserSkills(env, user.id);
    const tier = await resolveUserTier(env, user);
    const limit = customSkillLimit(tier.tier);
    if (count >= limit) {
      const label = tier.source === "holder" ? "holder" : tier.tier;
      return json(
        {
          error: "quota_exceeded",
          message: `You have ${count}/${limit} custom skills on the ${label} tier. Delete one${tier.tier === "free" ? " or hold $aeonterminal to unlock more" : ""}.`,
        },
        { status: 429 },
      );
    }
    try {
      const row = await dbCreateUserSkill(env, user.id, validation.value);
      return json({
        ok: true,
        skill: serializeUserSkill(row, { includePersona: true }),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/UNIQUE constraint/i.test(msg)) {
        return json(
          {
            error: "slug_taken",
            message: `you already have a skill with slug '${validation.value.slug}'`,
          },
          { status: 409 },
        );
      }
      return json({ error: "create_failed", message: msg }, { status: 500 });
    }
  }

  const idMatch = path.match(/^\/api\/skills\/([A-Za-z0-9_-]+)$/);
  if (idMatch) {
    const id = idMatch[1];
    const row = await dbGetUserSkillById(env, id);
    if (!row) return json({ error: "not_found" }, { status: 404 });
    const user = await currentUser(request, env);
    const isOwner = !!user && row.user_id === user.id;
    if (request.method === "GET") {
      if (!isOwner && row.visibility !== "public") {
        return json({ error: "not_accessible" }, { status: 403 });
      }
      return json({
        skill: serializeUserSkill(row, {
          includeOwner: true,
          includePersona: isOwner,
        }),
      });
    }
    if (request.method === "DELETE") {
      if (!user) return json({ error: "sign_in_required" }, { status: 401 });
      if (!isOwner) return json({ error: "not_owner" }, { status: 403 });
      await dbDeleteUserSkill(env, user.id, id);
      return json({ ok: true });
    }
  }

  return json({ error: "method_not_allowed" }, { status: 405 });
}

async function handleLogout(request, env) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const cookies = parseCookies(request);
  const token = cookies[SESSION_COOKIE];
  if (token && hasDb(env)) {
    try {
      await dbDeleteSession(env, token);
    } catch {
      // ignore
    }
  }
  if (request.method === "POST") {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        ...CORS,
        "content-type": "application/json",
        "set-cookie": clearSessionCookieHeader(),
      },
    });
  }
  return new Response(null, {
    status: 302,
    headers: {
      location: `https://${CANONICAL_HOST}/`,
      "set-cookie": clearSessionCookieHeader(),
    },
  });
}

function trunc(s, n) {
  if (typeof s !== "string") return "";
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

// Build the messages array for Claude: prepend prior turns (ask mode only)
// so the model has conversational continuity.
function injectAskHistory(messages, turns) {
  if (!turns || turns.length === 0) return messages;
  const prefix = [];
  for (const t of turns.slice(-MEM_MAX_TURNS)) {
    if (t.user) prefix.push({ role: "user", content: String(t.user) });
    if (t.assistant)
      prefix.push({ role: "assistant", content: String(t.assistant) });
  }
  return [...prefix, ...messages];
}

// For run mode, fold prior runs of the same skill into the system prompt so
// the model can avoid repeating itself.
function appendRunContext(system, runs, skillSlug) {
  if (!runs || runs.length === 0) return system;
  const sameSkill = runs.filter((r) => r.skill === skillSlug).slice(-3);
  if (sameSkill.length === 0) return system;
  const summaries = sameSkill
    .map((r, i) => `${i + 1}. (${r.ts ?? "prev"}) ${trunc(r.summary, 240)}`)
    .join("\n");
  return `${system}\n\nRecent runs of this skill in the current session (avoid duplicating points the user already saw):\n${summaries}`;
}

function previewArgs(input) {
  if (!input || typeof input !== "object") return "";
  if (typeof input.url === "string") return input.url.slice(0, 80);
  try {
    return JSON.stringify(input).slice(0, 80);
  } catch {
    return "";
  }
}

const CANONICAL_HOST = "aeonterminal.org";

const HOST_REDIRECTS = {
  // terminal.aeonterminal.org → aeonterminal.org/terminal/ (apex landing on /terminal)
  "terminal.aeonterminal.org": "/terminal/",
};

function redirectToCanonical(url, basePath) {
  const target = new URL(url.toString());
  target.hostname = CANONICAL_HOST;
  target.port = "";
  if (basePath && (url.pathname === "/" || url.pathname === "")) {
    target.pathname = basePath;
  }
  return Response.redirect(target.toString(), 302);
}

// ---------------------------------------------------------------------------
// /api/status — public health & usage signals.
//
// Public (unauthenticated). Cached 30s at the edge via Cache-Control. All
// numbers come from the same D1 tables the rest of the app writes to (no
// fudged data, no demo numbers). Skill-activity timestamps are pulled from
// memory_runs which is capped at LATEST_RUNS_KEEP per user, so it reflects
// "recent activity" rather than lifetime counts — labelled accordingly in
// the payload.
// ---------------------------------------------------------------------------
async function probeWithTimeout(label, fn, timeoutMs = 2500) {
  const start = Date.now();
  try {
    const result = await Promise.race([
      fn(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), timeoutMs),
      ),
    ]);
    return {
      ok: true,
      latency_ms: Date.now() - start,
      ...(typeof result === "object" && result ? result : {}),
    };
  } catch (e) {
    return {
      ok: false,
      latency_ms: Date.now() - start,
      error: (e && e.message) || String(e),
    };
  }
}

async function handleStatus(request, env) {
  if (request.method !== "GET") {
    return json({ error: "method_not_allowed" }, { status: 405 });
  }
  const startedAt = Date.now();
  const now = nowSec();
  const today = utcDay(now);

  await ensureSchema(env);

  const liveSkillSlugs = Object.entries(SKILL_REGISTRY)
    .filter(([, v]) => !v.comingSoon)
    .map(([k]) => k);
  const totalSkills = Object.keys(SKILL_REGISTRY).length;

  const probes = {
    d1: await probeWithTimeout("d1", async () => {
      const row = await env.DB.prepare("SELECT 1 AS ok").first();
      return { result: row && row.ok === 1 ? "pong" : "unexpected" };
    }),
    base_rpc: await probeWithTimeout("base_rpc", async () => {
      const blockHex = await rpcCall(env, "eth_blockNumber", []);
      return { block_number: Number.parseInt(blockHex, 16) };
    }),
    dexscreener: await probeWithTimeout("dexscreener", async () => {
      const res = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${TOKEN_CONTRACT_ADDRESS}`,
        { cf: { cacheTtl: 0 } },
      );
      if (!res.ok) throw new Error(`http_${res.status}`);
      return {};
    }),
    github: await probeWithTimeout("github", async () => {
      // GitHub's API rejects requests without a User-Agent header and applies
      // strict per-IP rate limits to anonymous worker traffic. Hitting the
      // repo we already render on the home page keeps the probe meaningful.
      const res = await fetch(
        "https://api.github.com/repos/aeonterminal/aeon-terminal",
        {
          headers: {
            "user-agent": "aeonterminal-status/1.0 (+https://aeonterminal.org/status)",
            accept: "application/vnd.github+json",
          },
          cf: { cacheTtl: 0 },
        },
      );
      if (!res.ok) throw new Error(`http_${res.status}`);
      return {};
    }),
  };

  const [askRow, runRow, usersRow, walletsRow, activeRow, usersDayRow, runsByRow] =
    await Promise.all([
      env.DB.prepare(
        `SELECT COALESCE(SUM(asks), 0) AS s FROM usage_daily WHERE day = ?`,
      )
        .bind(today)
        .first(),
      env.DB.prepare(
        `SELECT COALESCE(SUM(runs), 0) AS s FROM usage_daily WHERE day = ?`,
      )
        .bind(today)
        .first(),
      env.DB.prepare(`SELECT COUNT(*) AS c FROM users`).first(),
      env.DB.prepare(`SELECT COUNT(*) AS c FROM user_wallets`).first(),
      env.DB.prepare(
        `SELECT COUNT(*) AS c FROM usage_daily WHERE day = ? AND (asks > 0 OR runs > 0)`,
      )
        .bind(today)
        .first(),
      env.DB.prepare(
        `SELECT COUNT(*) AS c FROM users WHERE created_at >= ?`,
      )
        .bind(now - 86400)
        .first(),
      env.DB.prepare(
        `SELECT skill, COUNT(*) AS n, MAX(created_at) AS last_at
           FROM memory_runs WHERE skill IS NOT NULL AND skill <> ''
           GROUP BY skill ORDER BY last_at DESC`,
      ).all(),
    ]);

  const skillStats = new Map();
  if (runsByRow && Array.isArray(runsByRow.results)) {
    for (const row of runsByRow.results) {
      skillStats.set(row.skill, {
        recent_runs: row.n,
        last_at: row.last_at,
      });
    }
  }
  const skillsRecent = liveSkillSlugs.map((slug) => {
    const stat = skillStats.get(slug);
    return {
      slug,
      last_at: stat ? stat.last_at : null,
      last_ago_sec: stat ? Math.max(0, now - stat.last_at) : null,
      recent_runs: stat ? stat.recent_runs : 0,
    };
  });

  const counters = {
    users_total: usersRow ? usersRow.c : 0,
    users_24h: usersDayRow ? usersDayRow.c : 0,
    wallets_linked: walletsRow ? walletsRow.c : 0,
    asks_today: askRow ? askRow.s : 0,
    runs_today: runRow ? runRow.s : 0,
    active_today: activeRow ? activeRow.c : 0,
  };

  const allOk = Object.values(probes).every((p) => p.ok);
  const payload = {
    ok: allOk,
    now,
    now_iso: new Date(now * 1000).toISOString(),
    day: today,
    probes,
    counters,
    skills: {
      total: totalSkills,
      live: liveSkillSlugs.length,
      coming_soon: totalSkills - liveSkillSlugs.length,
      recent: skillsRecent,
      recent_note:
        "memory_runs is capped per-user, so recent_runs reflects last-N activity per account rather than lifetime counts.",
    },
    took_ms: Date.now() - startedAt,
  };

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      // Edge-cache 30s, allow stale for 60s while revalidating
      "cache-control":
        "public, max-age=30, s-maxage=30, stale-while-revalidate=60",
    },
  });
}

async function handleMemory(request, env) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...CORS,
        "access-control-allow-methods": "GET, DELETE, OPTIONS",
      },
    });
  }

  if (!hasDb(env)) {
    if (request.method === "GET") {
      return json({ enabled: false, reason: "db_not_configured", turns: [], runs: [] });
    }
    return json({ error: "db_not_configured" }, { status: 503 });
  }

  const user = await currentUser(request, env);
  if (!user) {
    if (request.method === "GET") {
      return json({ enabled: false, reason: "not_signed_in", turns: [], runs: [] });
    }
    return json({ error: "unauthorized" }, { status: 401 });
  }

  if (request.method === "GET") {
    const mem = await dbGetMemory(env, user.id);
    return json({ enabled: true, turns: mem.turns, runs: mem.runs });
  }
  if (request.method === "DELETE") {
    await dbClearMemory(env, user.id);
    return json({ enabled: true, ok: true });
  }
  return json({ error: "method_not_allowed" }, { status: 405 });
}

const worker = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Auth + API endpoints served on canonical apex only (we redirect
    // brand subdomains to apex below, before routing).
    if (path === "/api/exec") return handleExec(request, env);
    if (path === "/api/memory") return handleMemory(request, env);
    if (path === "/api/me") return handleMe(request, env);
    if (path === "/api/status") return handleStatus(request, env);
    if (path === "/api/skills" || path.startsWith("/api/skills/")) {
      return handleUserSkills(request, env);
    }
    if (path === "/api/auth/logout") return handleLogout(request, env);
    if (path === "/api/auth/google/login") return handleGoogleLogin(request, env);
    if (path === "/api/auth/google/callback") return handleGoogleCallback(request, env);
    if (path === "/api/auth/github/login") return handleGithubLogin(request, env);
    if (path === "/api/auth/github/callback") return handleGithubCallback(request, env);
    if (path === "/api/auth/email/request") return handleEmailRequest(request, env);
    if (path === "/api/auth/email/verify") return handleEmailVerify(request, env);
    if (path === "/api/wallet/nonce" || path === "/api/wallet/verify" ||
        path === "/api/wallet/me" || path === "/api/wallet/refresh") {
      return handleWallet(request, env);
    }

    // Brand subdomains: redirect to canonical apex so we have one source of truth.
    const hostRule = HOST_REDIRECTS[url.hostname];
    if (hostRule !== undefined) {
      return redirectToCanonical(url, hostRule);
    }

    return env.ASSETS.fetch(request);
  },
};

export default worker;
