"use client";

import { useState } from "react";

import { TOKEN, shortAddress } from "@/lib/token";

export function CABanner() {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(TOKEN.address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // clipboard unavailable; silently ignore
    }
  };

  return (
    <div
      role="region"
      aria-label="Aeon Terminal token contract"
      className="sticky top-0 z-40 w-full border-b border-border bg-[#050708]/95 backdrop-blur supports-[backdrop-filter]:bg-[#050708]/80"
    >
      <div className="mx-auto flex h-7 max-w-6xl items-center justify-between gap-3 px-4 text-[11px] sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-muted-2" aria-hidden>
            $
          </span>
          <span className="text-muted">CA</span>
          <span className="text-muted-2" aria-hidden>
            ·
          </span>
          <span className="text-muted">{TOKEN.chain}</span>
          <span className="hidden text-muted-2 sm:inline" aria-hidden>
            ·
          </span>
          <button
            type="button"
            onClick={onCopy}
            className="group inline-flex min-w-0 items-center gap-1.5 truncate text-accent transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
            aria-label={
              copied
                ? "Contract address copied"
                : `Copy ${TOKEN.symbol} contract address`
            }
            title={TOKEN.address}
          >
            <span className="hidden truncate font-medium md:inline">
              {TOKEN.address}
            </span>
            <span className="truncate font-medium md:hidden">
              {shortAddress(TOKEN.address, 6)}
            </span>
            <span
              className={
                copied
                  ? "text-accent-2"
                  : "text-muted-2 group-hover:text-foreground"
              }
              aria-hidden
            >
              {copied ? "✓ copied" : "[copy]"}
            </span>
          </button>
        </div>
        <div className="flex flex-shrink-0 items-center gap-3">
          <a
            href={TOKEN.buyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-2 hover:text-foreground"
          >
            buy ↗
          </a>
          <a
            href={TOKEN.scanUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden text-muted hover:text-foreground sm:inline"
          >
            basescan ↗
          </a>
        </div>
      </div>
    </div>
  );
}
