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

type AuthUser = {
  id: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  provider: string | null;
  plan: string;
};

type Usage = {
  day: string;
  asks: number;
  runs: number;
  limits: { asks: number; runs: number };
};

const HELP = `Available commands:
  help                       — show this help
  whoami                     — describe the active agent + session
  login                      — open the sign-in page
  signout                    — end this session
  skills [category]          — list skills (filter by category)
  cat <skill>                — show a skill spec
  run <skill> [prompt...]    — execute a skill via Claude (real LLM)
  run <skill> --mock         — execute a skill with mock output (offline)
  ask <question...>          — free-form prompt to the agent
  memory                     — show what the agent remembers (signed-in only)
  memory clear               — wipe your memory (signed-in only)
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
  const [streaming, setStreaming] = useState(false);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const sessionLabel = authUser
    ? `${authUser.name || authUser.email || authUser.id.slice(0, 8)} · plan:${authUser.plan}`
    : "anonymous";

  const refreshMe = useCallback(async () => {
    try {
      const res = await fetch("/api/me", { credentials: "include" });
      if (!res.ok) return;
      const data = (await res.json()) as { user: AuthUser | null; usage?: Usage | null };
      setAuthUser(data.user);
      setUsage(data.usage ?? null);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/me", { credentials: "include" });
        if (cancelled || !res.ok) return;
        const data = (await res.json()) as {
          user: AuthUser | null;
          usage?: Usage | null;
        };
        if (cancelled) return;
        setAuthUser(data.user);
        setUsage(data.usage ?? null);
      } catch {
        // ignore
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const appendToLast = useCallback((delta: string) => {
    setEntries((prev) => {
      const last = prev[prev.length - 1];
      if (!last || last.kind !== "out") return prev;
      const next = prev.slice(0, -1);
      next.push({ ...last, text: last.text + delta });
      return next;
    });
  }, []);

  const runStream = useCallback(
    async (mode: "run" | "ask", skillSlug: string | null, prompt: string) => {
      if (streaming) {
        print("a request is already streaming — wait or press Ctrl+C", "warn");
        return;
      }
      setStreaming(true);
      const controller = new AbortController();
      abortRef.current = controller;
      print("", "info");
      try {
        const res = await fetch("/api/exec", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ mode, skill: skillSlug, prompt }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          let errMsg = `HTTP ${res.status}`;
          try {
            const j = (await res.json()) as { error?: string; message?: string };
            errMsg = j.message ?? j.error ?? errMsg;
          } catch {
            // ignore
          }
          appendToLast(`✗ api error: ${errMsg}`);
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
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
            if (!payload) continue;
            try {
              const evt = JSON.parse(payload) as
                | { type: "text"; delta: string }
                | { type: "done"; remaining?: number }
                | { type: "error"; message: string };
              if (evt.type === "text") {
                appendToLast(evt.delta);
              } else if (evt.type === "error") {
                appendToLast(`\n✗ ${evt.message}`);
              }
            } catch {
              // skip
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg !== "AbortError" && !msg.includes("abort"))
          appendToLast(`\n✗ ${msg}`);
        else appendToLast(`\n· cancelled`);
      } finally {
        setStreaming(false);
        abortRef.current = null;
        // Refresh usage counters after each call so the badge stays accurate.
        void refreshMe();
      }
    },
    [appendToLast, print, refreshMe, streaming],
  );

  const fetchMemory = useCallback(async () => {
    try {
      const res = await fetch("/api/memory", {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) {
        print(`memory: api error ${res.status}`, "err");
        return;
      }
      const data = (await res.json()) as {
        enabled: boolean;
        reason?: string;
        turns: { user: string; assistant: string; ts?: string }[];
        runs: { skill: string; summary: string; ts?: string }[];
      };
      if (!data.enabled) {
        if (data.reason === "not_signed_in") {
          print(
            "memory: sign in to enable per-user memory (run 'login')",
            "warn",
          );
        } else {
          print(
            `memory: disabled (${data.reason || "unavailable"})`,
            "warn",
          );
        }
        return;
      }
      print(
        `turns: ${data.turns.length} · runs: ${data.runs.length}`,
        "muted",
      );
      if (data.turns.length === 0 && data.runs.length === 0) {
        print("  (empty — ask or run something to start remembering)", "muted");
        return;
      }
      if (data.turns.length) {
        print("");
        print("recent conversation:", "info");
        for (const t of data.turns.slice(-3)) {
          print(`  ${t.ts ?? ""}  ${truncOneLine(t.user, 60)}`, "muted");
        }
      }
      if (data.runs.length) {
        print("");
        print("recent skill runs:", "info");
        for (const r of data.runs.slice(-3)) {
          print(
            `  ${r.ts ?? ""}  ${pad(r.skill, 22)}  ${truncOneLine(r.summary, 50)}`,
            "muted",
          );
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      print(`memory: ${msg}`, "err");
    }
  }, [print]);

  const clearMemory = useCallback(async () => {
    try {
      const res = await fetch("/api/memory", {
        method: "DELETE",
        credentials: "include",
      });
      if (res.status === 401) {
        print("memory: sign in first (run 'login')", "warn");
        return;
      }
      if (!res.ok) {
        print(`memory: api error ${res.status}`, "err");
        return;
      }
      const data = (await res.json()) as { enabled: boolean; ok: boolean };
      if (!data.enabled) {
        print("memory: disabled", "warn");
        return;
      }
      print("✓ memory cleared", "ok");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      print(`memory: ${msg}`, "err");
    }
  }, [print]);

  const signOut = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        print(`signout: api error ${res.status}`, "err");
        return;
      }
      setAuthUser(null);
      setUsage(null);
      print("✓ signed out", "ok");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      print(`signout: ${msg}`, "err");
    }
  }, [print]);

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
          if (authUser) {
            const id = authUser.name || authUser.email || authUser.id;
            print(
              `${id} · plan: ${authUser.plan} · via: ${authUser.provider || "?"}`,
              "muted",
            );
            if (usage) {
              print(
                `usage today: ${usage.asks}/${usage.limits.asks} asks · ${usage.runs}/${usage.limits.runs} runs`,
                "muted",
              );
            }
            print("memory: d1://aeon_terminal", "muted");
          } else {
            print("anonymous · plan: guest · region: lo-fi-1", "muted");
            print(
              "memory: disabled · run 'login' to claim an agent",
              "muted",
            );
          }
          return;
        case "login":
          if (authUser) {
            print(
              `already signed in as ${authUser.name || authUser.email}. run 'signout' first.`,
              "muted",
            );
            return;
          }
          print("→ opening /login", "info");
          window.location.assign("/login");
          return;
        case "signout":
          if (!authUser) {
            print("already anonymous", "muted");
            return;
          }
          void signOut();
          return;
        case "memory": {
          const sub = rest[0];
          if (sub === "clear" || sub === "reset" || sub === "wipe") {
            void clearMemory();
          } else {
            void fetchMemory();
          }
          return;
        }
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
          const mock = rest.includes("--mock") || rest.includes("--dry");
          const s = slug ? skillBySlug.get(slug) : undefined;
          if (!s) {
            print(`skill not found: ${slug ?? "<none>"}`, "err");
            return;
          }
          if (mock) {
            print(`» run ${s.name} (mock)`, "info");
            print(`  · loaded soul · matched voice 0.${rand(88, 99)}`, "muted");
            print(`  · fetched context (${rand(3, 14)} sources)`, "muted");
            print(
              `  · drafted · ${rand(180, 520)}w · cost $0.0${rand(10, 90)}`,
              "muted",
            );
            print(
              `✓ mock complete · output in .outputs/${s.slug}.md`,
              "ok",
            );
            return;
          }
          const extra = rest.slice(1).filter((t) => !t.startsWith("--")).join(" ").trim();
          const userPrompt = extra
            ? `Execute the ${s.name} skill with this additional context: ${extra}`
            : `Execute the ${s.name} skill now.`;
          print(`» run ${s.name}`, "info");
          void runStream("run", s.slug, userPrompt);
          return;
        }
        case "ask": {
          const question = rest.join(" ").trim();
          if (!question) {
            print("usage: ask <your question>", "warn");
            return;
          }
          print(`» ask`, "info");
          void runStream("ask", null, question);
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
    [
      authUser,
      clearMemory,
      enabled,
      fetchMemory,
      print,
      printCmd,
      runStream,
      signOut,
      skillBySlug,
      usage,
    ],
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
      } else if (e.key === "c" && e.ctrlKey && streaming) {
        e.preventDefault();
        abortRef.current?.abort();
      }
    },
    [history, historyIdx, input, streaming],
  );

  return (
    <div
      className="bg-[#050708] text-[13px] leading-6"
      onClick={() => inputRef.current?.focus()}
    >
      <div
        ref={scrollRef}
        className="no-scrollbar h-[60vh] min-h-[360px] overflow-y-auto px-4 py-3 sm:h-[560px] sm:px-5"
      >
        <div className="text-muted">
          aeon·terminal · v0.1.0
          {sessionLabel ? ` · ${sessionLabel}` : ""}
        </div>
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
          <span className="select-none text-accent">
            {streaming ? "·" : ">"}&nbsp;
          </span>
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
            disabled={streaming}
            className="w-full flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-2 disabled:opacity-60"
            placeholder={
              streaming
                ? "streaming… ctrl+c to cancel"
                : "try 'ask hello' or 'run morning-brief'"
            }
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

function truncOneLine(s: string | undefined, n: number): string {
  const text = String(s ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= n) return text;
  return text.slice(0, n - 1) + "…";
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
  "ask",
  "memory",
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
