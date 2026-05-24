"use client";

import { useState } from "react";

import { TOKEN } from "@/lib/token";

interface Props {
  className?: string;
  label?: string;
}

export function CopyAddressButton({
  className = "",
  label = "[copy]",
}: Props) {
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
    <button
      type="button"
      onClick={onCopy}
      className={`inline-flex items-center gap-1 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent ${className}`}
      aria-label={copied ? "Contract address copied" : "Copy contract address"}
      title={TOKEN.address}
    >
      <span className={copied ? "text-accent-2" : undefined}>
        {copied ? "✓ copied" : label}
      </span>
    </button>
  );
}
