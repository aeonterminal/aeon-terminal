"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

// Hero terminal — auto-types real Aeon Terminal command syntax (the same
// commands `/terminal` accepts) and streams realistic Claude-shaped
// responses including the `» tool_name` lines that appear in actual runs.
// Loops so the landing page stays alive without a one-shot dead end. Honors
// `prefers-reduced-motion` by rendering the full transcript at once with no
// animation (per AGENTS.md style guide).

type Tone = "info" | "ok" | "warn" | "muted" | "tool";
type LineKind = "cmd" | "out" | "spacer";

type RenderedLine = { kind: LineKind; text: string; tone?: Tone };

type Demo = {
  cmd: string;
  outputs: Array<{ text: string; tone?: Tone }>;
};

// Three realistic demo runs — `ask` (free-form Claude), `run morning-brief`
// (canonical scheduled skill, tool calls + structured output), `run
// github-monitor <repo>` (live data probe + insight). Output text is
// representative of what these skills actually produce on /terminal; it's
// pre-rendered here so the landing page doesn't burn Anthropic / GitHub
// quota on every visitor.
const DEMOS: Demo[] = [
  {
    cmd: 'ask "what is aeon terminal?"',
    outputs: [
      {
        text: "A terminal-first control surface for AI agents.",
        tone: "info",
      },
      {
        text: "Sign in, run one of 19 live skills, or just ask anything",
      },
      {
        text: "with Claude + live web tools. Memory persists across",
      },
      {
        text: "sessions. Holders unlock paid quota by holding $aeonterminal.",
      },
    ],
  },
  {
    cmd: "run morning-brief",
    outputs: [
      { text: "» web.search   morning intel feeds", tone: "tool" },
      { text: "» http.get     hn.algolia.com/api/v1/...", tone: "tool" },
      { text: "» http.get     news.ycombinator.com/rss", tone: "tool" },
      { text: "" },
      { text: "─ brief · 2026-02-24 ─────────────────", tone: "muted" },
      { text: "• devin 1.5 ships native MCP support", tone: "info" },
      { text: "• vercel ship-day · turbopack stable", tone: "info" },
      { text: "• arxiv 2602.0123 · scaling laws update", tone: "info" },
      { text: "" },
      { text: "✓ brief ready · 312w · cost $0.011", tone: "ok" },
    ],
  },
  {
    cmd: "run github-monitor aaronjmars/aeon",
    outputs: [
      { text: "» http.get     api.github.com/repos/...", tone: "tool" },
      { text: "» http.get     api.github.com/repos/.../pulls", tone: "tool" },
      { text: "" },
      { text: "✓ repo · 1.4k stars · last commit 3h ago", tone: "ok" },
      { text: "✓ activity · 12 commits / wk · 3 open PRs", tone: "ok" },
      { text: "→ review #142: LLM-augmented init flow", tone: "info" },
    ],
  },
];

const CHAR_DELAY_CMD = 32; // ms per character typing a command
const CHAR_DELAY_OUT = 5; // ms per character streaming an output line
const ENTER_PAUSE = 280; // delay between command finished and output start
const LINE_PAUSE = 90; // pause between output lines
const DEMO_GAP = 1100; // pause after a demo before starting the next
const LOOP_RESET = 2400; // pause after final demo before clearing + looping

