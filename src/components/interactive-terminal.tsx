"use client";

import {
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CATEGORIES, SKILLS, type Skill } from "@/lib/skills";

type Tone = "ok" | "info" | "warn" | "err" | "muted";
type Entry =
  | { kind: "cmd"; text: string }
  | { kind: "out"; text: string; tone?: Tone };

const HELP = `Available commands:
  help                       — show this help
  whoami                     — describe the active agent
  skills [category]          — list skills (filter by category)
  cat <skill>                — show a skill spec
  run <skill> [--dry]        — execute a skill (simulated)
  schedule                   — show the cron table for enabled skills
  enable <skill>             — enable a skill
  disable <skill>            — disable a skill
  notify "msg"               — fan out a notification
  status                     — fleet + skill health
  clear                      — clear the screen
  exit                       — disconnect (no-op)`;

const INITIAL: Entry[] = [
  {
    kind: "out",
    text: "aeon·terminal · v0.1.0 · session-0001",
    tone: "muted",
  },
  {
    kind: "out",
    text: "type 'help' for available commands.",
    tone: "muted",
  },
];

const DEFAULT_ENABLED = new Set([
  "morning-brief",
  "pr-review",
  "token-alert",
  "heartbeat",
  "skill-repair",
]);

export function InteractiveTerminal() {
  const [entries, setEntries] = useState<Entry[]>(INITIAL);
  const [input, setInput] = useState("");
  const [enabled, setEnabled] = useState<Set<string>>(
    () => new Set(DEFAULT_ENABLED),
  );
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState<number>(-1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const skillBySlug = useMemo(() => {
    const m = new Map<string, Skill>();
    for (const s of SKILLS) m.set(s.slug, s);
    return m;
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [entries]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const print = useCallback((text: string, tone?: Tone) => {
    setEntries((prev) => [...prev, { kind: "out", text, tone }]);
  }, []);

  const printCmd = useCallback((text: string) => {
    setEntries((prev) => [...prev, { kind: "cmd", text }]);
  }, []);

  const exec = useCallback(
    (raw: string) => {
      const cmd = raw.trim();
      printCmd(cmd);
      if (!cmd) return;
      setHistory((h) => [...h, cmd]);
      setHistoryIdx(-1);

      const tokens = tokenize(cmd);
      const [head, ...rest] = tokens;

      switch (head) {
        case "help":
          print(HELP, "muted");
          return;
        case "whoami":
          print("operator · plan: solo · region: lo-fi-1", "muted");
          print(
            "agent identity loaded from ./soul · voice: STYLE.md · memory: ./memory",
            "muted",
          );
          return;
        case "skills": {
          const filter = rest[0];
          const rows = SKILLS.filter((s) => !filter || s.category === filter);
          if (!rows.length) {
            print(`no skills match '${filter}'`, "warn");
            return;
          }
          for (const s of rows) {
            const on = enabled.has(s.slug);
            const cat = CATEGORIES[s.category].label.split(" ")[0];
            const dot = on ? "●" : "○";
            print(
              `${dot} ${pad(s.name, 26)}  ${pad(cat, 12)}  ${pad(s.cron ?? "-", 14)}  ${s.summary}`,
              on ? "ok" : "muted",
            );
          }
          print(
            `\n${rows.length} skill(s) · ${rows.filter((r) => enabled.has(r.slug)).length} enabled`,
            "muted",
          );
          return;
        }
        case "cat": {
          const slug = rest[0];
          const s = slug ? skillBySlug.get(slug) : undefined;
          if (!s) {
            print(`skill not found: ${slug ?? "<none>"}`, "err");
            return;
          }
          print(`# ${s.name}`, "info");
          print(`category : ${CATEGORIES[s.category].label}`, "muted");
          print(`cron     : ${s.cron ?? "—"}`, "muted");
          if (s.inputs?.length)
            print(`inputs   : ${s.inputs.join(", ")}`, "muted");
          if (s.outputs?.length)
            print(`outputs  : ${s.outputs.join(", ")}`, "muted");
          if (s.selfHealing) print("self-heal: yes", "muted");
          print("");
          print(s.summary);
          return;
        }
        case "run": {
          const slug = rest[0];
          const dry = rest.includes("--dry");
          const s = slug ? skillBySlug.get(slug) : undefined;
          if (!s) {
            print(`skill not found: ${slug ?? "<none>"}`, "err");
            return;
          }
          print(`» run ${s.name}${dry ? " (dry)" : ""}`, "info");
          print(`  · loaded soul · matched voice 0.${rand(88, 99)}`, "muted");
          print(`  · fetched context (${rand(3, 14)} sources)`, "muted");
          print(`  · drafted · ${rand(180, 520)}w · cost $0.0${rand(10, 90)}`,
            "muted");
          if (dry) {
            print(`✓ dry-run complete · output in .outputs/${s.slug}.md`, "ok");
          } else {
            print(
              `✓ ${s.name} ran · notified ${["telegram", "discord", "slack"][rand(0, 2)]}`,
              "ok",
            );
          }
          return;
        }
        case "schedule": {
          const rows = SKILLS.filter((s) => enabled.has(s.slug));
          if (!rows.length) {
            print("no enabled skills", "muted");
            return;
          }
          for (const s of rows) {
            print(
              `${pad(s.name, 26)}  ${pad(s.cron ?? "-", 14)}  next: ${nextRun()}`,
              "muted",
            );
          }
          return;
        }
        case "enable": {
          const slug = rest[0];
          const s = slug ? skillBySlug.get(slug) : undefined;
          if (!s) {
            print(`skill not found: ${slug ?? "<none>"}`, "err");
            return;
          }
          setEnabled((prev) => new Set(prev).add(s.slug));
          print(`✓ enabled ${s.name}`, "ok");
          return;
        }
        case "disable": {
          const slug = rest[0];
          const s = slug ? skillBySlug.get(slug) : undefined;
          if (!s) {
            print(`skill not found: ${slug ?? "<none>"}`, "err");
            return;
          }
          setEnabled((prev) => {
            const next = new Set(prev);
            next.delete(s.slug);
            return next;
          });
          print(`· disabled ${s.name}`, "warn");
          return;
        }
        case "notify": {
          const msg = rest.join(" ").replace(/^['"]|['"]$/g, "");
          if (!msg) {
            print("usage: notify \"your message\"", "warn");
            return;
          }
          print(`» fan out to telegram, discord, slack`, "info");
          print(`✓ delivered · ${msg}`, "ok");
          return;
        }
        case "status": {
          const total = SKILLS.length;
          const on = enabled.size;
          print(`fleet:   1 instance · uptime ${rand(2, 60)}d`, "muted");
          print(`skills:  ${on}/${total} enabled`, "muted");
          print(`health:  ${(0.96 + Math.random() * 0.04).toFixed(2)} · 0 open issues`,
            "ok");
          print(`last run: ${nextRun()} ago · morning-brief`, "muted");
          return;
        }
        case "clear":
          setEntries(INITIAL);
          return;
        case "exit":
          print("(this is a demo — your session never ends)", "muted");
          return;
        default:
          print(
            `command not found: ${head} · try 'help'`,
            "err",
          );
      }
    },
    [enabled, print, printCmd, skillBySlug],
  );

  const onSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      exec(input);
      setInput("");
    },
    [exec, input],
  );

  const onKey = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (!history.length) return;
        const next = historyIdx === -1 ? history.length - 1 : Math.max(0, historyIdx - 1);
        setHistoryIdx(next);
        setInput(history[next] ?? "");
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (historyIdx === -1) return;
        const next = historyIdx + 1;
        if (next >= history.length) {
          setHistoryIdx(-1);
          setInput("");
        } else {
          setHistoryIdx(next);
          setInput(history[next] ?? "");
        }
      } else if (e.key === "Tab") {
        e.preventDefault();
        const completion = complete(input);
        if (completion) setInput(completion);
      } else if (e.key === "l" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setEntries(INITIAL);
      }
    },
    [history, historyIdx, input],
  );

  return (
    <div
      className="bg-[#050708] text-[13px] leading-6"
      onClick={() => inputRef.current?.focus()}
    >
      <div
        ref={scrollRef}
        className="no-scrollbar h-[560px] overflow-y-auto px-4 py-3 sm:px-5"
      >
        {entries.map((e, i) =>
          e.kind === "cmd" ? (
            <div key={i} className="flex">
              <span className="select-none text-accent">{">"}&nbsp;</span>
              <span className="whitespace-pre-wrap text-foreground">
                {e.text}
              </span>
            </div>
          ) : (
            <div
              key={i}
              className={`whitespace-pre-wrap pl-3 ${toneClass(e.tone)}`}
            >
              {e.text}
            </div>
          ),
        )}
        <form onSubmit={onSubmit} className="flex pt-1">
          <label className="sr-only" htmlFor="term-input">
            terminal input
          </label>
          <span className="select-none text-accent">{">"}&nbsp;</span>
          <input
            id="term-input"
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="w-full flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-2"
            placeholder="type a command — try 'help' or 'skills'"
          />
        </form>
      </div>
    </div>
  );
}

