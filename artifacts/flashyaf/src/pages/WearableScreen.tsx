import { useState, useEffect } from "react";
import { collection, addDoc, query, where, getDocs, getCountFromServer } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

interface Props {
  onBack: () => void;
}

// ─── Connection framework ──────────────────────────────────────────────────
// Structural placeholder managers for each wearable ecosystem.
// Replace each `connect*` function with real SDK/OAuth flows when APIs are live.

type DeviceStatus = "disconnected" | "connecting" | "connected" | "error";

const LS_DEVICE_KEY = "flashyaf_device_toggles";

function loadToggles(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(LS_DEVICE_KEY) || "{}"); } catch { return {}; }
}
function saveToggles(t: Record<string, boolean>) {
  try { localStorage.setItem(LS_DEVICE_KEY, JSON.stringify(t)); } catch {}
}

/**
 * Apple Watch — CoreBluetooth / HealthKit
 * Real path: Web Bluetooth API + WKWebView bridge or Shortcuts automation.
 * Placeholder: simulates a BLE scan delay.
 */
async function connectAppleWatch(): Promise<{ ok: boolean; message: string }> {
  await new Promise((r) => setTimeout(r, 1800));
  // TODO: navigator.bluetooth.requestDevice({ filters: [{ services: ["heart_rate"] }] })
  return { ok: false, message: "Apple Watch integration coming in FLASHYAF™ 2.0. Join the waitlist to get first access." };
}

/**
 * Fitbit — Fitbit Web API (OAuth 2.0 + Webhook subscriptions)
 * Real path: OAuth redirect → token exchange → POST /1/user/-/apiSubscriptions.json
 * Placeholder: simulates token negotiation.
 */
async function connectFitbit(): Promise<{ ok: boolean; message: string }> {
  await new Promise((r) => setTimeout(r, 1400));
  // TODO: window.open("https://www.fitbit.com/oauth2/authorize?...", "_blank")
  return { ok: false, message: "Fitbit API integration coming in FLASHYAF™ 2.0. Join the waitlist to get first access." };
}

/**
 * Garmin — Garmin Connect IQ / Garmin Health API
 * Real path: Garmin Health API → webhook push subscription
 * Placeholder: simulates handshake.
 */
async function connectGarmin(): Promise<{ ok: boolean; message: string }> {
  await new Promise((r) => setTimeout(r, 1600));
  // TODO: POST https://healthapi.garmin.com/wellness-api/rest/backfill/activities
  return { ok: false, message: "Garmin Connect integration coming in FLASHYAF™ 2.0. Join the waitlist to get first access." };
}

/**
 * Oura Ring — Oura Web API v2
 * Real path: GET https://api.ouraring.com/v2/usercollection/heartrate (Bearer token)
 * Placeholder: simulates polling setup.
 */
async function connectOura(): Promise<{ ok: boolean; message: string }> {
  await new Promise((r) => setTimeout(r, 1200));
  // TODO: fetch("https://api.ouraring.com/v2/usercollection/heartrate", { headers: { Authorization: `Bearer ${token}` } })
  return { ok: false, message: "Oura Ring API integration coming in FLASHYAF™ 2.0. Join the waitlist to get first access." };
}

const CONNECTION_MANAGERS: Record<string, () => Promise<{ ok: boolean; message: string }>> = {
  apple_watch: connectAppleWatch,
  fitbit: connectFitbit,
  garmin: connectGarmin,
  oura: connectOura,
};

// ─── Device definitions ────────────────────────────────────────────────────

const DEVICES = [
  { id: "apple_watch", name: "Apple Watch", icon: "⌚", color: "#1C1C1E", accent: "#0A84FF",
    apiLabel: "CoreBluetooth / HealthKit", biometrics: ["Heart Rate", "Skin Temp", "Steps"] },
  { id: "fitbit", name: "Fitbit", icon: "💜", color: "#00B0B9", accent: "#00B0B9",
    apiLabel: "Fitbit Web API + Webhooks", biometrics: ["Heart Rate", "SpO₂", "Skin Temp"] },
  { id: "garmin", name: "Garmin", icon: "🏃", color: "#007CC3", accent: "#007CC3",
    apiLabel: "Garmin Connect API", biometrics: ["Heart Rate", "Stress Score", "Body Battery"] },
  { id: "oura", name: "Oura Ring", icon: "💍", color: "#2C2C2C", accent: "#C8A84B",
    apiLabel: "Oura Web API v2", biometrics: ["HRV", "Skin Temp", "Sleep Score"] },
] as const;

