"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { CATEGORIES, type SkillCategory } from "@/lib/skills";

type CommunitySkill = {
  id: string;
  slug: string;
  name: string;
  category: SkillCategory;
  summary: string;
};

type FetchState =
  | { kind: "loading" }
  | { kind: "ok"; skills: CommunitySkill[] }
  | { kind: "hidden" };

export function CommunitySkills() {
  const [state, setState] = useState<FetchState>({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const res = await fetch("/api/skills?public=1", {
          credentials: "include",
          signal: controller.signal,
        });
        if (!res.ok) {
          setState((prev) =>
            prev.kind === "ok" ? prev : { kind: "hidden" },
          );
          return;
        }
        const data = (await res.json()) as { public: CommunitySkill[] };
        const skills = data.public ?? [];
        if (skills.length === 0) {
          setState({ kind: "hidden" });
          return;
        }
        setState({ kind: "ok", skills: skills.slice(0, 6) });
      } catch {
        setState((prev) => (prev.kind === "ok" ? prev : { kind: "hidden" }));
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  if (state.kind !== "ok") return null;

  return (
    <section className="mb-12 border-t border-border pt-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-accent">
            $ ls /skills/community
          </p>
          <h2 className="mt-1 text-xl text-foreground sm:text-2xl">
            {state.skills.length} public skill
            {state.skills.length === 1 ? "" : "s"}{" "}
            <span className="text-muted-2">
              built by users
            </span>
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Skills the community has made public. Click run to execute one on
            your own quota.
          </p>
        </div>
      </header>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {state.skills.map((skill) => {
          const cat = CATEGORIES[skill.category];
          return (
            <li
              key={skill.id}
              className="group relative flex flex-col gap-3 rounded-md border border-border bg-surface p-4 transition-colors hover:border-border-strong"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p
                    className={`text-xs uppercase tracking-widest ${cat?.accent ?? "text-muted"}`}
                  >
                    {(cat?.label ?? skill.category).split(" ")[0]}
                  </p>
                  <h3 className="text-sm text-foreground">
                    <span className="text-muted">$</span> {skill.name}
                  </h3>
                </div>
                <span className="rounded border border-accent-dim px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-accent">
                  community
                </span>
              </div>
              <p className="text-xs leading-relaxed text-muted">
                {skill.summary}
              </p>
              <Link
                href={`/skills/run?id=${skill.id}`}
                className="mt-auto inline-flex items-center gap-1 text-[11px] text-accent hover:underline"
              >
                → run
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
