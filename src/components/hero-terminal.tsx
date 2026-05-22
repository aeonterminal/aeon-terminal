"use client";

import { useEffect, useRef, useState } from "react";

type Tone = "info" | "ok" | "warn" | "muted";
type LineKind = "cmd" | "out";
type Line =
  | { kind: "cmd"; text: string }
  | { kind: "out"; text: string; tone?: Tone };

type RenderedLine = { kind: LineKind; text: string; tone?: Tone };

const SCRIPT: Line[] = [
  { kind: "cmd", text: "aeon init --voice ./soul" },
  { kind: "out", text: "✓ identity loaded · STYLE.md, SOUL.md", tone: "ok" },
  { kind: "cmd", text: "aeon skills enable morning-brief pr-review token-alert" },
  { kind: "out", text: "→ 3 skills enabled · 0 conflicts", tone: "info" },
  { kind: "cmd", text: "aeon schedule" },
  { kind: "out", text: "morning-brief    0 7  * * *   next: 07:00 UTC", tone: "muted" },
  { kind: "out", text: "pr-review        */15 * * * *  next: in 4m", tone: "muted" },
  { kind: "out", text: "token-alert      */10 * * * *  next: in 2m", tone: "muted" },
  { kind: "cmd", text: "aeon run morning-brief --dry" },
  { kind: "out", text: "» fetching feeds (12) · ranking · drafting...", tone: "info" },
  { kind: "out", text: "» voice match: 0.94 · length: 312w · cost: $0.011", tone: "info" },
  { kind: "out", text: "✓ brief ready — preview /outputs/morning-brief.md", tone: "ok" },
  { kind: "cmd", text: "aeon deploy" },
  { kind: "out", text: "✓ pushed to github · workflows live · idle", tone: "ok" },
];

const CHAR_DELAY = 28;
const LINE_DELAY = 160;

export function HeroTerminal() {
  const [lines, setLines] = useState<RenderedLine[]>([]);
  const [activeText, setActiveText] = useState("");
  const [activeKind, setActiveKind] = useState<LineKind>("cmd");
  const [done, setDone] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      await sleep(450);
      for (let i = 0; i < SCRIPT.length; i++) {
        if (cancelled) return;
        const ln = SCRIPT[i];
        setActiveKind(ln.kind);
        for (let c = 0; c < ln.text.length; c++) {
          if (cancelled) return;
          setActiveText(ln.text.slice(0, c + 1));
          await sleep(ln.kind === "cmd" ? CHAR_DELAY : 6);
        }
        const tone = ln.kind === "out" ? ln.tone : undefined;
        setLines((prev) => [...prev, { kind: ln.kind, text: ln.text, tone }]);
        setActiveText("");
        await sleep(LINE_DELAY);
      }
      setDone(true);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [lines, activeText]);

  return (
    <div
      ref={scrollRef}
      className="no-scrollbar relative h-[420px] overflow-y-auto bg-[#050708] px-4 py-3 text-[13px] leading-6 sm:px-5"
    >
      {lines.map((l, i) => (
        <LineRow key={i} kind={l.kind} text={l.text} tone={l.tone} />
      ))}
      {!done ? (
        <LineRow kind={activeKind} text={activeText} typing />
      ) : (
        <LineRow kind="cmd" text="" typing />
      )}
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
  const toneClass =
    tone === "ok"
      ? "text-accent"
      : tone === "info"
        ? "text-cyan"
        : tone === "warn"
          ? "text-amber"
          : tone === "muted"
            ? "text-muted"
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
    </div>
  );
}
