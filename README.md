<h1 align="center">aeon·terminal</h1>

<p align="center">
  <strong>Autonomous agents, from the terminal.</strong><br>
  A terminal-first control surface for autonomous AI agents. Configure skills, schedule runs, fan out notifications, and walk away.
</p>

<p align="center">
  <a href="https://nextjs.org"><img src="https://img.shields.io/badge/next.js-16-black?style=flat-square&logo=next.js" alt="Next.js 16"></a>
  <a href="https://react.dev"><img src="https://img.shields.io/badge/react-19-149eca?style=flat-square&logo=react" alt="React 19"></a>
  <a href="https://tailwindcss.com"><img src="https://img.shields.io/badge/tailwind-4-38bdf8?style=flat-square&logo=tailwindcss" alt="Tailwind v4"></a>
  <img src="https://img.shields.io/badge/license-MIT-FF6B1A?style=flat-square" alt="MIT">
</p>

---

## What this is

**Aeon Terminal** is a from-scratch product inspired by [aaronjmars/aeon](https://github.com/aaronjmars/aeon) — the autonomous agent framework. Where Aeon ships a Next.js dashboard plus GitHub Actions wiring, **Aeon Terminal** is a focused, terminal-first surface for the same idea:

- a **skill catalog** you browse like a unix tool
- an **interactive terminal** backed by **Claude** — `ask <q>` for free chat, `run <skill>` for per-skill personas
- a **manifesto** for why the most autonomous agent is the one that never asks

> **Heads up:** Aeon Terminal is a marketing/demo site, not the production agent framework. The skill outputs are generated live by Claude with a per-skill persona prompt — they are *plausible mock content*, not real briefings, PR reviews, or token alerts. See [aaronjmars/aeon](https://github.com/aaronjmars/aeon) for the autonomous-agent framework that actually runs on GitHub Actions.

## Pages

| Route        | What it is                                                          |
| ------------ | ------------------------------------------------------------------- |
| `/`          | Landing with animated hero terminal, principles, comparison, CTA.   |
| `/terminal`  | Real REPL backed by Claude — `ask`, `run <skill>`, plus local utility cmds. |
| `/skills`    | Browseable catalog of skills, grouped by category.                  |
| `/about`     | Manifesto + day-in-the-life timeline.                               |

## Stack

- **[Next.js 16](https://nextjs.org/)** with the App Router and Turbopack.
- **React 19**.
- **[Tailwind CSS v4](https://tailwindcss.com/)** with custom design tokens via `@theme inline`.
- **TypeScript** end-to-end.
- **JetBrains Mono** as the only font.

Pages prerender as static. The only runtime is a thin **Cloudflare Worker** that proxies a single endpoint (`/api/exec`) to Anthropic's Messages API with SSE streaming. The Anthropic key is a Worker secret (never in the repo or browser).

## Quick start

```bash
git clone https://github.com/aeonterminal/aeon-terminal
cd aeon-terminal
npm install
npm run dev   # → http://localhost:3000
```

### Scripts

| Command          | What it does                                |
| ---------------- | ------------------------------------------- |
| `npm run dev`    | Start the dev server on port 3000.          |
| `npm run build`  | Production build (Turbopack, static pages). |
| `npm run start`  | Serve the production build.                 |
| `npm run lint`   | ESLint via the flat config.                 |

## Repo layout

```
src/
  app/
    page.tsx              # /
    terminal/page.tsx     # /terminal
    skills/page.tsx       # /skills
    about/page.tsx        # /about
    icon.svg              # favicon
    apple-icon.svg
    opengraph-image.tsx   # /opengraph-image (1200x630)
    layout.tsx            # root layout (header/footer)
    globals.css           # design tokens, CRT styles
  components/
    site-header.tsx
    site-footer.tsx
    terminal-window.tsx   # window chrome (traffic-lights, title)
    hero-terminal.tsx     # animated typing demo (client)
    interactive-terminal.tsx  # REPL (client)
    skill-card.tsx
    ascii-logo.tsx
  lib/
    skills.ts             # skill catalog data
```

## Adding a skill

`src/lib/skills.ts` exports a typed `SKILLS` array. Add an entry:

```ts
{
  slug: "new-skill",
  name: "new-skill",
  category: "research",            // research | dev | crypto | social | productivity | meta
  summary: "What it does in one line.",
  cron: "0 6 * * *",               // or "@manual" / "@reactive" / "@daily"
  inputs: ["topic"],               // optional
  outputs: ["telegram"],           // optional
  selfHealing: true,               // optional
}
```

The skill will appear on `/skills`, get a card on the home page if you add it to `FEATURED_SLUGS`, and be runnable via `run new-skill` in the interactive terminal.

## Design notes

- **Mono everywhere.** The whole site is set in JetBrains Mono. The only deviation is bullets and headings.
- **Aeon bicolor.** Primary accent `#FF6B1A` (orange), secondary `#43C165` (green) — borrowed from the Evangelion-inspired palette in aaronjmars/aeon. Foreground `#e6edf3` on near-black. Everything else is muted gray.
- **Subtle CRT.** A scanline overlay and radial orange glow at the top. Designed to feel like a TUI, not look like one.
- **Reduced-motion aware.** All typing/blink animations respect `prefers-reduced-motion`.

## License

MIT. See [`LICENSE`](LICENSE).

## Credits

- Conceptually inspired by [aaronjmars/aeon](https://github.com/aaronjmars/aeon).
- Built with Next.js, React, and Tailwind CSS.
