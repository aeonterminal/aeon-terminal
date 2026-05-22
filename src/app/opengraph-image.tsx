import { ImageResponse } from "next/og";

export const alt = "Aeon Terminal — Autonomous agents, from the terminal";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#07090b",
          color: "#e6edf3",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          padding: 64,
          backgroundImage:
            "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(74,222,128,0.18), transparent 60%)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontSize: 22,
            color: "#7d8590",
            letterSpacing: 4,
          }}
        >
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: 999,
              background: "#4ade80",
              boxShadow: "0 0 16px #4ade80",
            }}
          />
          AUTONOMOUS AGENT TERMINAL · V0.1.0
        </div>

        <div
          style={{
            marginTop: 56,
            display: "flex",
            alignItems: "baseline",
            gap: 18,
            fontSize: 132,
            lineHeight: 1,
            letterSpacing: -2,
          }}
        >
          <span style={{ color: "#7d8590" }}>$</span>
          <span style={{ color: "#e6edf3" }}>aeon</span>
          <span style={{ color: "#7d8590" }}>·</span>
          <span style={{ color: "#4ade80" }}>terminal</span>
        </div>

        <div
          style={{
            marginTop: 36,
            fontSize: 28,
            color: "#7d8590",
            maxWidth: 980,
            lineHeight: 1.4,
          }}
        >
          A terminal-first control surface for autonomous AI agents.
          Skills. Schedules. No supervision.
        </div>

        <div
          style={{
            marginTop: "auto",
            display: "flex",
            gap: 28,
            fontSize: 22,
            color: "#4ade80",
          }}
        >
          <span>{">"} 34+ skills</span>
          <span style={{ color: "#7d8590" }}>·</span>
          <span>cron + reactive</span>
          <span style={{ color: "#7d8590" }}>·</span>
          <span>self-healing</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
