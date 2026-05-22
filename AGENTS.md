# Aeon Terminal — agent notes

This is a from-scratch product site (Next.js 16 App Router) inspired by
[aaronjmars/aeon](https://github.com/aaronjmars/aeon). It is **not** the same
codebase as aeon — there is no `gh` integration, no GitHub Actions, no Claude
Code wiring. Treat it as a focused marketing/demo site.

## Working with this repo

- Stack: Next.js 16 (App Router + Turbopack), React 19, Tailwind CSS v4,
  TypeScript. All pages prerender as static — no server actions, no API routes.
- Heads up on Next.js 16: `cookies`, `headers`, `params`, `searchParams` are
  async. `experimental.turbopack` is now top-level `turbopack`. `middleware` is
  deprecated in favor of `proxy`. Read
  `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md` before
  introducing new server features.
- The skill catalog is data-only in `src/lib/skills.ts`. Add entries there and
  they flow into the home page, `/skills`, and the interactive terminal.

## Style

- One font: JetBrains Mono.
- Bicolor accent system (inspired by aeon): primary `#FF6B1A` (orange),
  secondary `#43C165` (green). Foreground `#e6edf3`, everything else muted gray.
  Tokens live in `src/app/globals.css`.
- Respect `prefers-reduced-motion`. Anything that animates must have a still
  fallback.

## Conventions

- Components in `src/components/`. PascalCase exports, kebab-case files.
- Pages are server components by default. Mark `"use client"` only when you
  need hooks or browser APIs.
- Keep PRs scoped. Don't touch unrelated files.
