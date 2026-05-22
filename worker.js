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

const SKILL_REGISTRY = {
  "morning-brief": {
    name: "morning-brief",
    summary:
      "A focused, voice-matched briefing of the world before you open your laptop.",
    persona:
      "Produce a 6-8 bullet morning briefing: 2 tech, 2 markets, 1 culture, 1 inbox-style nudge. Use the read_rss tool on https://hnrss.org/frontpage and https://feeds.bbci.co.uk/news/world/rss.xml to pull real headlines, then synthesize. Keep each bullet to one line.",
  },
  "deep-research": {
    name: "deep-research",
    summary:
      "Multi-pass investigation of a topic with sourced claims and citations.",
    persona:
      "If the user gave a URL, fetch_url it; otherwise infer a topic from the prompt and either fetch a relevant authoritative source or generate from knowledge. Output a one-line topic restatement, 3 numbered findings with citations (URL + source), and one open question.",
  },
  "paper-digest": {
    name: "paper-digest",
    summary: "Arxiv + Hugging Face papers, filtered to what matters this week.",
    persona:
      "Call read_rss on http://export.arxiv.org/rss/cs.AI to get the latest AI papers. Pick 3 most interesting, output title + arxiv link + one-line takeaway each. End with 'Skim queue: <n> · Read queue: 3'.",
  },
  "hacker-news-digest": {
    name: "hacker-news-digest",
    summary: "Top stories with takes, not just links. Three minute read.",
    persona:
      "Call read_rss on https://hnrss.org/frontpage?count=15 to pull real HN headlines. Pick 4 top stories, list each with a snarky-but-useful one-line take. End with 'Skipped: <n> low-signal'.",
  },
  "rss-digest": {
    name: "rss-digest",
    summary: "Roll up any RSS feed into a single coherent thread.",
    persona:
      "Expect a feed URL in the prompt. Call read_rss on it. Synthesize the latest 5 items into one 4-line narrative paragraph. If no URL given, use https://hnrss.org/frontpage as a fallback.",
  },
  "technical-explainer": {
    name: "technical-explainer",
    summary: "Convert a paper or PR into a clean explainer you can publish.",
    persona:
      "If a URL is provided, fetch_url it. Output: one-line hook, three 'what changed' lines, one 'why it matters' line. If no URL, pick a recent topic from knowledge.",
  },

  "pr-review": {
    name: "pr-review",
    summary:
      "Reviews PRs against project conventions. Leaves inline comments via gh.",
    persona:
      "If a GitHub PR URL is provided, fetch_url it and review actual code. Otherwise output a fake review of an imaginary PR: 'PR #1234 · /src/handler.ts'. List 3 inline comments with line numbers and a final verdict ('LGTM with nits' / 'Block: ' / etc).",
  },
  "github-monitor": {
    name: "github-monitor",
    summary:
      "Tracks issues, releases, stars, and trending across a watchlist of repos.",
    persona:
      "If a repo URL/path is in the prompt, fetch_url https://github.com/<repo> and summarize movement. Otherwise output 3 lines like 'aeonterminal/aeon-terminal +12★ · 1 release · 2 issues'.",
  },
  "auto-merge": {
    name: "auto-merge",
    summary: "Watches the merge queue. Lands ready PRs that pass policy and CI.",
    persona:
      "Output a fake merge ledger: 3-4 lines like '✓ merged #4521 · ci 2m18s · author kevin'. End with 'Queue depth: 0'.",
  },
  "code-health": {
    name: "code-health",
    summary: "Lints repo health: stale deps, dead routes, untyped surfaces.",
    persona:
      "Output: 'health 0.93' header, then 4 lines listing fictional issues with severity ('warn: 12 stale deps', 'err: 3 untyped exports', etc). End with a one-line suggestion.",
  },
  "vuln-scanner": {
    name: "vuln-scanner",
    summary: "Audits dependencies and CI workflows for known vulnerabilities.",
    persona:
      "Output a fake scan summary: 'scanned 218 deps · 1 high · 4 moderate'. List the high-severity item with a CVE-style ID and a one-line patch suggestion.",
  },
  "deploy-prototype": {
    name: "deploy-prototype",
    summary: "Spins up a Vercel preview from a description. Returns the URL.",
    persona:
      "Output: '» bootstrapping...' lines (3-4 steps), then '✓ deployed' with a fictional preview URL like 'aeon-prototype-xyz.vercel.app'.",
  },
  "create-skill": {
    name: "create-skill",
    summary:
      "Generates a new skill from a one-line description and registers it.",
    persona:
      "Output: '» drafting skill spec', then a small skill stub block (name, cron, 2-line prompt). End with '✓ registered to ./skills/'.",
  },

  "token-alert": {
    name: "token-alert",
    summary: "Watches a list of tokens; pings when momentum or unlocks shift.",
    persona:
      "Try fetch_url https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1&price_change_percentage=24h for real prices. Pick 3-4 movers with the largest 24h % change, output each like '$BTC +3.2% · vol 2.1× · price $67k'. End with a one-line read.",
  },
  "on-chain-monitor": {
    name: "on-chain-monitor",
    summary: "Watches wallets, contracts, and flows for material moves.",
    persona:
      "Output 3 fake lines like 'wallet 0x7f..a3  moved 412 ETH → cex (binance)' with a one-line read at the end.",
  },
  "defi-monitor": {
    name: "defi-monitor",
    summary:
      "TVL, yields, exploits — a continuous read on the DeFi landscape.",
    persona:
      "Try fetch_url https://api.llama.fi/protocols for real DeFi TVL. Pick 3 movers (biggest TVL change), output one line each. End with one yield-of-the-day fake line and one risk note.",
  },
  "unlock-monitor": {
    name: "unlock-monitor",
    summary: "Flags token unlocks before they hit, with float context.",
    persona:
      "Output 3 upcoming fake unlocks: 'TKN · 1.2M tokens · 4d · 3.4% of float'. End with a one-line risk read.",
  },
  "treasury-info": {
    name: "treasury-info",
    summary: "DAO treasury composition and burn-rate, plus recent movements.",
    persona:
      "Output: 'treasury $42.1M · 18mo runway' header, 3 composition lines, 1 burn line. End with one strategic note.",
  },

  "twitter-thread": {
    name: "twitter-thread",
    summary: "Drafts a thread from a topic in your voice.",
    persona:
      "Output 4 numbered tweets ('1/', '2/', etc), each ≤ 240 chars, voice-matched and confident. Skip emoji.",
  },
  "syndicate-article": {
    name: "syndicate-article",
    summary: "Push a new post across Twitter, Farcaster, LinkedIn, blog.",
    persona:
      "Output: '» fanning out post `<fake-slug>`'. Then 4 lines, one per platform ('✓ twitter · 1 thread', etc), with one warn line about a quirk.",
  },
  "auto-reply": {
    name: "auto-reply",
    summary: "Drafts thoughtful replies on your behalf, ranked by signal.",
    persona:
      "Output 3 fake mention summaries followed by a one-line draft reply each. End with 'sent: 0 · drafted: 3 · skipped: 7 (low signal)'.",
  },
  "campaign-tracker": {
    name: "campaign-tracker",
    summary: "Tracks engagement and trend curves for a launched campaign.",
    persona:
      "Output 4 fake metrics ('impressions 184k +12%', 'CTR 3.1%', etc), then a one-line read.",
  },
  "voice-tune": {
    name: "voice-tune",
    summary:
      "Refines outputs against your STYLE.md, learns from accepts/rejects.",
    persona:
      "Output: 3 short diffs of voice corrections (sentence A → sentence B) and a one-line summary like 'drift -0.04 · style match 0.93'.",
  },

  "daily-recap": {
    name: "daily-recap",
    summary:
      "End-of-day digest of what got done, what stalled, and what's next.",
    persona:
      "Output: 'shipped:' header with 3 bullets, 'stalled:' with 2 bullets, 'tomorrow:' with 3 bullets. Plain, no emoji.",
  },
  "weekly-review": {
    name: "weekly-review",
    summary: "Weekly retrospective: wins, regrets, signals, and pivots.",
    persona:
      "Output four sections — wins, regrets, signals, pivots — with 2 bullets each. Tone: dry, honest.",
  },
  "goal-coach": {
    name: "goal-coach",
    summary: "Tracks weekly OKRs and nudges when something falls behind.",
    persona:
      "Output 3 fake goals with progress bars ('███░░ 60%'), one bottleneck note, one nudge.",
  },
  "idea-capture": {
    name: "idea-capture",
    summary: "Captures shower ideas. Bundles them into themes weekly.",
    persona:
      "Output 'this week:' then 4 fake idea-and-theme one-liners. End with 'shipped: 1 · parked: 3'.",
  },
  "calendar-brief": {
    name: "calendar-brief",
    summary: "Briefs you before each meeting with context and a soft agenda.",
    persona:
      "Output: 'next: 14:00 with Lila · 30min'. Then 'context:' 2 lines, 'soft agenda:' 3 bullets. Last line: one-line outcome target.",
  },

  "skill-repair": {
    name: "skill-repair",
    summary:
      "When a skill fails, opens an issue, patches the file, and tests the fix.",
    persona:
      "Output: '» healing pr-review · last fail 3h ago'. Then 4 step lines (filed issue, patched prompt, ran fixture, verified). End with '✓ green'.",
  },
  heartbeat: {
    name: "heartbeat",
    summary: "Daily report on agent fleet health, costs, and skill audits.",
    persona:
      "Output: 'fleet 1/1 · uptime 18d' header, 4 stat lines (cost/day, error rate, slowest skill, p95). One-line read at the end.",
  },
  "skill-audit": {
    name: "skill-audit",
    summary: "Audits every skill weekly; suggests prompt and contract tweaks.",
    persona:
      "Output: '34 skills audited'. List 3 fake findings ('morning-brief: drift on weekends'), then a one-line action.",
  },
  "memory-prune": {
    name: "memory-prune",
    summary: "Curates long-term memory: archives noise, promotes signal.",
    persona:
      "Output: 'memory · 18.4MB' header, then 3 lines ('archived: 412 lines', 'promoted: 6 facts', 'merged: 3 entities'). End with 'cohesion +0.04'.",
  },
  "model-eval": {
    name: "model-eval",
    summary: "Periodically benchmarks alternate models for each skill.",
    persona:
      "Output: '12 skill-model pairs evaluated'. Then 3 fake results ('morning-brief · sonnet → haiku · q 0.94 · -38% cost'). End with 'auto-applied: 1'.",
  },
  "agent-soul": {
    name: "agent-soul",
    summary: "Studies your writing and updates SOUL.md / STYLE.md.",
    persona:
      "Output 4 fake voice notes ('you've started using semicolons more', etc) and 1 line summary 'STYLE.md updated · 3 edits'.",
  },
};

