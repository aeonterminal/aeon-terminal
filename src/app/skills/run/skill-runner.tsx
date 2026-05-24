"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CATEGORIES, type SkillCategory } from "@/lib/skills";

type SkillMeta = {
  id: string;
  slug: string;
  name: string;
  category: SkillCategory;
  summary: string;
  visibility: "private" | "public";
};

type AuthUser = {
  id: string;
  email: string | null;
  name: string | null;
};

type FetchState =
  | { kind: "loading" }
  | { kind: "ok"; skill: SkillMeta; isOwner: boolean }
  | { kind: "missing-id" }
  | { kind: "not-found" }
  | { kind: "forbidden" }
  | { kind: "err"; message: string };

function SkillRunnerInner() {
  const params = useSearchParams();
  const id = params.get("id");

  const [state, setState] = useState<FetchState>({ kind: "loading" });
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState<string>("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadMe() {
      try {
        const res = await fetch("/api/me", { credentials: "include" });
        if (cancelled) return;
        if (res.ok) {
          const data = (await res.json()) as { user: AuthUser | null };
          setAuthUser(data.user);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    }
    void loadMe();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!id) {
        setState({ kind: "missing-id" });
        return;
      }
      try {
        const res = await fetch(`/api/skills/${encodeURIComponent(id)}`, {
          credentials: "include",
        });
        if (cancelled) return;
        if (res.status === 404) {
          setState({ kind: "not-found" });
          return;
        }
        if (res.status === 403) {
          setState({ kind: "forbidden" });
          return;
        }
        if (!res.ok) {
          setState({
            kind: "err",
            message: `HTTP ${res.status} — could not load skill.`,
          });
          return;
        }
        const data = (await res.json()) as {
          skill: SkillMeta & { owner?: string };
        };
        const meRes = await fetch("/api/me", { credentials: "include" });
        if (cancelled) return;
        const meData = meRes.ok
          ? ((await meRes.json()) as { user: AuthUser | null })
          : { user: null };
        const owner =
          !!meData.user && data.skill.owner === meData.user.id;
        if (cancelled) return;
        setState({ kind: "ok", skill: data.skill, isOwner: owner });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!cancelled) setState({ kind: "err", message: msg });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const onCancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (state.kind !== "ok") return;
    if (!authUser) {
      setError("Sign in to run this skill.");
      return;
    }
    if (streaming) return;
    setStreaming(true);
    setError(null);
    setOutput("");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/exec", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        signal: controller.signal,
        body: JSON.stringify({
          mode: "run",
          skillId: state.skill.id,
          prompt: prompt.trim() || `Execute the ${state.skill.name} skill now.`,
        }),
      });
      if (!res.ok || !res.body) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = (await res.json()) as { error?: string; message?: string };
          msg = j.message || j.error || msg;
        } catch {
          // ignore
        }
        setError(msg);
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
              setOutput((prev) => prev + evt.delta);
            } else if (evt.type === "error") {
              setError(evt.message);
            }
          } catch {
            // skip
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("abort")) setError(msg);
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  const shareUrl = useMemo(() => {
    if (state.kind !== "ok") return "";
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/skills/run?id=${state.skill.id}`;
  }, [state]);

  if (state.kind === "loading") {
    return (
      <div className="rounded border border-border bg-surface/80 px-5 py-8 text-sm text-muted">
        loading skill…
      </div>
    );
  }

  if (state.kind === "missing-id") {
    return (
      <div className="space-y-3 rounded border border-border bg-surface/80 px-5 py-6">
        <p className="text-sm text-foreground">no skill id in URL.</p>
        <p className="text-xs text-muted">
          Use a share link from <code>/skills/mine</code> — they look like{" "}
          <code>/skills/run?id=…</code>.
        </p>
        <Link
          href="/skills"
          className="inline-flex items-center gap-2 rounded border border-border bg-surface px-3 py-1.5 text-xs text-muted hover:border-border-strong hover:text-foreground"
        >
          → browse the catalog
        </Link>
      </div>
    );
  }

  if (state.kind === "not-found") {
    return (
      <div className="rounded border border-border bg-surface/80 px-5 py-6 text-sm text-muted">
        skill not found. it may have been deleted by its owner.
      </div>
    );
  }

  if (state.kind === "forbidden") {
    return (
      <div className="rounded border border-border bg-surface/80 px-5 py-6 text-sm text-muted">
        this skill is private. only its owner can run it.
      </div>
    );
  }

  if (state.kind === "err") {
    return (
      <div className="rounded border border-red/40 bg-red/10 px-5 py-6 text-sm text-red">
        {state.message}
      </div>
    );
  }

  const { skill, isOwner } = state;
  const cat = CATEGORIES[skill.category];

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.3em] text-muted">
          $ run {skill.slug}
        </p>
        <h1 className="text-2xl tracking-tight text-foreground sm:text-3xl">
          {skill.name}
        </h1>
        <p className="text-sm leading-relaxed text-muted">{skill.summary}</p>
        <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-widest">
          <span className={`${cat?.accent ?? "text-muted"}`}>
            {cat?.label ?? skill.category}
          </span>
          <span className="text-muted-2">·</span>
          <span
            className={`rounded border px-1.5 py-0.5 ${
              skill.visibility === "public"
                ? "border-accent-dim text-accent"
                : "border-border text-muted-2"
            }`}
          >
            {skill.visibility}
          </span>
          {isOwner ? (
            <>
              <span className="text-muted-2">·</span>
              <span className="text-muted">you own this</span>
            </>
          ) : null}
        </div>
      </header>

      {!authChecked ? null : !authUser ? (
        <div className="space-y-3 rounded border border-border bg-surface/80 px-5 py-5">
          <p className="text-sm text-foreground">
            sign in to run this skill against your own quota.
          </p>
          <Link
            href={`/login?redirect=${encodeURIComponent(
              `/skills/run?id=${skill.id}`,
            )}`}
            className="inline-flex items-center gap-2 rounded border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs text-accent hover:bg-accent/20"
          >
            → sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block space-y-1.5">
            <span className="text-[11px] uppercase tracking-[0.25em] text-muted">
              prompt (optional)
            </span>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder="any extra context the skill needs — a URL, a topic, a repo name…"
              className="w-full rounded border border-border bg-surface px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-2 focus:border-accent/60 focus:outline-none"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={streaming}
              className="rounded border border-accent/40 bg-accent/10 px-4 py-2 text-sm text-accent hover:bg-accent/20 disabled:opacity-50"
            >
              {streaming ? "streaming…" : "$ run skill →"}
            </button>
            {streaming ? (
              <button
                type="button"
                onClick={onCancel}
                className="rounded border border-border bg-surface px-3 py-2 text-xs text-muted hover:text-foreground"
              >
                cancel
              </button>
            ) : null}
            <span className="ml-auto text-[11px] text-muted-2">
              uses 1 of your daily run quota
            </span>
          </div>
        </form>
      )}

      {error ? (
        <div className="rounded border border-red/40 bg-red/10 px-3 py-2 text-xs text-red">
          {error}
        </div>
      ) : null}

      {output || streaming ? (
        <div className="rounded border border-border bg-surface/80">
          <div className="border-b border-border px-4 py-2 text-[11px] uppercase tracking-widest text-muted">
            output
          </div>
          <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-xs leading-relaxed text-foreground">
            {output || "…"}
          </pre>
        </div>
      ) : null}

      {skill.visibility === "public" ? (
        <div className="rounded border border-border bg-surface/60 px-4 py-3 text-[11px] text-muted-2">
          share this skill ·{" "}
          <code className="text-foreground">{shareUrl}</code>
        </div>
      ) : null}
    </div>
  );
}

export function SkillRunner() {
  return (
    <Suspense
      fallback={
        <div className="rounded border border-border bg-surface/80 px-5 py-8 text-sm text-muted">
          loading…
        </div>
      }
    >
      <SkillRunnerInner />
    </Suspense>
  );
}