// Subscribed via useSyncExternalStore so we don't trigger the
// react-hooks/set-state-in-effect rule (and so we get the correct value
// before the first paint on the client).
function subscribeReducedMotion(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function getReducedMotionSnapshot(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getReducedMotionServerSnapshot(): boolean {
  // Default to animated for SSR — matches the most common case.
  return false;
}

// Pre-rendered full transcript used for prefers-reduced-motion users (and
// any visitor whose JS hasn't booted the animation yet).
const STATIC_TRANSCRIPT: RenderedLine[] = (() => {
  const all: RenderedLine[] = [];
  for (const demo of DEMOS) {
    all.push({ kind: "cmd", text: demo.cmd });
    for (const out of demo.outputs) {
      all.push({ kind: "out", text: out.text, tone: out.tone });
    }
    all.push({ kind: "spacer", text: "" });
  }
  return all;
})();

export function HeroTerminal() {
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );
  const [lines, setLines] = useState<RenderedLine[]>([]);
  const [activeText, setActiveText] = useState("");
  const [activeKind, setActiveKind] = useState<LineKind>("cmd");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reduced-motion users see the full transcript at once; the animation
  // loop never starts for them.
  const displayed = useMemo(
    () => (reducedMotion ? STATIC_TRANSCRIPT : lines),
    [reducedMotion, lines],
  );

  useEffect(() => {
    if (reducedMotion) return;
    let cancelled = false;

    async function run() {
      // Reset state inside the async run() (not directly in the effect body)
      // so a reduced-motion → animated toggle doesn't append onto a stale
      // transcript from the previous run.
      setLines([]);
      setActiveText("");
      // Outer loop: never stops, lands the page in a permanent demo state.
      while (!cancelled) {
        for (let demoIdx = 0; demoIdx < DEMOS.length; demoIdx++) {
          if (cancelled) return;
          const demo = DEMOS[demoIdx];

          // Type the command character by character.
          setActiveKind("cmd");
          for (let c = 0; c < demo.cmd.length; c++) {
            if (cancelled) return;
            setActiveText(demo.cmd.slice(0, c + 1));
            // Small jitter so the typing doesn't feel robotic.
            await sleep(CHAR_DELAY_CMD + Math.floor(Math.random() * 22));
          }
          // Commit the command line, then pause as if the user hit Enter.
          setLines((prev) => [...prev, { kind: "cmd", text: demo.cmd }]);
          setActiveText("");
          await sleep(ENTER_PAUSE);

          // Stream each output line. Empty lines render as spacers (no
          // character animation, just a short pause for breathing room).
          setActiveKind("out");
          for (const out of demo.outputs) {
            if (cancelled) return;
            if (out.text === "") {
              setLines((prev) => [
                ...prev,
                { kind: "spacer", text: "", tone: out.tone },
              ]);
              await sleep(LINE_PAUSE);
              continue;
            }
            for (let c = 0; c < out.text.length; c++) {
              if (cancelled) return;
              setActiveText(out.text.slice(0, c + 1));
              await sleep(CHAR_DELAY_OUT);
            }
            setLines((prev) => [
              ...prev,
              { kind: "out", text: out.text, tone: out.tone },
            ]);
            setActiveText("");
            await sleep(LINE_PAUSE);
          }
          // Visual gap between demos.
          setLines((prev) => [...prev, { kind: "spacer", text: "" }]);
          await sleep(demoIdx === DEMOS.length - 1 ? LOOP_RESET : DEMO_GAP);
        }
        // End of loop — clear the panel and start over so the page stays
        // visibly alive without becoming a wall of stale transcript.
        if (cancelled) return;
        setLines([]);
        setActiveText("");
        await sleep(450);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [reducedMotion]);

  // Keep the latest line in view as content scrolls past the panel height.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }, [lines, activeText, reducedMotion]);

  return (
    <div
      ref={scrollRef}
      className="no-scrollbar relative h-[340px] overflow-y-auto bg-[#050708] px-4 py-3 text-[12px] leading-6 sm:h-[420px] sm:px-5 sm:text-[13px]"
    >
      {displayed.map((l, i) => (
        <LineRow key={i} kind={l.kind} text={l.text} tone={l.tone} />
      ))}
      {!reducedMotion ? (
        <LineRow kind={activeKind} text={activeText} typing />
      ) : null}
    </div>
  );
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function LineRow({
  kind,
  text,
  tone,
  typing,
}: {
  kind: LineKind;
  text: string;
  tone?: Tone;
  typing?: boolean;
}) {
  if (kind === "spacer") {
    return <div className="h-2" aria-hidden />;
  }
  const toneClass =
    tone === "ok"
      ? "text-accent-2"
      : tone === "info"
        ? "text-foreground"
        : tone === "warn"
          ? "text-amber"
          : tone === "muted"
            ? "text-muted"
            : tone === "tool"
              ? "text-accent"
              : "text-foreground";

  if (kind === "cmd") {
    return (
      <div className="flex">
        <span className="select-none text-accent">{">"}&nbsp;</span>
        <span className="whitespace-pre-wrap text-foreground">{text}</span>
        {typing ? <span className="caret" aria-hidden /> : null}
      </div>
    );
  }
  return (
    <div className={`pl-3 ${toneClass}`}>
      <span className="whitespace-pre-wrap">{text}</span>
      {typing && text.length > 0 ? (
        <span className="caret" aria-hidden />
      ) : null}
    </div>
  );
}