const SYSTEM_BASE = `You are running inside Aeon Terminal — a terminal-first
control surface for autonomous AI agents. Your output is rendered in a
monospace web terminal panel.

You have two real tools:
- fetch_url(url): Fetch any http/https URL and return up to ~5KB of body text.
- read_rss(url, limit?): Read an RSS or Atom feed; returns latest items
  with title, link, date, summary.

When real data exists, USE THE TOOLS. Do not fabricate when you can fetch.
Cite the URL you used.

Style rules (strict):
- Plain text only. No markdown headers (# or ##). No emoji.
- No chatty preamble. Get straight to output.
- Lines under ~90 chars. Total output under 22 lines.
- Use ASCII markers when natural: ✓ ✗ · » →
- If a fetch fails, say so briefly and continue with what you have.
- Do not refuse, do not add disclaimers, do not mention you are an AI.`;

function buildSystem(skillSlug, mode) {
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
      "Fetch the contents of an HTTP(S) URL and return the response body (HTML stripped, truncated to ~5KB). Use this for live web content, articles, JSON APIs, search results.",
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

async function toolFetchUrl(input) {
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
      headers: { "user-agent": "AeonTerminal/0.1 (+https://aeonterminal.org)" },
    });
    clearTimeout(timer);
    const ct = (res.headers.get("content-type") ?? "").toLowerCase();
    let body = await res.text();
    const originalLen = body.length;
    if (ct.includes("text/html") || /<html/i.test(body.slice(0, 200))) {
      body = stripHtml(body);
    }
    const truncated = body.slice(0, 5000);
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

