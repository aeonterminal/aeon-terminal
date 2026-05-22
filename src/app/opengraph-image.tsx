import { ImageResponse } from "next/og";

export const alt = "Aeon Terminal — Autonomous agents, from the terminal";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-static";

export default async function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#0a0805",
          color: "#f0e8da",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          padding: 64,
          backgroundImage:
            "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(255,107,26,0.22), transparent 60%), radial-gradient(ellipse 50% 40% at 90% 105%, rgba(67,193,101,0.1), transparent 70%)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontSize: 22,
            color: "#968878",
            letterSpacing: 4,
          }}
        >
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: 999,
              background: "#FF6B1A",
              boxShadow: "0 0 16px #FF6B1A",
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
          <span style={{ color: "#968878" }}>$</span>
          <span style={{ color: "#f0e8da" }}>aeon</span>
          <span style={{ color: "#968878" }}>·</span>
          <span style={{ color: "#FF6B1A" }}>terminal</span>
        </div>

        <div
          style={{
            marginTop: 36,
            fontSize: 28,
            color: "#968878",
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
            color: "#FF6B1A",
          }}
        >
          <span>{">"} 34+ skills</span>
          <span style={{ color: "#968878" }}>·</span>
          <span style={{ color: "#43C165" }}>cron + reactive</span>
          <span style={{ color: "#968878" }}>·</span>
          <span>self-healing</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
