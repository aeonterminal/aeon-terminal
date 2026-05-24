"use client";

import { useEffect, useState } from "react";

import { TerminalWindow } from "@/components/terminal-window";
import {
  fetchGithubMonitor,
  formatRelativeTime,
  GITHUB_OWNER,
  GITHUB_REPO,
  type GithubMonitorSnapshot,
} from "@/lib/live-skill";

const POLL_MS = 5 * 60_000;

type PanelState =
  | { kind: "loading" }
  | { kind: "ok"; snap: GithubMonitorSnapshot; updatedAt: number }
  | { kind: "hidden" };

export function LiveSkillPanel() {
  const [state, setState] = useState<PanelState>({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    const load = async () => {
      const result = await fetchGithubMonitor(controller.signal);
      if (cancelled) return;
      if (!result) {
        setState((prev) =>
          prev.kind === "ok" ? prev : { kind: "hidden" },
        );
        return;
      }
      setState({ kind: "ok", snap: result, updatedAt: Date.now() });
    };

    void load();
    timer = setInterval(() => void load(), POLL_MS);

    return () => {
      cancelled = true;
      controller.abort();
      if (timer) clearInterval(timer);
    };
  }, []);

  if (state.kind === "hidden") return null;

  return (
    <TerminalWindow title="aeon@live" host={`~/skills/github-monitor`}>
      <div className="bg-[#050708] px-4 py-4 text-[13px] leading-7 sm:px-5">
        <p className="text-muted-2">
          <span className="text-accent">$</span> aeon live --skill{" "}
          <span className="text-foreground">github-monitor</span>{" "}
          <span className="text-muted-2">
            --repo {GITHUB_OWNER}/{GITHUB_REPO}
          </span>
        </p>

        {state.kind === "loading" ? <LoadingBody /> : <ReadyBody {...state} />}
      </div>
    </TerminalWindow>
  );
}

function LoadingBody() {
  return (
    <div className="mt-3 space-y-2">
      <Row label="repo" value={<Skel w="w-40" />} />
      <Row label="stars" value={<Skel w="w-12" />} />
      <Row label="forks" value={<Skel w="w-10" />} />
      <Row label="open" value={<Skel w="w-10" />} />
      <Row label="commit" value={<Skel w="w-56" />} />
      <Row label="release" value={<Skel w="w-24" />} />
      <p className="mt-3 text-[11px] text-muted-2">
        fetching live data from github api…
      </p>
    </div>
  );
}

function Skel({ w }: { w: string }) {
  return <span className={`inline-block h-4 animate-pulse rounded bg-border ${w}`} />;
}

function ReadyBody({
  snap,
  updatedAt,
}: {
  snap: GithubMonitorSnapshot;
  updatedAt: number;
}) {
  const updated = new Date(updatedAt);
  const updatedLabel = `${updated.getUTCHours().toString().padStart(2, "0")}:${updated
    .getUTCMinutes()
    .toString()
    .padStart(2, "0")} UTC`;

  return (
    <div className="mt-3 space-y-1">
      <Row
        label="repo"
        value={
          <a
            href={snap.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground hover:text-accent"
          >
            {snap.fullName} ↗
          </a>
        }
      />
      <Row
        label="stars"
        value={<span className="text-accent-2">{snap.stars}</span>}
      />
      <Row
        label="forks"
        value={<span className="text-foreground">{snap.forks}</span>}
      />
      <Row
        label="open"
        value={
          <span className="text-foreground">
            {snap.openIssues}{" "}
            <span className="text-muted-2">issues + PRs</span>
          </span>
        }
      />
      <Row
        label="commit"
        value={
          <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
            <a
              href={snap.latestCommit.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              {snap.latestCommit.shortSha}
            </a>
            <span className="break-words text-foreground">
              {snap.latestCommit.message}
            </span>
            <span className="text-muted-2">
              · {formatRelativeTime(snap.latestCommit.date)}
            </span>
          </span>
        }
      />
      <Row
        label="release"
        value={
          snap.latestRelease ? (
            <span className="flex flex-wrap items-baseline gap-x-2">
              <a
                href={snap.latestRelease.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                {snap.latestRelease.tag}
              </a>
              <span className="text-muted-2">
                · {formatRelativeTime(snap.latestRelease.publishedAt)}
              </span>
            </span>
          ) : (
            <span className="text-muted-2">
              none yet · still pre-1.0
            </span>
          )
        }
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-[11px] text-muted-2">
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent-2 shadow-[0_0_8px_var(--accent-2)]"
          />
          live · github api · {updatedLabel}
        </span>
        <span>refresh every 5 min</span>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[80px_1fr] items-baseline gap-x-3">
      <span className="text-muted-2">[{label}]</span>
      <span className="min-w-0">{value}</span>
    </div>
  );
}
