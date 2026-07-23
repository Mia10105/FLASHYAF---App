import React from "react";

interface Props {
  label?: string;
}

export default function FlameSpinner({ label = "Loading…" }: Props) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "56px 24px", gap: "14px",
    }}>
      <span style={{ fontSize: "44px", display: "inline-block", animation: "flameSpin 1.1s ease-in-out infinite" }}>
        🔥
      </span>
      <p style={{
        color: "rgba(255,255,255,0.4)", fontSize: "14px", fontWeight: 600,
        margin: 0, letterSpacing: "0.3px",
      }}>
        {label}
      </p>
    </div>
  );
}
