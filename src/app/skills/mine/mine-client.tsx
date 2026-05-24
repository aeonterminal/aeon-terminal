"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { CATEGORIES, type SkillCategory } from "@/lib/skills";

type Quota = {
  used: number;
  limit: number;
  plan: string;
};

type CustomSkill = {
  id: string;
  slug: string;
  name: string;
  category: SkillCategory;
  summary: string;
  visibility: "private" | "public";
  created_at: number;
};

type AuthUser = {
  id: string;
  email: string | null;
  name: string | null;
};

type ListState =
  | { kind: "loading" }
  | { kind: "anon" }
  | { kind: "ok"; mine: CustomSkill[]; quota: Quota | null }
  | { kind: "err"; message: string };

function shareUrl(skill: CustomSkill): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/skills/run?id=${skill.id}`;
}

export function MineSkills() {
  const [state, setState] = useState<ListState>({ kind: "loading" });
  const [copied, setCopied] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const meRes = await fetch("/api/me", { credentials: "include" });
        if (cancelled) return;
        const meData = meRes.ok
          ? ((await meRes.json()) as { user: AuthUser | null })
          : { user: null };
        if (cancelled) return;
        if (!meData.user) {
          setState({ kind: "anon" });
          return;
        }
        const res = await fetch("/api/skills?public=0", {
          credentials: "include",
        });
        if (cancelled) return;
        if (!res.ok) {
          setState({
            kind: "err",
            message: `HTTP ${res.status} — could not load skills.`,
          });
          return;
        }
        const data = (await res.json()) as {
          mine: CustomSkill[];
          quota: Quota | null;
        };
        if (cancelled) return;
        setState({
          kind: "ok",
          mine: data.mine ?? [],
          quota: data.quota,
        });
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setState({ kind: "err", message: msg });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  async function handleDelete(id: string) {
    if (deleting) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/skills/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        reload();
      }
    } finally {
      setDeleting(null);
    }
  }

  async function handleCopy(skill: CustomSkill) {
    const url = shareUrl(skill);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(skill.id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // ignore — fallback would require browser-specific UI
    }
  }

  if (state.kind === "loading") {
    return (
      <div className="rounded border border-border bg-surface/80 px-5 py-6 text-sm text-muted">
        loading…
      </div>
    );
  }

  if (state.kind === "anon") {
    return (
      <div className="space-y-3 rounded border border-border bg-surface/80 px-5 py-6">
        <p className="text-sm text-foreground">
          $ ls ~/skills — sign in required.
        </p>
        <p className="text-xs leading-relaxed text-muted">
          Your custom skills are attached to your account.
        </p>
        <Link
          href={`/login?redirect=${encodeURIComponent("/skills/mine")}`}
          className="inline-flex items-center gap-2 rounded border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs text-accent hover:bg-accent/20"
        >
          → sign in
        </Link>
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

  const { mine, quota } = state;
  const atCap = quota ? quota.used >= quota.limit : false;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-border bg-surface/80 px-4 py-3">
        <div className="text-[11px] uppercase tracking-widest text-muted">
          quota ·{" "}
          <span className="text-foreground">{quota?.used ?? mine.length}</span>{" "}
          / <span className="text-foreground">{quota?.limit ?? "—"}</span> ·{" "}
          plan <span className="text-foreground">{quota?.plan ?? "free"}</span>
        </div>
        <Link
          href="/skills/create"
          aria-disabled={atCap}
          className={`rounded border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs text-accent hover:bg-accent/20 ${
            atCap ? "pointer-events-none opacity-40" : ""
          }`}
        >
          {atCap ? "at cap — delete one first" : "+ create skill"}
        </Link>
      </div>

      {mine.length === 0 ? (
        <div className="space-y-3 rounded border border-border bg-surface/60 px-5 py-8 text-center">
          <p className="text-sm text-foreground">no custom skills yet.</p>
          <p className="text-xs text-muted">
            Build one — a single Claude persona, named and reusable, that runs
            with the same tools as the catalog.
          </p>
          <Link
            href="/skills/create"
            className="inline-flex items-center gap-2 rounded border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs text-accent hover:bg-accent/20"
          >
            → create your first skill
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {mine.map((skill) => {
            const cat = CATEGORIES[skill.category];
            return (
              <li
                key={skill.id}
                className="space-y-3 rounded-md border border-border bg-surface p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p
                      className={`text-[11px] uppercase tracking-widest ${cat?.accent ?? "text-muted"}`}
                    >
                      {cat?.label ?? skill.category}
                    </p>
                    <h2 className="text-sm text-foreground">
                      <span className="text-muted">$</span> {skill.name}{" "}
                      <span className="text-muted-2">· {skill.slug}</span>
                    </h2>
                  </div>
                  <span
                    className={`rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-widest ${
                      skill.visibility === "public"
                        ? "border-accent-dim text-accent"
                        : "border-border text-muted-2"
                    }`}
                  >
                    {skill.visibility}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-muted">
                  {skill.summary}
                </p>
                <div className="flex flex-wrap gap-2 text-[11px]">
                  <Link
                    href={`/skills/run?id=${skill.id}`}
                    className="rounded border border-accent/40 bg-accent/10 px-2.5 py-1 text-accent hover:bg-accent/20"
                  >
                    → run
                  </Link>
                  {skill.visibility === "public" ? (
                    <button
                      type="button"
                      onClick={() => handleCopy(skill)}
                      className="rounded border border-border bg-surface px-2.5 py-1 text-muted hover:border-border-strong hover:text-foreground"
                    >
                      {copied === skill.id ? "✓ copied" : "copy share link"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => handleDelete(skill.id)}
                    disabled={deleting === skill.id}
                    className="rounded border border-border bg-surface px-2.5 py-1 text-muted hover:border-red/40 hover:text-red disabled:opacity-50"
                  >
                    {deleting === skill.id ? "deleting…" : "delete"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
