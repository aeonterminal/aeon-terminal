import type { Metadata } from "next";
import Link from "next/link";
import { SkillCard } from "@/components/skill-card";
import { CommunitySkills } from "@/components/community-skills";
import {
  CATEGORIES,
  SKILLS,
  SKILL_COUNT_BY_CATEGORY,
  type SkillCategory,
} from "@/lib/skills";

export const metadata: Metadata = {
  title: "Skills",
  description:
    "Every skill in the Aeon Terminal catalog, grouped by category. Configure once, schedule, forget.",
};

const ORDER: SkillCategory[] = [
  "research",
  "dev",
  "crypto",
  "social",
  "productivity",
  "meta",
];

export default function SkillsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
      <div className="mb-10">
        <p className="text-[11px] uppercase tracking-widest text-muted">
          $ ls -R skills/
        </p>
        <h1 className="mt-1 text-3xl tracking-tight text-foreground sm:text-4xl">
          Skill catalog
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
          Each skill is a single markdown file with a prompt, a schedule, and a
          contract. {SKILLS.filter((s) => !s.comingSoon).length} of{" "}
          {SKILLS.length} skills are live now — the rest are scaffolded and
          coming soon.
        </p>
        <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded border border-border bg-border sm:grid-cols-3 md:grid-cols-6">
          {ORDER.map((key) => (
            <a
              key={key}
              href={`#${key}`}
              className="bg-surface px-3 py-2 transition-colors hover:bg-surface-2"
            >
              <dt className={`text-[11px] ${CATEGORIES[key].accent}`}>
                {CATEGORIES[key].label}
              </dt>
              <dd className="text-foreground">
                {SKILL_COUNT_BY_CATEGORY[key]}
              </dd>
            </a>
          ))}
        </dl>

        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-md border border-accent/30 bg-accent/[0.05] px-4 py-3">
          <span className="text-[11px] uppercase tracking-[0.25em] text-accent">
            new · build your own
          </span>
          <p className="flex-1 text-xs leading-relaxed text-muted sm:text-sm">
            Design a Claude persona, name it, and run it from the terminal.
            Public ones are shareable as a link.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/skills/create"
              className="rounded border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs text-accent hover:bg-accent/20"
            >
              + create skill
            </Link>
            <Link
              href="/skills/mine"
              className="rounded border border-border bg-surface px-3 py-1.5 text-xs text-muted hover:border-border-strong hover:text-foreground"
            >
              ~/skills
            </Link>
          </div>
        </div>
      </div>

      <CommunitySkills />

      <div className="space-y-14">
        {ORDER.map((key) => {
          const cat = CATEGORIES[key];
          const skills = SKILLS.filter((s) => s.category === key).sort(
            (a, b) => Number(!!a.comingSoon) - Number(!!b.comingSoon),
          );
          const live = skills.filter((s) => !s.comingSoon).length;
          return (
            <section
              key={key}
              id={key}
              className="scroll-mt-20 border-t border-border pt-8"
            >
              <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className={`text-[11px] uppercase tracking-widest ${cat.accent}`}>
                    {cat.label}
                  </p>
                  <h2 className="mt-1 text-xl text-foreground sm:text-2xl">
                    {live} live{" "}
                    <span className="text-muted-2">
                      / {skills.length} total
                    </span>
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm text-muted">
                    {cat.description}
                  </p>
                </div>
              </header>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {skills.map((s) => (
                  <SkillCard key={s.slug} skill={s} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
