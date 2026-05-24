"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type Me = {
  user: {
    id: string;
    email: string | null;
    name: string | null;
    avatar_url: string | null;
    provider: string | null;
    plan: string;
  } | null;
  usage?: {
    day: string;
    asks: number;
    runs: number;
    limits: { asks: number; runs: number };
  } | null;
};

export function UserBadge() {
  const [me, setMe] = useState<Me | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/me", { credentials: "include" });
        if (cancelled) return;
        if (!res.ok) {
          setMe({ user: null });
          return;
        }
        const data = (await res.json()) as Me;
        if (cancelled) return;
        setMe(data);
      } catch {
        if (!cancelled) setMe({ user: null });
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("click", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const signOut = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // ignore
    }
    setOpen(false);
    setMe({ user: null });
  }, []);

  if (me === null) {
    return (
      <span
        aria-hidden
        className="inline-block h-6 w-16 animate-pulse rounded bg-surface-2"
      />
    );
  }

  if (!me.user) {
    return (
      <Link
        href="/login"
        className="inline-flex items-center rounded border border-border px-2 py-1 text-xs text-muted transition-colors hover:border-accent hover:text-accent"
      >
        sign in
      </Link>
    );
  }

  const user = me.user;
  const label = user.name || user.email || "operator";
  const initial = (label[0] || "?").toUpperCase();
  const asks = me.usage?.asks ?? 0;
  const runs = me.usage?.runs ?? 0;
  const askLimit = me.usage?.limits.asks ?? 30;
  const runLimit = me.usage?.limits.runs ?? 10;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded border border-border px-1.5 py-1 text-xs text-foreground transition-colors hover:border-accent"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {user.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatar_url}
            alt=""
            className="h-5 w-5 rounded-full border border-border object-cover"
          />
        ) : (
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border bg-surface-2 text-[10px] uppercase text-muted">
            {initial}
          </span>
        )}
        <span className="hidden max-w-[120px] truncate text-foreground sm:inline">
          {label}
        </span>
        <span className="hidden text-muted sm:inline">·</span>
        <span className="hidden text-accent sm:inline">{user.plan}</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 rounded border border-border bg-surface p-3 text-xs shadow-lg"
        >
          <div className="mb-2 flex items-center gap-2 border-b border-border pb-2">
            {user.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatar_url}
                alt=""
                className="h-7 w-7 rounded-full border border-border object-cover"
              />
            ) : (
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface-2 text-xs uppercase text-muted">
                {initial}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-foreground">{label}</div>
              {user.email && user.email !== label ? (
                <div className="truncate text-muted">{user.email}</div>
              ) : null}
              <div className="text-muted">
                via <span className="text-foreground">{user.provider}</span> ·{" "}
                <span className="text-accent">{user.plan}</span>
              </div>
            </div>
          </div>
          <div className="mb-2 space-y-1 text-muted">
            <div className="flex justify-between">
              <span>asks today</span>
              <span className="text-foreground">
                {asks} / {askLimit}
              </span>
            </div>
            <div className="flex justify-between">
              <span>runs today</span>
              <span className="text-foreground">
                {runs} / {runLimit}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-1 border-t border-border pt-2">
            <Link
              href="/terminal"
              onClick={() => setOpen(false)}
              className="rounded px-2 py-1 text-muted hover:bg-surface-2 hover:text-foreground"
            >
              open terminal →
            </Link>
            <button
              type="button"
              onClick={signOut}
              className="rounded px-2 py-1 text-left text-muted hover:bg-surface-2 hover:text-foreground"
            >
              sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
