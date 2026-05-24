"use client";

import { useCallback, useEffect, useState } from "react";

const ERROR_HINTS: Record<string, string> = {
  google_not_configured:
    "Google OAuth client isn't wired up on the worker yet. Try GitHub or email.",
  github_not_configured:
    "GitHub OAuth client isn't wired up on the worker yet. Try Google or email.",
  email_not_configured:
    "Email magic links aren't configured on the worker yet. Try Google or GitHub.",
  db_not_configured:
    "Database binding isn't live on the worker yet. Try again in a minute.",
  invalid_state: "Login state expired or invalid — start again.",
  missing_params: "Provider returned without the expected callback params.",
  invalid_token: "Magic link is malformed.",
  token_expired: "Magic link expired (15 min). Request a new one.",
  google_no_sub: "Google didn't return an account identifier.",
  github_no_token: "GitHub didn't return an access token.",
};

function describeError(code: string | null): string | null {
  if (!code) return null;
  if (ERROR_HINTS[code]) return ERROR_HINTS[code];
  if (code.startsWith("google_token_")) return "Google token exchange failed.";
  if (code.startsWith("github_token_")) return "GitHub token exchange failed.";
  if (code.startsWith("google_")) return `Google: ${code.slice(7)}`;
  if (code.startsWith("github_")) return `GitHub: ${code.slice(7)}`;
  return `Login failed (${code}).`;
}

export function LoginPanel() {
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const params = new URLSearchParams(window.location.search);
      const code = params.get("error");
      if (!code) return;
      setError(describeError(code));
      const url = new URL(window.location.href);
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url.toString());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const submitEmail = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (sending) return;
      setEmailError(null);
      setSent(false);
      setSending(true);
      try {
        const res = await fetch("/api/auth/email/request", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: email.trim(), redirect: "/terminal" }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          detail?: string;
        };
        if (!res.ok || !data.ok) {
          if (data.error === "invalid_email") {
            setEmailError("That doesn't look like a valid email.");
          } else if (data.error === "email_not_configured") {
            setEmailError(
              "Email magic links aren't configured on the worker yet.",
            );
          } else {
            setEmailError(
              `Couldn't send the email (${data.error || res.status}).`,
            );
          }
          return;
        }
        setSent(true);
      } catch {
        setEmailError("Network error sending magic link.");
      } finally {
        setSending(false);
      }
    },
    [email, sending],
  );

  return (
    <section className="space-y-4 px-6 py-5">
      {error ? (
        <div
          role="alert"
          className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200"
        >
          {error}
        </div>
      ) : null}

      <div className="space-y-2">
        <a
          href="/api/auth/google/login?redirect=%2Fterminal"
          className="group flex w-full items-center justify-center gap-3 rounded border border-border-strong bg-background px-3 py-2.5 text-sm text-foreground transition-colors hover:border-accent hover:bg-surface-2"
        >
          <GoogleGlyph />
          <span>Continue with Google</span>
        </a>
        <a
          href="/api/auth/github/login?redirect=%2Fterminal"
          className="group flex w-full items-center justify-center gap-3 rounded border border-border-strong bg-background px-3 py-2.5 text-sm text-foreground transition-colors hover:border-accent hover:bg-surface-2"
        >
          <GithubGlyph />
          <span>Continue with GitHub</span>
        </a>
      </div>

      <div
        aria-hidden
        className="flex items-center gap-3 py-1 text-[10px] uppercase tracking-[0.3em] text-muted-2"
      >
        <span className="h-px flex-1 bg-border" />
        <span>or</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={submitEmail} className="space-y-2">
        <div className="flex items-baseline justify-between">
          <label
            htmlFor="login-email"
            className="text-[10px] uppercase tracking-[0.25em] text-muted-2"
          >
            email address
          </label>
          <span className="text-[10px] text-muted-2">magic link · 15 min</span>
        </div>
        <input
          id="login-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@domain.com"
          className="block w-full rounded border border-border-strong bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-2 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          disabled={sending || sent}
        />
        <button
          type="submit"
          disabled={sending || sent || !email.trim()}
          className="inline-flex w-full items-center justify-center gap-2 rounded border border-accent bg-accent/15 px-4 py-2.5 text-sm font-medium text-accent transition-colors hover:bg-accent/25 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span aria-hidden>{">"}</span>
          <span>
            {sending ? "sending…" : sent ? "link sent — check inbox" : "send magic link"}
          </span>
        </button>
        {emailError ? (
          <div
            role="alert"
            className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200"
          >
            {emailError}
          </div>
        ) : null}
        {sent ? (
          <div className="rounded border border-accent-2/40 bg-accent-2/10 px-3 py-2 text-xs text-accent-2">
            Check your inbox — the link expires in 15 minutes. (Look in spam
            if you don&apos;t see it.)
          </div>
        ) : null}
      </form>
    </section>
  );
}

function GoogleGlyph() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}

function GithubGlyph() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-4 w-4 fill-current"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 .5C5.73.5.67 5.57.67 11.83c0 5 3.24 9.24 7.74 10.74.57.1.78-.25.78-.55v-1.9c-3.15.68-3.81-1.52-3.81-1.52-.51-1.3-1.26-1.65-1.26-1.65-1.03-.7.08-.69.08-.69 1.14.08 1.74 1.18 1.74 1.18 1.01 1.74 2.66 1.23 3.31.94.1-.74.4-1.23.72-1.51-2.51-.29-5.16-1.26-5.16-5.61 0-1.24.44-2.25 1.17-3.04-.12-.29-.51-1.45.11-3.02 0 0 .96-.31 3.15 1.16a10.8 10.8 0 015.74 0c2.19-1.47 3.15-1.16 3.15-1.16.62 1.57.23 2.73.11 3.02.73.79 1.17 1.8 1.17 3.04 0 4.36-2.66 5.32-5.19 5.6.41.35.77 1.04.77 2.1v3.11c0 .3.2.66.79.55 4.5-1.5 7.74-5.74 7.74-10.74C23.33 5.57 18.27.5 12 .5z" />
    </svg>
  );
}