function tokenize(s: string): string[] {
  const out: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

function rand(a: number, b: number): number {
  return Math.floor(a + Math.random() * (b - a + 1));
}

function nextRun(): string {
  const m = rand(1, 59);
  return `${m}m`;
}

function toneClass(t?: Tone): string {
  switch (t) {
    case "ok":
      return "text-accent";
    case "info":
      return "text-cyan";
    case "warn":
      return "text-amber";
    case "err":
      return "text-danger";
    case "muted":
      return "text-muted";
    default:
      return "text-foreground";
  }
}

const COMMANDS = [
  "help",
  "whoami",
  "skills",
  "cat",
  "run",
  "schedule",
  "enable",
  "disable",
  "notify",
  "status",
  "clear",
  "exit",
];

function complete(input: string): string | null {
  const tokens = tokenize(input);
  if (tokens.length <= 1 && !input.endsWith(" ")) {
    const prefix = tokens[0] ?? "";
    const match = COMMANDS.find((c) => c.startsWith(prefix));
    return match && match !== prefix ? match + " " : null;
  }
  const last = tokens[tokens.length - 1] ?? "";
  const slug = SKILLS.find((s) => s.slug.startsWith(last));
  if (!slug || slug.slug === last) return null;
  const before = input.slice(0, input.length - last.length);
  return before + slug.slug + " ";
}
