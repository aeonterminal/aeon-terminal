"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { NAV } from "./site-header";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Lock body scroll while open + close on escape.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 w-9 items-center justify-center rounded border border-border text-muted transition-colors hover:border-accent hover:text-accent"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden
        >
          {open ? (
            <path
              d="M3 3l10 10M13 3L3 13"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          ) : (
            <>
              <path
                d="M2 4h12"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
              <path
                d="M2 8h12"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
              <path
                d="M2 12h12"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </>
          )}
        </svg>
      </button>

      {/* Backdrop + sliding panel */}
      <div
        aria-hidden={!open}
        className={`fixed inset-x-0 top-12 z-40 transition-opacity duration-150 sm:hidden ${
          open
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
      >
        {/* backdrop */}
        <button
          type="button"
          aria-label="Close menu"
          tabIndex={-1}
          onClick={close}
          className="absolute inset-0 bg-background/70 backdrop-blur-sm"
        />

        {/* panel */}
        <div
          id="mobile-nav-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Site navigation"
          className="relative mx-3 mt-2 rounded-md border border-border bg-surface shadow-[0_30px_60px_-30px_rgba(0,0,0,0.6),0_0_60px_-40px_rgba(255,107,26,0.25)]"
        >
          <p className="border-b border-border px-4 py-2 text-[10px] uppercase tracking-[0.3em] text-muted-2">
            $ aeon nav
          </p>
          <nav className="flex flex-col py-2 text-sm">
            {NAV.map((n) => {
              const active = pathname === n.href;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  onClick={close}
                  className={`flex items-center gap-2 px-4 py-2.5 transition-colors ${
                    active
                      ? "text-accent"
                      : "text-foreground hover:bg-surface-2 hover:text-accent"
                  }`}
                >
                  <span
                    aria-hidden
                    className={
                      active ? "text-accent" : "text-muted-2"
                    }
                  >
                    {active ? ">" : "·"}
                  </span>
                  <span>{n.label}</span>
                </Link>
              );
            })}
            <a
              href="https://github.com/aeonterminal/aeon-terminal"
              target="_blank"
              rel="noopener noreferrer"
              onClick={close}
              className="mt-1 flex items-center gap-2 border-t border-border px-4 py-2.5 text-muted hover:text-accent"
            >
              <span aria-hidden className="text-muted-2">
                ↗
              </span>
              <span>github</span>
            </a>
          </nav>
        </div>
      </div>
    </>
  );
}
