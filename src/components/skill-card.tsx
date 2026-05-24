import type { Skill } from "@/lib/skills";
import { CATEGORIES } from "@/lib/skills";

type Props = {
  skill: Skill;
  href?: string;
  className?: string;
};

export function SkillCard({ skill, className = "" }: Props) {
  const cat = CATEGORIES[skill.category];
  const dim = skill.comingSoon;
  return (
    <article
      className={`group relative flex flex-col gap-3 rounded-md border border-border bg-surface p-4 transition-colors hover:border-border-strong ${dim ? "opacity-50" : ""} ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className={`text-xs uppercase tracking-widest ${cat.accent}`}>
            {cat.label.split(" ")[0]}
          </p>
          <h3 className="text-sm text-foreground">
            <span className="text-muted">$</span> {skill.name}
          </h3>
        </div>
        <div className="flex flex-col items-end gap-1 text-[10px] uppercase tracking-widest text-muted-2">
          {dim ? (
            <span className="rounded border border-muted-2 px-1.5 py-0.5 text-muted-2">
              coming soon
            </span>
          ) : null}
          {!dim && skill.cron ? (
            <span className="rounded border border-border px-1.5 py-0.5 text-muted">
              {skill.cron}
            </span>
          ) : null}
          {skill.selfHealing ? (
            <span className="rounded border border-accent-dim px-1.5 py-0.5 text-accent">
              self-heal
            </span>
          ) : null}
        </div>
      </div>
      <p className="text-xs leading-relaxed text-muted">{skill.summary}</p>
      {dim && skill.requires ? (
        <p className="mt-auto text-[10px] text-muted-2">
          Needs: {skill.requires}
        </p>
      ) : null}
      {!dim && (skill.inputs?.length || skill.outputs?.length) ? (
        <div className="mt-auto flex flex-wrap gap-1 text-[10px] text-muted-2">
          {skill.inputs?.map((i) => (
            <span
              key={`in-${i}`}
              className="rounded border border-border px-1.5 py-0.5"
            >
              in:{i}
            </span>
          ))}
          {skill.outputs?.map((o) => (
            <span
              key={`out-${o}`}
              className="rounded border border-border px-1.5 py-0.5"
            >
              out:{o}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}
