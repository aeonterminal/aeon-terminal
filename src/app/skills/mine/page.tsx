import type { Metadata } from "next";

import { MineSkills } from "./mine-client";

export const metadata: Metadata = {
  title: "My skills",
  description:
    "Your custom Aeon Terminal skills. Run them, share them, delete them.",
};

export default function MineSkillsPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
      <header className="mb-8 space-y-2">
        <p className="text-[11px] uppercase tracking-[0.3em] text-muted">
          $ ls ~/skills
        </p>
        <h1 className="text-2xl tracking-tight text-foreground sm:text-3xl">
          Your <span className="text-accent glow-accent">custom skills</span>
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          Skills you&apos;ve built. Run them from{" "}
          <code className="text-foreground">/terminal</code>, share public ones
          with a link, or delete to free quota.
        </p>
      </header>

      <MineSkills />
    </main>
  );
}
