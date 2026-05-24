import type { Metadata } from "next";
import { InteractiveTerminal } from "@/components/interactive-terminal";
import { TerminalWindow } from "@/components/terminal-window";

export const metadata: Metadata = {
  title: "Terminal",
  description:
    "Interactive Aeon Terminal. Try `ask hello`, `run morning-brief`, or `skills`. Backed by Claude.",
};

const QUICK = [
  { c: "help", d: "show every command" },
  { c: "ask <q>", d: "free-form prompt to claude" },
  { c: "run morning-brief", d: "execute a skill (real LLM)" },
  { c: "run pr-review --mock", d: "execute with canned output" },
  { c: "skills", d: "list everything · filter by category" },
  { c: "cat morning-brief", d: "show a skill spec" },
  { c: "status", d: "fleet & skill health" },
];

export default function TerminalPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12 lg:py-16">
      <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-muted">
            $ /terminal
          </p>
          <h1 className="mt-1 text-2xl tracking-tight text-foreground sm:text-3xl">
            Interactive Aeon Terminal
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            A real session backed by Claude.{" "}
            <code className="text-foreground">ask</code> and{" "}
            <code className="text-foreground">run</code> hit the LLM; everything
            else is local. Up/down for history, tab for completion, ctrl+c to
            cancel.
          </p>
        </div>
        <a
          href="https://github.com/aaronjmars/aeon"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted transition-colors hover:text-accent sm:text-sm"
        >
          looking for the real one? aeon ↗
        </a>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <TerminalWindow title="aeon@web" host="~/demo">
          <InteractiveTerminal />
        </TerminalWindow>
        <aside className="rounded border border-border bg-surface p-4">
          <p className="text-[11px] uppercase tracking-widest text-muted">
            quick start
          </p>
          <ul className="mt-3 space-y-2 text-xs">
            {QUICK.map((q) => (
              <li key={q.c} className="leading-relaxed">
                <code className="rounded bg-surface-2 px-1.5 py-0.5 text-accent">
                  {q.c}
                </code>
                <span className="ml-2 text-muted">{q.d}</span>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-[11px] uppercase tracking-widest text-muted">
            shortcuts
          </p>
          <ul className="mt-3 space-y-1 text-xs text-muted">
            <li>
              <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] text-foreground">
                ↑ ↓
              </kbd>{" "}
              history
            </li>
            <li>
              <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] text-foreground">
                tab
              </kbd>{" "}
              complete
            </li>
            <li>
              <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] text-foreground">
                ctrl+l
              </kbd>{" "}
              clear
            </li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
