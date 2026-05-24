import type { ReactNode } from "react";

type TerminalWindowProps = {
  title?: string;
  host?: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
};

export function TerminalWindow({
  title = "aeon-terminal",
  host = "~/agents",
  children,
  className = "",
  bodyClassName = "",
}: TerminalWindowProps) {
  return (
    <div className={`term-chrome rounded-md overflow-hidden ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-2 px-3 py-2">
        <div className="flex flex-shrink-0 items-center gap-1.5">
          <span
            aria-hidden
            className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]"
          />
          <span
            aria-hidden
            className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]"
          />
          <span
            aria-hidden
            className="h-2.5 w-2.5 rounded-full bg-[#27c93f]"
          />
        </div>
        <p className="min-w-0 truncate text-[11px] text-muted">
          <span className="text-muted-2">user@</span>
          {title}
          <span className="hidden text-muted-2 sm:inline"> — </span>
          <span className="hidden sm:inline">{host}</span>
        </p>
        <p className="hidden flex-shrink-0 text-[11px] text-muted-2 sm:block">
          {new Date().getFullYear()}
        </p>
      </div>
      <div className={`relative ${bodyClassName}`}>{children}</div>
    </div>
  );
}
