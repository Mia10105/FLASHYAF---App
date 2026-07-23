export default function NotFound() {
  return (
    <div style={{
      minHeight: "100dvh", width: "100%", display: "flex", alignItems: "center",
      justifyContent: "center", background: "#0A0A0A", flexDirection: "column",
      gap: "16px", fontFamily: "'DM Sans', sans-serif", padding: "24px",
    }}>
      <span style={{ fontSize: "56px" }}>🔥</span>
      <h1 style={{ color: "#FF4500", fontSize: "22px", fontWeight: 900, margin: 0, letterSpacing: "1px" }}>
        404 — Page Not Found
      </h1>
      <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "14px", margin: 0, textAlign: "center" }}>
        That page doesn't exist. Head back to FLASHYAF™.
      </p>
    </div>
  );
}
