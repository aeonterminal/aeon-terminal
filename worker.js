// Aeon Terminal Cloudflare Worker.
//
// Routes:
//   POST /api/exec   — proxy to Anthropic Claude, streams SSE back to the client.
//   *                — delegated to the static asset binding (out/).

const SKILL_REGISTRY = {
  "morning-brief": {
    name: "morning-brief",
    summary:
      "A focused, voice-matched briefing of the world before you open your laptop.",
    persona:
      "Produce a 6-8 bullet morning briefing: 2 tech bullets, 2 markets, 1 culture, 1 inbox-style nudge. Make up realistic but fictional details. Keep each bullet to one line.",
  },
  "deep-research": {
    name: "deep-research",
    summary:
      "Multi-pass investigation of a topic with sourced claims and citations.",
    persona:
      "Open with a one-line restatement of the topic, then 3 numbered findings with fictional but plausible citations like '(MIT Tech Review, Mar 2025)'. Close with one open question.",
  },
  "paper-digest": {
    name: "paper-digest",
    summary: "Arxiv + Hugging Face papers, filtered to what matters this week.",
    persona:
      "Output 3 fake but realistic paper titles in arxiv-style with a one-line takeaway each. Conclude with 'Skim queue: 12 · Read queue: 3'.",
  },
  "hacker-news-digest": {
    name: "hacker-news-digest",
    summary: "Top stories with takes, not just links. Three minute read.",
    persona:
      "List 4 fictional HN-style headlines with a snarky-but-useful one-line take after each. End with 'Skipped: 11 ragebait, 3 hiring posts'.",
  },
  "rss-digest": {
    name: "rss-digest",
    summary: "Roll up any RSS feed into a single coherent thread.",
    persona:
      "Synthesize 5 fictional feed items into one 4-line narrative paragraph. No bullet points.",
  },
  "technical-explainer": {
    name: "technical-explainer",
    summary: "Convert a paper or PR into a clean explainer you can publish.",
    persona:
      "Pick a plausible technical topic, then output: a one-line hook, three 'what changed' lines, one 'why it matters' line.",
  },

  "pr-review": {
    name: "pr-review",
    summary:
      "Reviews PRs against project conventions. Leaves inline comments via gh.",
    persona:
      "Output a fake review of an imaginary PR: 'PR #1234 · /src/handler.ts'. List 3 inline comments with line numbers and a final verdict line ('LGTM with nits' / 'Block: ' / etc).",
  },
  "github-monitor": {
    name: "github-monitor",
    summary:
      "Tracks issues, releases, stars, and trending across a watchlist of repos.",
    persona:
      "Output a fake repo movement digest: 3 lines like 'aeonterminal/aeon-terminal +12★ · 1 release · 2 issues'.",
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
      "Output 3-4 fake token movements like '$AERO  +8.4%  vol 2.1×  flow:in', with a one-line read on the strongest mover.",
  },
  "on-chain-monitor": {
    name: "on-chain-monitor",
    summary: "Watches wallets, contracts, and flows for material moves.",
    persona:
      "Output 3 lines like 'wallet 0x7f..a3  moved 412 ETH → cex (binance)' with a one-line read at the end.",
  },
  "defi-monitor": {
    name: "defi-monitor",
    summary:
      "TVL, yields, exploits — a continuous read on the DeFi landscape.",
    persona:
      "Output: 'TVL summary' line, 3 protocol lines with TVL deltas, one yield-of-the-day line, and one exploit/risk line.",
  },
  "unlock-monitor": {
    name: "unlock-monitor",
    summary: "Flags token unlocks before they hit, with float context.",
    persona:
      "Output 3 upcoming fake unlocks: 'TKN · 1.2M tokens · 4d · 3.4% of float', with a one-line risk read at the end.",
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
monospace web terminal panel. Style rules (strict):
- Plain text only. No markdown headers (#, ##). No emoji.
- No chatty preamble like "Sure!" or "Here is...". Get straight to output.
- Lines under ~80 chars. Total output under 20 lines.
- Use ASCII status markers when natural: ✓ ✗ · » →
- Never claim to have done real work (no real APIs were called). The user
  understands this is a demo — produce plausible, voice-matched mock output.
- Do not refuse, do not add disclaimers, do not mention you are an AI.`;

function buildSystem(skillSlug, mode) {
  const skill = skillSlug ? SKILL_REGISTRY[skillSlug] : null;
  if (mode === "run" && skill) {
    return `${SYSTEM_BASE}\n\nYou are the '${skill.name}' skill.\nPurpose: ${skill.summary}\nFormat: ${skill.persona}`;
  }
  return `${SYSTEM_BASE}\n\nThe user is exploring the Aeon Terminal demo through a free-form prompt. Respond like a terse, in-terminal assistant — informative, no fluff.`;
}

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
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
      { error: "rate_limited", message: "30 requests/day per IP. Try tomorrow or self-host." },
      { status: 429 },
    );
  }

  const system = buildSystem(skill, mode);

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system,
      stream: true,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => "");
    return json(
      { error: "upstream_error", status: upstream.status, message: errText.slice(0, 200) },
      { status: 502 },
    );
  }

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  (async () => {
    const reader = upstream.body.getReader();
    let buf = "";
    const emit = (obj) =>
      writer.write(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
    try {
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
          try {
            const evt = JSON.parse(payload);
            if (
              evt.type === "content_block_delta" &&
              evt.delta?.type === "text_delta" &&
              typeof evt.delta.text === "string"
            ) {
              if (evt.delta.text) await emit({ type: "text", delta: evt.delta.text });
            } else if (evt.type === "message_stop") {
              await emit({ type: "done", remaining: limit.remaining });
            }
          } catch {
            // ignore malformed chunk
          }
        }
      }
    } catch (err) {
      await emit({ type: "error", message: String(err).slice(0, 200) });
    } finally {
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

const worker = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/exec") return handleExec(request, env);
    return env.ASSETS.fetch(request);
  },
};

export default worker;
