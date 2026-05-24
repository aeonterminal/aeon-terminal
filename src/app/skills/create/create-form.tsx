"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { CATEGORIES, type SkillCategory } from "@/lib/skills";

type AuthUser = {
  id: string;
  email: string | null;
  name: string | null;
  plan: string;
};

type Quota = {
  used: number;
  limit: number;
  plan: string;
};

const CATEGORY_ORDER: SkillCategory[] = [
  "research",
  "dev",
  "crypto",
  "social",
  "productivity",
  "meta",
];

const PERSONA_PLACEHOLDER = `Example persona:
Expect the user to paste a URL. Call fetch_url on it.
Output: one-line summary, 3 bullet takeaways, and a citation line "source: <domain>".
If no URL is provided, ask for one in a single short line. Do not fabricate.`;

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

export function CreateSkillForm() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [quota, setQuota] = useState<Quota | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [category, setCategory] = useState<SkillCategory>("research");
  const [summary, setSummary] = useState("");
  const [persona, setPersona] = useState("");
  const [visibility, setVisibility] = useState<"private" | "public">(
    "private",
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadMe() {
      try {
        const res = await fetch("/api/me", { credentials: "include" });
        if (cancelled || !res.ok) {
          if (!cancelled) setAuthChecked(true);
          return;
        }
        const data = (await res.json()) as { user: AuthUser | null };
        if (cancelled) return;
        setAuthUser(data.user);
        setAuthChecked(true);
        if (data.user) {
          const qres = await fetch("/api/skills?public=0", {
            credentials: "include",
          });
          if (!cancelled && qres.ok) {
            const qdata = (await qres.json()) as { quota: Quota | null };
            setQuota(qdata.quota ?? null);
          }
        }
      } catch {
        if (!cancelled) setAuthChecked(true);
      }
    }
    void loadMe();
    return () => {
      cancelled = true;
    };
  }, []);

  const effectiveSlug = useMemo(() => {
    if (slugTouched && slug) return slugify(slug);
    return slugify(name);
  }, [name, slug, slugTouched]);

  const personaCount = persona.trim().length;
  const summaryCount = summary.trim().length;
  const personaTooShort = personaCount > 0 && personaCount < 40;
  const summaryTooShort = summaryCount > 0 && summaryCount < 8;
  const slugTooShort = effectiveSlug.length > 0 && effectiveSlug.length < 3;

  const canSubmit =
    !!authUser &&
    !submitting &&
    effectiveSlug.length >= 3 &&
    name.trim().length > 0 &&
    summaryCount >= 8 &&
    personaCount >= 40;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!authUser) {
      setError("Sign in to create a skill.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          slug: effectiveSlug,
          name: name.trim(),
          category,
          summary: summary.trim(),
          persona: persona.trim(),
          visibility,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        skill?: { id: string };
        error?: string;
        message?: string;
      };
      if (!res.ok || !data.ok || !data.skill) {
        setError(
          data.message ||
            data.error ||
            `HTTP ${res.status} — could not create skill.`,
        );
        return;
      }
      router.push("/skills/mine");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`network error: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  }

  if (!authChecked) {
    return (
      <div className="rounded-lg border border-border bg-surface/80 px-5 py-6 text-sm text-muted">
        loading…
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="space-y-3 rounded-lg border border-border bg-surface/80 px-5 py-6">
        <p className="text-sm text-foreground">
          $ aeon skill --create requires sign-in.
        </p>
        <p className="text-xs leading-relaxed text-muted">
          Skills are attached to your account so the terminal can find them by
          slug and your daily quota stays accurate.
        </p>
        <a
          href={`/login?redirect=${encodeURIComponent("/skills/create")}`}
          className="inline-flex items-center gap-2 rounded border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs text-accent hover:bg-accent/20"
        >
          → sign in
        </a>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-lg border border-border bg-surface/80 px-5 py-5 sm:px-6 sm:py-6"
    >
      {quota ? (
        <div className="flex items-center justify-between rounded border border-border bg-surface px-3 py-2 text-[11px] uppercase tracking-widest text-muted">
          <span>
            quota · <span className="text-foreground">{quota.used}</span> /{" "}
            <span className="text-foreground">{quota.limit}</span> on{" "}
            <span className="text-foreground">{quota.plan}</span> plan
          </span>
          {quota.used >= quota.limit ? (
            <span className="text-red">at cap</span>
          ) : null}
        </div>
      ) : null}

      <label className="block space-y-1.5">
        <span className="text-[11px] uppercase tracking-[0.25em] text-muted">
          name
        </span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          required
          placeholder="newsletter-summarizer"
          className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-2 focus:border-accent/60 focus:outline-none"
        />
        <span className="text-[10px] text-muted-2">
          1–60 chars. shown on the skill card.
        </span>
      </label>

      <label className="block space-y-1.5">
        <span className="text-[11px] uppercase tracking-[0.25em] text-muted">
          slug
        </span>
        <div className="flex items-center gap-2 rounded border border-border bg-surface px-3 py-2">
          <span className="text-muted-2">$ run</span>
          <input
            type="text"
            value={slugTouched ? slug : effectiveSlug}
            onFocus={() => setSlugTouched(true)}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            maxLength={32}
            placeholder="auto-from-name"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-2 focus:outline-none"
          />
        </div>
        <span className="text-[10px] text-muted-2">
          lowercase, 3–32 chars, [a-z0-9-]. reserved catalog slugs are
          rejected.
        </span>
        {slugTooShort ? (
          <span className="text-[10px] text-red">
            slug must be at least 3 chars
          </span>
        ) : null}
      </label>

      <label className="block space-y-1.5">
        <span className="text-[11px] uppercase tracking-[0.25em] text-muted">
          category
        </span>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as SkillCategory)}
          className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent/60 focus:outline-none"
        >
          {CATEGORY_ORDER.map((key) => (
            <option key={key} value={key}>
              {CATEGORIES[key].label}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1.5">
        <span className="text-[11px] uppercase tracking-[0.25em] text-muted">
          summary
        </span>
        <input
          type="text"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          maxLength={240}
          required
          placeholder="One line. What does it do?"
          className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-2 focus:border-accent/60 focus:outline-none"
        />
        <span className="text-[10px] text-muted-2">
          shown on the skill card. {summaryCount}/240
          {summaryTooShort ? (
            <span className="ml-2 text-red">min 8 chars</span>
          ) : null}
        </span>
      </label>

      <label className="block space-y-1.5">
        <span className="text-[11px] uppercase tracking-[0.25em] text-muted">
          persona / prompt
        </span>
        <textarea
          value={persona}
          onChange={(e) => setPersona(e.target.value)}
          maxLength={4000}
          required
          rows={10}
          placeholder={PERSONA_PLACEHOLDER}
          className="w-full rounded border border-border bg-surface px-3 py-2 font-mono text-xs leading-relaxed text-foreground placeholder:text-muted-2 focus:border-accent/60 focus:outline-none"
        />
        <span className="text-[10px] text-muted-2">
          claude reads this as the skill&apos;s system prompt. describe inputs,
          outputs, and tool usage. {personaCount}/4000
          {personaTooShort ? (
            <span className="ml-2 text-red">min 40 chars</span>
          ) : null}
        </span>
      </label>

      <fieldset className="space-y-2">
        <legend className="text-[11px] uppercase tracking-[0.25em] text-muted">
          visibility
        </legend>
        <label className="flex cursor-pointer items-start gap-3 rounded border border-border bg-surface px-3 py-2 hover:border-border-strong has-[input:checked]:border-accent/60">
          <input
            type="radio"
            name="visibility"
            value="private"
            checked={visibility === "private"}
            onChange={() => setVisibility("private")}
            className="mt-0.5 accent-[var(--accent)]"
          />
          <span className="space-y-0.5 text-xs">
            <span className="block text-foreground">private</span>
            <span className="block text-muted-2">
              only you can run it from your terminal.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded border border-border bg-surface px-3 py-2 hover:border-border-strong has-[input:checked]:border-accent/60">
          <input
            type="radio"
            name="visibility"
            value="public"
            checked={visibility === "public"}
            onChange={() => setVisibility("public")}
            className="mt-0.5 accent-[var(--accent)]"
          />
          <span className="space-y-0.5 text-xs">
            <span className="block text-foreground">public · shareable</span>
            <span className="block text-muted-2">
              get a <code className="text-foreground">/skills/run?id=…</code>{" "}
              URL. anyone signed in can run it on their own quota.
            </span>
          </span>
        </label>
      </fieldset>

      {error ? (
        <div className="rounded border border-red/40 bg-red/10 px-3 py-2 text-xs text-red">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <span className="text-[11px] text-muted-2">
          {canSubmit
            ? "ready to ship."
            : "fill name, slug, summary, and persona."}
        </span>
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded border border-accent/40 bg-accent/10 px-4 py-2 text-sm text-accent transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? "creating…" : "$ create skill →"}
        </button>
      </div>
    </form>
  );
}
