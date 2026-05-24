import type { Metadata } from "next";

import { SkillRunner } from "./skill-runner";

export const metadata: Metadata = {
  title: "Run skill",
  description:
    "Run a shared Aeon Terminal skill. The skill executes against your own quota with the same tools as the catalog.",
};

export default function RunSkillPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
      <SkillRunner />
    </main>
  );
}
