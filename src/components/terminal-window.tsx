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
      <div className="flex items-center justify-between border-b border-border bg-surface-2 px-3 py-2">
        <div className="flex items-center gap-1.5">
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
        <p className="text-[11px] text-muted">
          <span className="text-muted-2">user@</span>
          {title}
          <span className="text-muted-2"> — </span>
          {host}
        </p>
        <p className="text-[11px] text-muted-2 hidden sm:block">
          {new Date().getFullYear()}
        </p>
      </div>
      <div className={`relative ${bodyClassName}`}>{children}</div>
    </div>
  );
}