type DeviceId = (typeof DEVICES)[number]["id"];

export default function WearableScreen({ onBack }: Props) {
  const { user } = useAuth();
  const [selectedDevice, setSelectedDevice] = useState<DeviceId | null>(null);
  const [email, setEmail] = useState(user?.email || "");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [waitlistCount, setWaitlistCount] = useState<number | null>(null);

  // ── Connection toggle state ───────────────────────────────────────────────
  const [toggles, setToggles] = useState<Record<string, boolean>>(() => loadToggles());
  const [statuses, setStatuses] = useState<Record<string, DeviceStatus>>({});
  const [statusMsg, setStatusMsg] = useState<Record<string, string>>({});

  async function handleToggle(deviceId: string) {
    const isOn = toggles[deviceId] ?? false;
    if (isOn) {
      // Disconnect
      const next = { ...toggles, [deviceId]: false };
      setToggles(next); saveToggles(next);
      setStatuses((p) => ({ ...p, [deviceId]: "disconnected" }));
      setStatusMsg((p) => ({ ...p, [deviceId]: "" }));
      return;
    }
    // Attempt connection via structural manager
    setStatuses((p) => ({ ...p, [deviceId]: "connecting" }));
    setStatusMsg((p) => ({ ...p, [deviceId]: "Initialising connection…" }));
    const manager = CONNECTION_MANAGERS[deviceId];
    if (!manager) return;
    const result = await manager();
    if (result.ok) {
      const next = { ...toggles, [deviceId]: true };
      setToggles(next); saveToggles(next);
      setStatuses((p) => ({ ...p, [deviceId]: "connected" }));
    } else {
      setStatuses((p) => ({ ...p, [deviceId]: "error" }));
    }
    setStatusMsg((p) => ({ ...p, [deviceId]: result.message }));
    // Auto-clear message after 6 seconds
    setTimeout(() => setStatusMsg((p) => ({ ...p, [deviceId]: "" })), 6000);
  }

  useEffect(() => {
    getCountFromServer(collection(db, "waitlist"))
      .then((snap) => setWaitlistCount(snap.data().count))
      .catch(() => {});
  }, [submitted]);

  const device = DEVICES.find((d) => d.id === selectedDevice) ?? null;

  function openModal(id: DeviceId) {
    setSelectedDevice(id);
    setSubmitted(false);
    setError("");
    setEmail(user?.email || "");
  }

  function closeModal() {
    setSelectedDevice(null);
    setSubmitted(false);
    setError("");
  }

  async function handleJoinWaitlist() {
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Please enter a valid email address.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      // Avoid duplicate entries for same email + device
      const existing = await getDocs(
        query(
          collection(db, "waitlist"),
          where("email", "==", trimmed),
          where("device", "==", selectedDevice)
        )
      );
      if (existing.empty) {
        await addDoc(collection(db, "waitlist"), {
          email: trimmed,
          device: selectedDevice,
          deviceName: device?.name,
          userId: user?.uid || null,
          timestamp: Date.now(),
        });
      }
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={onBack}>← Back</button>
        <div style={styles.headerCenter}>
          <p style={styles.appName}>FLASHYAF™</p>
          <p style={styles.headerTitle}>Connect Your Device</p>
        </div>
        <div style={{ width: "60px" }} />
      </div>

      <div style={styles.content}>
        {/* Hero */}
        <div style={styles.heroCard}>
          <p style={styles.heroEmoji}>🔗</p>
          <p style={styles.heroTitle}>Wearable Integration</p>
          <p style={styles.heroSub}>
            Sync your wearable for automatic flash detection, heart rate tracking, and effortless logging — no tapping required.
          </p>
        </div>

        {/* Social proof — waitlist count */}
        {waitlistCount !== null && waitlistCount > 0 && (
          <div style={styles.waitlistCountBanner}>
            <span style={styles.waitlistCountFlame}>🔥</span>
            <span style={styles.waitlistCountText}>
              <strong>{waitlistCount.toLocaleString()}</strong> women already on the waitlist
            </span>
          </div>
        )}

        {/* ── Connect Your Device — toggle dashboard ── */}
        <div style={styles.connectSection}>
          <p style={styles.connectTitle}>Connect Your Device</p>
          <p style={styles.connectSub}>
            Activation toggles below stream biometrics into your baseline telemetry matrix once live APIs are deployed.
          </p>
          {DEVICES.map((d) => {
            const isOn = toggles[d.id] ?? false;
            const st = statuses[d.id] ?? "disconnected";
            const msg = statusMsg[d.id] ?? "";
            const isConnecting = st === "connecting";
            return (
              <div key={d.id} style={{ ...styles.toggleRow, borderColor: isOn ? d.accent + "55" : "rgba(255,255,255,0.08)" }}>
                {/* Icon */}
                <div style={{ ...styles.toggleIcon, background: d.color + "22", border: `1px solid ${d.accent}33` }}>
                  <span style={{ fontSize: "20px" }}>{d.icon}</span>
                </div>
                {/* Info */}
                <div style={styles.toggleInfo}>
                  <p style={styles.toggleName}>{d.name}</p>
                  <p style={styles.toggleApi}>{d.apiLabel}</p>
                  <div style={styles.biometricRow}>
                    {d.biometrics.map((b) => (
                      <span key={b} style={{ ...styles.biometricPill, borderColor: d.accent + "44", color: isOn ? d.accent : "rgba(255,255,255,0.3)" }}>
                        {b}
                      </span>
                    ))}
                  </div>
                  {msg ? (
                    <p style={{ ...styles.statusMsg, color: st === "error" ? "#F5A623" : "#1ABC9C" }}>{msg}</p>
                  ) : null}
                </div>
                {/* Toggle switch */}
                <button
                  style={{
                    ...styles.toggleSwitch,
                    background: isConnecting
                      ? "rgba(245,166,35,0.25)"
                      : isOn
                        ? `linear-gradient(135deg, ${d.accent}, ${d.accent}cc)`
                        : "rgba(255,255,255,0.08)",
                    border: isConnecting
                      ? "1px solid rgba(245,166,35,0.6)"
                      : isOn
                        ? `1px solid ${d.accent}`
                        : "1px solid rgba(255,255,255,0.15)",
                  }}
                  onClick={() => handleToggle(d.id)}
                  disabled={isConnecting}
                  title={isOn ? `Disconnect ${d.name}` : `Connect ${d.name}`}
                >
                  <span style={{
                    ...styles.toggleKnob,
                    transform: isOn ? "translateX(20px)" : "translateX(0px)",
                    background: isConnecting ? "#F5A623" : isOn ? "#fff" : "rgba(255,255,255,0.4)",
                  }} />
                </button>
              </div>
            );
          })}
        </div>

        {/* Device grid */}
        <p style={styles.gridLabel}>Join the Waitlist — FLASHYAF™ 2.0</p>
        <div style={styles.deviceGrid}>
          {DEVICES.map((d) => (
            <button
              key={d.id}
              style={styles.deviceCard}
              onClick={() => openModal(d.id)}
            >
              {/* Coming soon badge */}
              <div style={styles.comingSoonBadge}>
                <span style={styles.comingSoonText}>COMING SOON</span>
              </div>

              <div style={{ ...styles.deviceIconCircle, background: d.color + "22", border: `1px solid ${d.accent}44` }}>
                <span style={styles.deviceIcon}>{d.icon}</span>
              </div>
              <p style={styles.deviceName}>{d.name}</p>
              <p style={styles.deviceCta}>Join waitlist →</p>
            </button>
          ))}
        </div>

        {/* Info strip */}
        <div style={styles.infoStrip}>
          <p style={styles.infoLine}>🔒 Your data stays private</p>
          <p style={styles.infoLine}>⚡ Real-time flash detection</p>
          <p style={styles.infoLine}>📊 Richer pattern insights</p>
        </div>
      </div>

      {/* Modal */}
      {selectedDevice && device && (
        <div style={styles.backdrop} onClick={closeModal}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            {submitted ? (
              /* ── Success state ── */
              <div style={styles.successContent}>
                <div style={styles.successCheck}>✓</div>
                <p style={styles.successTitle}>You're on the list!</p>
                <p style={styles.successBody}>
                  When FLASHYAF™ wearable launches, you get <strong>first access</strong> and a founding member discount of <strong style={{ color: "#F5A623" }}>40% off</strong>. We'll reach out to {email.trim()} the moment it's ready.
                </p>
                {waitlistCount !== null && waitlistCount > 0 && (
                  <div style={styles.waitlistCountPill}>
                    🔥 {waitlistCount.toLocaleString()} women already waiting
                  </div>
                )}
                <button style={styles.doneBtn} onClick={closeModal}>Done</button>
              </div>
            ) : (
              /* ── Waitlist form ── */
              <>
                <button style={styles.closeBtn} onClick={closeModal}>✕</button>
                <div style={styles.modalIconCircle}>
                  <span style={styles.modalIcon}>{device.icon}</span>
                </div>
                <p style={styles.v2Badge}>FLASHYAF™ 2.0</p>
                <p style={styles.modalTitle}>Wearable integration coming soon!</p>
                <p style={styles.modalBody}>
                  Join the waitlist and be the first to know when{" "}
                  <strong>{device.name}</strong> integration launches.
                </p>

                <div style={styles.formGroup}>
                  <p style={styles.inputLabel}>Your email address</p>
                  <input
                    style={styles.emailInput}
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(""); }}
                  />
                  {error && <p style={styles.formError}>{error}</p>}
                </div>

                <button
                  style={{ ...styles.waitlistBtn, opacity: submitting ? 0.7 : 1 }}
                  onClick={handleJoinWaitlist}
                  disabled={submitting}
                >
                  {submitting ? "Joining…" : "🚀 Join the Waitlist"}
                </button>

                <p style={styles.modalDisclaimer}>
                  No spam. Unsubscribe any time.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh", background: "var(--color-bg)",
    display: "flex", flexDirection: "column",
    maxWidth: "480px", margin: "0 auto",
    fontFamily: "'Inter', sans-serif",
  },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "16px 16px 12px",
    borderBottom: "1px solid rgba(255,255,255,0.1)",
  },
  backBtn: {
    background: "transparent", border: "none",
    color: "rgba(255,255,255,0.6)", fontSize: "15px",
    fontWeight: 600, cursor: "pointer", padding: "6px 0",
    fontFamily: "'Inter', sans-serif", minWidth: "60px",
  },
  headerCenter: { textAlign: "center" },
  appName: {
    color: "var(--color-accent)", fontSize: "11px",
    fontWeight: 900, letterSpacing: "2px", margin: 0,
  },
  headerTitle: {
    color: "var(--color-text)", fontSize: "18px", fontWeight: 800, margin: 0,
  },
  content: {
    flex: 1, padding: "20px 16px 40px",
    display: "flex", flexDirection: "column", gap: "16px",
    overflowY: "auto",
  },

  // Hero
  heroCard: {
    background: "linear-gradient(135deg, rgba(192,57,43,0.15) 0%, rgba(255,69,0,0.08) 100%)",
    border: "1px solid rgba(255,69,0,0.25)", borderRadius: "18px",
    padding: "24px 20px", textAlign: "center",
  },
  heroEmoji: { fontSize: "40px", margin: "0 0 10px" },
  heroTitle: {
    color: "var(--color-text)", fontSize: "20px", fontWeight: 800, margin: "0 0 8px",
  },
  heroSub: {
    color: "rgba(255,255,255,0.5)", fontSize: "13px",
    lineHeight: 1.6, margin: 0,
  },

  // Device grid
  gridLabel: {
    color: "rgba(255,255,255,0.35)", fontSize: "11px",
    fontWeight: 700, textTransform: "uppercase" as const,
    letterSpacing: "1.2px", margin: "0 0 4px",
  },
  deviceGrid: {
    display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px",
  },
  deviceCard: {
    background: "var(--color-card)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "16px", padding: "18px 12px 14px",
    display: "flex", flexDirection: "column",
    alignItems: "center", gap: "8px",
    cursor: "pointer", position: "relative" as const,
    transition: "border 0.2s ease, background 0.2s ease",
  },
  comingSoonBadge: {
    position: "absolute" as const, top: "10px", right: "10px",
    background: "linear-gradient(90deg, #F5A623, #FFD700)",
    borderRadius: "100px", padding: "3px 8px",
  },
  comingSoonText: {
    fontSize: "8px", fontWeight: 900,
    color: "#1A1A1A", letterSpacing: "0.8px",
    fontFamily: "'Inter', sans-serif",
  },
  deviceIconCircle: {
    width: "56px", height: "56px", borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  deviceIcon: { fontSize: "28px", lineHeight: 1 },
  deviceName: {
    color: "var(--color-text)", fontSize: "14px", fontWeight: 700, margin: 0,
  },
  deviceCta: {
    color: "rgba(255,255,255,0.35)", fontSize: "11px",
    fontWeight: 600, margin: 0,
  },

  // Info strip
  infoStrip: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "14px", padding: "14px 18px",
    display: "flex", flexDirection: "column", gap: "8px",
  },
  infoLine: {
    color: "rgba(255,255,255,0.5)", fontSize: "13px",
    fontWeight: 600, margin: 0,
  },

  // Modal backdrop
  backdrop: {
    position: "fixed" as const, inset: 0, zIndex: 500,
    background: "rgba(0,0,0,0.75)",
    backdropFilter: "blur(8px)",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: "24px",
  },
  modal: {
    background: "#181818",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "24px", padding: "32px 24px 28px",
    width: "100%", maxWidth: "380px",
    display: "flex", flexDirection: "column",
    alignItems: "center", gap: "12px",
    position: "relative" as const,
    boxShadow: "0 24px 80px rgba(0,0,0,0.7)",
    animation: "slideUp 0.3s ease",
  },
  closeBtn: {
    position: "absolute" as const, top: "16px", right: "16px",
    background: "rgba(255,255,255,0.08)", border: "none",
    borderRadius: "50%", width: "28px", height: "28px",
    color: "rgba(255,255,255,0.5)", fontSize: "13px",
    cursor: "pointer", fontFamily: "'Inter', sans-serif",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  modalIconCircle: {
    width: "64px", height: "64px", borderRadius: "50%",
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.12)",
    display: "flex", alignItems: "center", justifyContent: "center",
    marginBottom: "4px",
  },
  modalIcon: { fontSize: "32px" },
  v2Badge: {
    background: "linear-gradient(90deg, #F5A623, #FFD700)",
    borderRadius: "100px", padding: "4px 14px",
    fontSize: "10px", fontWeight: 900, color: "#1A1A1A",
    letterSpacing: "1px",
  },
  modalTitle: {
    color: "#fff", fontSize: "19px", fontWeight: 800,
    margin: 0, textAlign: "center",
  },
  modalBody: {
    color: "rgba(255,255,255,0.55)", fontSize: "13px",
    lineHeight: 1.6, margin: 0, textAlign: "center",
  },
  formGroup: {
    width: "100%", display: "flex", flexDirection: "column", gap: "6px",
  },
  inputLabel: {
    color: "rgba(255,255,255,0.4)", fontSize: "11px",
    fontWeight: 700, textTransform: "uppercase" as const,
    letterSpacing: "0.8px", margin: 0,
  },
  emailInput: {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.2)",
    borderRadius: "12px", padding: "13px 16px",
    color: "#fff", fontSize: "15px", outline: "none",
    fontFamily: "'Inter', sans-serif",
    width: "100%", boxSizing: "border-box" as const,
  },
  formError: { color: "#FF6B6B", fontSize: "12px", margin: 0 },
  waitlistBtn: {
    width: "100%",
    background: "linear-gradient(135deg, #C0392B 0%, #E74C3C 100%)",
    border: "none", borderRadius: "100px",
    color: "#fff", fontSize: "16px", fontWeight: 800,
    padding: "16px 24px", cursor: "pointer",
    fontFamily: "'Inter', sans-serif",
    boxShadow: "0 0 28px rgba(192,57,43,0.45)",
    transition: "opacity 0.2s ease",
  },
  modalDisclaimer: {
    color: "rgba(255,255,255,0.2)", fontSize: "11px",
    margin: 0, textAlign: "center",
  },

  // Waitlist count
  waitlistCountBanner: {
    display: "flex", alignItems: "center", gap: "10px",
    background: "rgba(255,107,53,0.08)", border: "1px solid rgba(255,107,53,0.25)",
    borderRadius: "100px", padding: "10px 18px",
  },
  waitlistCountFlame: { fontSize: "18px" },
  waitlistCountText: { color: "rgba(255,255,255,0.6)", fontSize: "13px", fontWeight: 600 },
  waitlistCountPill: {
    background: "rgba(245,166,35,0.12)", border: "1px solid rgba(245,166,35,0.3)",
    borderRadius: "100px", padding: "8px 18px",
    color: "#F5A623", fontSize: "13px", fontWeight: 700,
    textAlign: "center" as const,
  },

  // Success state
  successContent: {
    display: "flex", flexDirection: "column",
    alignItems: "center", gap: "12px",
    padding: "8px 0",
  },
  successCheck: {
    width: "64px", height: "64px", borderRadius: "50%",
    background: "rgba(26,188,156,0.15)",
    border: "2px solid #1ABC9C",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "28px", color: "#1ABC9C", fontWeight: 900,
  },
  successTitle: {
    color: "#fff", fontSize: "22px", fontWeight: 900, margin: 0,
  },
  successBody: {
    color: "rgba(255,255,255,0.6)", fontSize: "14px",
    lineHeight: 1.6, textAlign: "center", margin: 0,
  },
  successEmail: {
    color: "#1ABC9C", fontSize: "13px", fontWeight: 700,
    background: "rgba(26,188,156,0.1)", borderRadius: "100px",
    padding: "6px 16px", margin: 0,
  },
  doneBtn: {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: "100px", color: "#fff",
    fontSize: "15px", fontWeight: 700,
    padding: "13px 40px", cursor: "pointer",
    fontFamily: "'Inter', sans-serif", marginTop: "4px",
  },

  // ── Connect Your Device dashboard ──
  connectSection: {
    background: "linear-gradient(160deg, rgba(11,31,58,0.7) 0%, rgba(10,10,10,0.4) 100%)",
    border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: "18px", padding: "18px 16px",
    display: "flex", flexDirection: "column", gap: "10px",
  },
  connectTitle: {
    color: "#fff", fontSize: "16px", fontWeight: 800, margin: 0,
  },
  connectSub: {
    color: "rgba(255,255,255,0.38)", fontSize: "12px",
    lineHeight: 1.5, margin: "0 0 4px",
  },
  toggleRow: {
    display: "flex", alignItems: "center", gap: "12px",
    background: "rgba(255,255,255,0.03)",
    border: "1px solid",
    borderRadius: "14px", padding: "12px 14px",
    transition: "border-color 0.3s ease",
  },
  toggleIcon: {
    width: "44px", height: "44px", borderRadius: "12px",
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  toggleInfo: {
    flex: 1, display: "flex", flexDirection: "column", gap: "3px",
    minWidth: 0,
  },
  toggleName: {
    color: "#fff", fontSize: "14px", fontWeight: 700, margin: 0,
  },
  toggleApi: {
    color: "rgba(255,255,255,0.3)", fontSize: "10px",
    fontWeight: 600, margin: 0, letterSpacing: "0.3px",
  },
  biometricRow: {
    display: "flex", gap: "5px", flexWrap: "wrap" as const, marginTop: "3px",
  },
  biometricPill: {
    fontSize: "9px", fontWeight: 700, letterSpacing: "0.3px",
    padding: "2px 7px", borderRadius: "100px",
    border: "1px solid",
    transition: "color 0.3s ease",
  },
  statusMsg: {
    fontSize: "11px", fontWeight: 600, margin: "3px 0 0",
    lineHeight: 1.4,
  },
  toggleSwitch: {
    width: "46px", height: "26px",
    borderRadius: "13px",
    position: "relative" as const,
    cursor: "pointer",
    flexShrink: 0,
    display: "flex", alignItems: "center",
    padding: "3px",
    transition: "background 0.3s ease, border 0.3s ease",
  },
  toggleKnob: {
    width: "20px", height: "20px",
    borderRadius: "50%",
    transition: "transform 0.3s ease, background 0.3s ease",
    display: "block",
    flexShrink: 0,
  },
};