async function runTool(name, input) {
  if (name === "fetch_url") return toolFetchUrl(input);
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
  const prompt = String(body.prompt ?? "").slice(0, 2000).trim();
  if (!prompt) return json({ error: "empty_prompt" }, { status: 400 });
  if (mode === "run" && (!skill || !SKILL_REGISTRY[skill])) {
    return json({ error: "unknown_skill" }, { status: 400 });
  }

  const ip = request.headers.get("cf-connecting-ip");
  const limit = await checkRateLimit(ip);
  if (!limit.ok) {
    return json(
      {
        error: "rate_limited",
        message: "30 requests/day per IP. Try tomorrow or self-host.",
      },
      { status: 429 },
    );
  }

  const sid = sanitizeSid(request.headers.get("x-session-id"));
  const kvOk = hasKv(env);
  const mem = await memRead(env, sid);

  let system = buildSystem(skill, mode);
  if (mode === "run") {
    system = appendRunContext(system, mem.runs, skill);
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
          const result = await runTool(block.name, block.input);
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
      // Persist memory only on successful completion when KV is wired up.
      // Failures and cancellations skip the write.
      if (completed && sid && kvOk) {
        try {
          const ts = new Date().toISOString().slice(0, 16).replace("T", " ");
          if (mode === "ask") {
            const turns = [
              ...mem.turns,
              {
                user: trunc(prompt, MEM_TRUNC_USER),
                assistant: trunc(finalAssistantText, MEM_TRUNC_ASSISTANT),
                ts,
              },
            ].slice(-MEM_MAX_TURNS);
            await memWrite(env, sid, "turns", turns);
          } else if (mode === "run") {
            const runs = [
              ...mem.runs,
              {
                skill,
                prompt: trunc(prompt, MEM_TRUNC_USER),
                summary: trunc(finalAssistantText, MEM_TRUNC_ASSISTANT),
                ts,
              },
            ].slice(-MEM_MAX_RUNS);
            await memWrite(env, sid, "runs", runs);
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

// --- session memory (optional, backed by KV) ---

// Session id is supplied by the browser via the X-Session-Id header. It is
// opaque to the worker; we only use it as a key prefix. Validate to keep
// KV keys bounded and printable.
function sanitizeSid(raw) {
  if (!raw || typeof raw !== "string") return null;
  const s = raw.trim();
  if (s.length < 8 || s.length > 64) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(s)) return null;
  return s;
}

const MEM_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const MEM_MAX_TURNS = 5;                  // ask: last N user/assistant pairs
const MEM_MAX_RUNS = 10;                  // run: last N skill executions (any skill)
const MEM_TRUNC_USER = 500;
const MEM_TRUNC_ASSISTANT = 1200;

function memKey(sid, kind) {
  return `mem:${sid}:${kind}`;
}

// A real KV namespace binding exposes get/put/delete as functions. If the
// binding was wired up as a plain text variable by mistake, env.AEON_MEMORY
// will be a string and these calls will throw. Guard up front.
function hasKv(env) {
  const kv = env && env.AEON_MEMORY;
  return (
    !!kv &&
    typeof kv === "object" &&
    typeof kv.get === "function" &&
    typeof kv.put === "function" &&
    typeof kv.delete === "function"
  );
}

async function memRead(env, sid) {
  if (!hasKv(env) || !sid) return { turns: [], runs: [] };
  try {
    const [turnsRaw, runsRaw] = await Promise.all([
      env.AEON_MEMORY.get(memKey(sid, "turns")),
      env.AEON_MEMORY.get(memKey(sid, "runs")),
    ]);
    const turns = turnsRaw ? JSON.parse(turnsRaw) : [];
    const runs = runsRaw ? JSON.parse(runsRaw) : [];
    return {
      turns: Array.isArray(turns) ? turns : [],
      runs: Array.isArray(runs) ? runs : [],
    };
  } catch {
    return { turns: [], runs: [] };
  }
}

async function memWrite(env, sid, kind, value) {
  if (!hasKv(env) || !sid) return;
  try {
    await env.AEON_MEMORY.put(memKey(sid, kind), JSON.stringify(value), {
      expirationTtl: MEM_TTL_SECONDS,
    });
  } catch {
    // swallow — memory is best-effort
  }
}

async function memClear(env, sid) {
  if (!hasKv(env) || !sid) return;
  try {
    await Promise.all([
      env.AEON_MEMORY.delete(memKey(sid, "turns")),
      env.AEON_MEMORY.delete(memKey(sid, "runs")),
    ]);
  } catch {
    // swallow
  }
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

async function handleMemory(request, env) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...CORS,
        "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
        "access-control-allow-headers": "content-type, x-session-id",
      },
    });
  }

  const sid = sanitizeSid(request.headers.get("x-session-id"));
  if (!sid) return json({ error: "bad_session_id" }, { status: 400 });

  if (!hasKv(env)) {
    // Either the binding is missing or it was wired up as the wrong type
    // (e.g. plain text variable). Surface a useful hint instead of pretending
    // memory works.
    const reason = !env.AEON_MEMORY
      ? "binding_missing"
      : "binding_not_kv";
    if (request.method === "GET")
      return json({ enabled: false, reason, turns: [], runs: [] });
    if (request.method === "DELETE")
      return json({ enabled: false, reason, ok: true });
    return json({ error: "method_not_allowed" }, { status: 405 });
  }

  if (request.method === "GET") {
    const mem = await memRead(env, sid);
    return json({ enabled: true, turns: mem.turns, runs: mem.runs });
  }
  if (request.method === "DELETE") {
    await memClear(env, sid);
    return json({ enabled: true, ok: true });
  }
  return json({ error: "method_not_allowed" }, { status: 405 });
}

const worker = {
  async fetch(request, env) {
    const url = new URL(request.url);

    // /api endpoints are served on every hostname (subdomain pages call them too)
    if (url.pathname === "/api/exec") return handleExec(request, env);
    if (url.pathname === "/api/memory") return handleMemory(request, env);

    // Brand subdomains: redirect to canonical apex so we have one source of truth.
    const hostRule = HOST_REDIRECTS[url.hostname];
    if (hostRule !== undefined) {
      return redirectToCanonical(url, hostRule);
    }

    return env.ASSETS.fetch(request);
  },
};

export default worker;
