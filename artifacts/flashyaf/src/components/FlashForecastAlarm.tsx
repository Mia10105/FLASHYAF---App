// ═══════════════════════════════════════════════════════════
// FLASH FORECAST ALARM™
// FLASHYAF™ | BROWNWORKS4U2 LLC | © 2026 | CONFIDENTIAL
// Proprietary feature — patent filing in progress
// BETA: Unlocked for all users. Moves to FLOW tier ($19.99/mo) post-launch.
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from "react";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Flash } from "@/types/flash";

// ── Types ─────────────────────────────────────────────────────────────────────

type ForecastResult =
  | {
      ready: false;
      reason?: "insufficient_data" | "irregular";
      completedCount: number;
    }
  | {
      ready: true;
      avgGapMinutes: number;
      predictedNextFlash: number; // ms timestamp
      minutesUntilFlash: number;
      confidence: "high" | "moderate";
      completedCount: number;
    };

interface ForecastPrefs {
  alertTiming: 0 | 5 | 10 | 15;
  alertSound: boolean;
  alertVibration: boolean;
  alertVisual: boolean; // always true — cannot be disabled
}

const DEFAULT_PREFS: ForecastPrefs = {
  alertTiming: 10,
  alertSound: true,
  alertVibration: true,
  alertVisual: true,
};

const PREFS_KEY = "flashyaf_forecast_prefs";
const MIN_SESSIONS = 5;

// ── Data fetch ────────────────────────────────────────────────────────────────

async function getForecastData(userId: string): Promise<Flash[]> {
  const snap = await getDocs(
    query(
      collection(db, "users", userId, "flashes"),
      orderBy("startTime", "desc"),
      limit(10)
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Flash));
}

// ── Pattern calculation ───────────────────────────────────────────────────────

function calculateForecast(sessions: Flash[]): ForecastResult {
  // Only count sessions that have both startTime and endTime (completed)
  const completed = sessions.filter((s) => s.startTime && s.endTime);

  if (completed.length < MIN_SESSIONS) {
    return { ready: false, reason: "insufficient_data", completedCount: completed.length };
  }

  // Sort newest → oldest
  const sorted = [...completed].sort((a, b) => b.startTime - a.startTime);

  // Compute gaps between consecutive startTimes (ms)
  const gaps: number[] = [];
  for (let i = 0; i < Math.min(sorted.length - 1, 5); i++) {
    gaps.push(sorted[i].startTime - sorted[i + 1].startTime);
  }

  if (gaps.length < 1) {
    return { ready: false, reason: "insufficient_data", completedCount: completed.length };
  }

  // Average gap in minutes
  const avgGapMs = gaps.reduce((s, g) => s + g, 0) / gaps.length;
  const avgGapMinutes = avgGapMs / 60000;

  // Standard deviation
  const mean = avgGapMs;
  const variance = gaps.reduce((s, g) => s + Math.pow(g - mean, 2), 0) / gaps.length;
  const stdDevMinutes = Math.sqrt(variance) / 60000;

  // Too irregular?
  if (stdDevMinutes > 25) {
    return { ready: false, reason: "irregular", completedCount: completed.length };
  }

  const lastSession = sorted[0];
  const predictedNextFlash = lastSession.startTime + avgGapMs;
  const minutesUntilFlash = Math.max(0, (predictedNextFlash - Date.now()) / 60000);

  return {
    ready: true,
    avgGapMinutes,
    predictedNextFlash,
    minutesUntilFlash,
    confidence: stdDevMinutes < 10 ? "high" : "moderate",
    completedCount: completed.length,
  };
}

// ── Alert sound (Web Audio API — no audio file needed) ────────────────────────

function playChime() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 528;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch { /* Web Audio unavailable — skip silently */ }
}

// ── Prefs helpers ─────────────────────────────────────────────────────────────

function loadPrefs(): ForecastPrefs {
  try {
    const stored = localStorage.getItem(PREFS_KEY);
    if (stored) return { ...DEFAULT_PREFS, ...JSON.parse(stored) };
  } catch { /* ignore */ }
  return { ...DEFAULT_PREFS };
}

function savePrefs(prefs: ForecastPrefs) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  userId: string;
  /** Pass true immediately after a flash completes to trigger recalculation */
  flashJustCompleted?: number;
  /** Pass true when a new flash begins so the panel hides */
  flashInProgress?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FlashForecastAlarm({ userId, flashJustCompleted, flashInProgress }: Props) {
  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [prefs, setPrefs] = useState<ForecastPrefs>(loadPrefs);
  const [showSettings, setShowSettings] = useState(false);
  const [alertBannerVisible, setAlertBannerVisible] = useState(false);
  const [snoozeMsg, setSnoozeMsg] = useState("");
  const [countdown, setCountdown] = useState<{ min: number; sec: number } | null>(null);
  const [alertFired, setAlertFired] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const alertBannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snoozeMsgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snoozeUntilRef = useRef<number | null>(null);
  const predictedRef = useRef<number | null>(null);

  // ── Load / recalculate forecast ─────────────────────────────────────────────
  const loadForecast = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const sessions = await getForecastData(userId);
      const result = calculateForecast(sessions);
      setForecast(result);
      if (result.ready) {
        predictedRef.current = result.predictedNextFlash;
        setAlertFired(false);
      }
    } catch { /* Firestore unavailable — fail silently */ }
    setLoading(false);
  }, [userId]);

  // Trigger on mount and whenever a flash completes
  useEffect(() => {
    loadForecast();
  }, [loadForecast, flashJustCompleted]);

  // ── Countdown ticker ────────────────────────────────────────────────────────
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    if (!forecast?.ready || flashInProgress) {
      setCountdown(null);
      return;
    }

    function tick() {
      const predicted = predictedRef.current;
      if (!predicted) return;

      const msLeft = Math.max(0, predicted - Date.now());
      const minLeft = Math.floor(msLeft / 60000);
      const secLeft = Math.floor((msLeft % 60000) / 1000);
      setCountdown({ min: minLeft, sec: secLeft });

      // Alert threshold check
      const minutesLeft = msLeft / 60000;
      const threshold = prefs.alertTiming;

      // If snoozed, wait for snooze to expire
      if (snoozeUntilRef.current && Date.now() < snoozeUntilRef.current) return;
      snoozeUntilRef.current = null;

      const shouldAlert = !alertFired && (
        threshold === 0 ? msLeft <= 0 : minutesLeft <= threshold && minutesLeft >= 0
      );

      if (shouldAlert) {
        setAlertFired(true);
        fireAlert();
      }
    }

    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [forecast, flashInProgress, prefs.alertTiming, alertFired]); // eslint-disable-line

  // Hide panel when flash is in progress
  if (flashInProgress) return null;

  // ── Alert firing ────────────────────────────────────────────────────────────
  function fireAlert() {
    // 1. Browser notification
    if ("Notification" in window) {
      if (Notification.permission === "granted") {
        new Notification("🌡️ FLASHYAF™ — Flash Forecast Alarm™", {
          body: "Possible flash window approaching. Start cooling early.",
          tag: "flashForecast",
          requireInteraction: false,
        });
      } else if (Notification.permission === "default") {
        Notification.requestPermission().then((perm) => {
          if (perm === "granted") {
            new Notification("🌡️ FLASHYAF™ — Flash Forecast Alarm™", {
              body: "Possible flash window approaching. Start cooling early.",
              tag: "flashForecast",
              requireInteraction: false,
            });
          }
        });
      }
      // If denied → in-app visual only (handled below — always shown)
    }

    // 2. In-app visual banner (always, regardless of notification permission)
    if (prefs.alertVisual) {
      setAlertBannerVisible(true);
      if (alertBannerTimerRef.current) clearTimeout(alertBannerTimerRef.current);
      alertBannerTimerRef.current = setTimeout(() => setAlertBannerVisible(false), 30000);
    }

    // 3. Vibration
    if (prefs.alertVibration && "vibrate" in navigator) {
      navigator.vibrate([200, 100, 200]);
    }

    // 4. Sound
    if (prefs.alertSound) playChime();

    // 5. Voice alert → PLACEHOLDER ONLY
    // PHASE 2: Voice alert via Web Speech API
  }

  function snoozeForecast(minutes: 5 | 10) {
    setAlertBannerVisible(false);
    snoozeUntilRef.current = Date.now() + minutes * 60000;
    setAlertFired(false); // allow re-fire after snooze
    const msg = `⏰ Snoozed for ${minutes} minutes`;
    setSnoozeMsg(msg);
    if (snoozeMsgTimerRef.current) clearTimeout(snoozeMsgTimerRef.current);
    snoozeMsgTimerRef.current = setTimeout(() => setSnoozeMsg(""), 3000);
  }

  function handleSavePrefs(updated: ForecastPrefs) {
    savePrefs(updated);
    setPrefs(updated);
    setShowSettings(false);
    setAlertFired(false); // re-arm after prefs change
  }

  // ── Render helpers ──────────────────────────────────────────────────────────

  function renderState() {
    if (loading) {
      return (
        <div style={s.stateBox}>
          <div style={s.spinner} />
          <p style={s.stateText}>Analyzing your pattern...</p>
        </div>
      );
    }

    if (!forecast) return null;

    if (!forecast.ready) {
      if (forecast.reason === "irregular") {
        return (
          <div style={s.stateBox}>
            <p style={s.stateEmoji}>📊</p>
            <p style={s.stateText}>Your flash pattern is still unpredictable. Keep logging and Flashy will learn.</p>
          </div>
        );
      }
      // insufficient_data
      const count = forecast.completedCount;
      const pct = Math.min(100, (count / MIN_SESSIONS) * 100);
      return (
        <div style={s.stateBox}>
          <p style={s.stateEmoji}>🧠</p>
          <p style={s.stateText}>
            Flashy needs <strong style={{ color: "#F39C12" }}>5 completed flashes</strong> to learn your pattern. You have <strong style={{ color: "#fff" }}>{count}</strong> so far.
          </p>
          <div style={s.progressTrack}>
            <div style={{ ...s.progressFill, width: `${pct}%` }} />
          </div>
          <p style={s.progressLabel}>{count} / {MIN_SESSIONS} flashes</p>
        </div>
      );
    }

    // forecast.ready — show countdown
    const isWindowOpen = (countdown?.min === 0 && countdown?.sec === 0) || forecast.minutesUntilFlash <= 0;
    const confColor = forecast.confidence === "high" ? "#0D9488" : "#E67E22";

    return (
      <div style={s.forecastActive}>
        {isWindowOpen ? (
          <p style={s.windowOpen}>🌡️ Flash window is open now — be ready</p>
        ) : (
          <>
            <p style={s.nextLabel}>Next possible flash window in:</p>
            <div style={{ ...s.countdownBox, animation: alertBannerVisible ? "forecastPulse 1.8s ease-in-out infinite" : "none" }}>
              <span style={s.countdownNum}>
                {countdown ? String(countdown.min).padStart(2, "0") : "--"}
              </span>
              <span style={s.countdownSep}>min</span>
              <span style={s.countdownNum}>
                {countdown ? String(countdown.sec).padStart(2, "0") : "--"}
              </span>
              <span style={s.countdownSep}>sec</span>
            </div>
          </>
        )}

        <div style={s.metaRow}>
          <span style={s.metaItem}>
            Avg gap: <strong style={{ color: "#fff" }}>~{Math.round(forecast.avgGapMinutes)} min</strong>
          </span>
          <span style={{ ...s.confidencePill, background: `${confColor}22`, border: `1px solid ${confColor}55`, color: confColor }}>
            {forecast.confidence.toUpperCase()}
          </span>
        </div>

        <p style={s.disclaimer}>⚠️ Pattern-based wellness alert. Not medical advice.</p>

        {snoozeMsg !== "" && (
          <div style={s.snoozeMsg}>{snoozeMsg}</div>
        )}

        {/* Snooze buttons — only visible when alert is active */}
        {alertBannerVisible && (
          <div style={s.snoozeRow}>
            <p style={s.snoozeLabel}>Snooze:</p>
            <button style={s.snoozeBtn} onClick={() => snoozeForecast(5)}>5 min</button>
            <button style={s.snoozeBtn} onClick={() => snoozeForecast(10)}>10 min</button>
          </div>
        )}

        {/* Alert settings — collapsible */}
        <button style={s.settingsToggle} onClick={() => setShowSettings((v) => !v)}>
          {showSettings ? "▲ Hide alert settings" : "▼ Alert settings"}
        </button>

        {showSettings && (
          <SettingsPanel prefs={prefs} onSave={handleSavePrefs} onCancel={() => setShowSettings(false)} />
        )}
      </div>
    );
  }

  return (
    <>
      {/* Full-width alert banner */}
      {alertBannerVisible && (
        <div style={s.alertBanner}>
          <div style={s.alertBannerInner}>
            <p style={s.alertBannerMain}>🌡️ Possible flash window approaching. Start cooling early.</p>
            <p style={s.alertBannerSub}>This is a pattern-based wellness alert, not a medical prediction.</p>
          </div>
          <button style={s.alertBannerDismiss} onClick={() => setAlertBannerVisible(false)}>✕</button>
        </div>
      )}

      {/* Forecast card */}
      <div style={s.card}>
        {/* Header */}
        <div style={s.cardHeader}>
          <div style={s.cardHeaderLeft}>
            <span style={s.cardIcon}>🌡️</span>
            <div>
              <p style={s.cardTitle}>Flash Forecast Alarm™</p>
              <p style={s.cardSubtitle}>Next flash predictor</p>
            </div>
          </div>
          <span style={s.betaBadge}>BETA</span>
        </div>

        {renderState()}
      </div>
    </>
  );
}

// ── Settings panel sub-component ──────────────────────────────────────────────

function SettingsPanel({ prefs, onSave, onCancel }: {
  prefs: ForecastPrefs;
  onSave: (p: ForecastPrefs) => void;
  onCancel: () => void;
}) {
  const [local, setLocal] = useState<ForecastPrefs>({ ...prefs });

  const timingOptions: { label: string; value: ForecastPrefs["alertTiming"] }[] = [
    { label: "5 min before", value: 5 },
    { label: "10 min before", value: 10 },
    { label: "15 min before", value: 15 },
    { label: "At predicted time", value: 0 },
  ];

  return (
    <div style={ss.panel}>
      <p style={ss.sectionLabel}>Alert me:</p>
      <div style={ss.timingGrid}>
        {timingOptions.map((opt) => (
          <button
            key={opt.value}
            style={{ ...ss.timingBtn, ...(local.alertTiming === opt.value ? ss.timingBtnActive : {}) }}
            onClick={() => setLocal((p) => ({ ...p, alertTiming: opt.value }))}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <p style={ss.sectionLabel}>Alert type:</p>
      <div style={ss.checkRow}>
        <label style={ss.checkLabel}>
          <input type="checkbox" checked={local.alertSound} onChange={(e) => setLocal((p) => ({ ...p, alertSound: e.target.checked }))} style={ss.checkbox} />
          Sound
        </label>
        <label style={ss.checkLabel}>
          <input type="checkbox" checked={local.alertVibration} onChange={(e) => setLocal((p) => ({ ...p, alertVibration: e.target.checked }))} style={ss.checkbox} />
          Vibration
        </label>
        <label style={{ ...ss.checkLabel, opacity: 0.5 }}>
          <input type="checkbox" checked={true} disabled style={ss.checkbox} />
          Visual (always on)
        </label>
      </div>

      {/* Voice alerts placeholder */}
      <div style={ss.voicePlaceholder}>
        <span style={ss.voicePlaceholderIcon}>🎙️</span>
        <span style={ss.voicePlaceholderText}>Voice alerts coming soon</span>
      </div>

      <div style={ss.saveRow}>
        <button style={ss.saveBtn} onClick={() => onSave(local)}>Save Preferences</button>
        <button style={ss.cancelBtn} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  // Alert banner
  alertBanner: {
    width: "100%",
    background: "linear-gradient(135deg, #E67E22 0%, #C0392B 100%)",
    borderRadius: "14px",
    padding: "14px 14px",
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    boxSizing: "border-box",
    marginBottom: "4px",
  },
  alertBannerInner: { flex: 1 },
  alertBannerMain: {
    color: "#fff",
    fontSize: "14px",
    fontWeight: 800,
    margin: "0 0 4px",
    lineHeight: 1.4,
  },
  alertBannerSub: {
    color: "rgba(255,255,255,0.75)",
    fontSize: "11px",
    fontWeight: 500,
    margin: 0,
    fontStyle: "italic",
  },
  alertBannerDismiss: {
    background: "rgba(255,255,255,0.2)",
    border: "none",
    borderRadius: "50%",
    width: "26px",
    height: "26px",
    color: "#fff",
    fontSize: "13px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  // Card
  card: {
    width: "100%",
    boxSizing: "border-box",
    background: "#111827",
    border: "1.5px solid rgba(243,156,18,0.3)",
    borderRadius: "20px",
    padding: "16px 18px 16px",
    marginTop: "14px",
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "14px",
  },
  cardHeaderLeft: { display: "flex", alignItems: "center", gap: "10px" },
  cardIcon: { fontSize: "28px", lineHeight: 1 },
  cardTitle: {
    color: "#fff",
    fontSize: "14px",
    fontWeight: 900,
    margin: "0 0 2px",
    letterSpacing: "0.3px",
  },
  cardSubtitle: {
    color: "rgba(255,255,255,0.35)",
    fontSize: "11px",
    fontWeight: 500,
    margin: 0,
  },
  betaBadge: {
    background: "#F39C12",
    color: "#0A0A0A",
    fontSize: "9px",
    fontWeight: 900,
    letterSpacing: "1px",
    borderRadius: "100px",
    padding: "3px 8px",
    flexShrink: 0,
  },

  // States
  stateBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    padding: "8px 0 4px",
    textAlign: "center",
  },
  stateEmoji: { fontSize: "28px", margin: 0 },
  stateText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: "13px",
    fontWeight: 500,
    lineHeight: 1.55,
    margin: 0,
    maxWidth: "280px",
  },
  spinner: {
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    border: "3px solid rgba(243,156,18,0.2)",
    borderTopColor: "#F39C12",
    animation: "spin 0.8s linear infinite",
  },
  progressTrack: {
    width: "100%",
    maxWidth: "220px",
    height: "6px",
    background: "rgba(255,255,255,0.1)",
    borderRadius: "3px",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    background: "linear-gradient(90deg, #F39C12, #E67E22)",
    borderRadius: "3px",
    transition: "width 0.5s ease",
  },
  progressLabel: {
    color: "rgba(255,255,255,0.35)",
    fontSize: "11px",
    fontWeight: 600,
    margin: 0,
  },

  // Active forecast
  forecastActive: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  nextLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: "12px",
    fontWeight: 600,
    margin: 0,
    textAlign: "center",
  },
  countdownBox: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "center",
    gap: "6px",
    background: "rgba(0,0,0,0.25)",
    borderRadius: "14px",
    padding: "14px 10px",
  },
  countdownNum: {
    fontFamily: "'Bebas Neue', 'DM Sans', sans-serif",
    fontSize: "48px",
    fontWeight: 900,
    color: "#F39C12",
    lineHeight: 1,
    letterSpacing: "-1px",
  },
  countdownSep: {
    color: "rgba(243,156,18,0.5)",
    fontSize: "14px",
    fontWeight: 700,
    marginRight: "8px",
  },
  windowOpen: {
    color: "#E67E22",
    fontSize: "15px",
    fontWeight: 800,
    textAlign: "center",
    margin: "8px 0",
    lineHeight: 1.4,
  },
  metaRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
  },
  metaItem: {
    color: "rgba(255,255,255,0.45)",
    fontSize: "12px",
    fontWeight: 500,
  },
  confidencePill: {
    fontSize: "10px",
    fontWeight: 900,
    letterSpacing: "1px",
    borderRadius: "100px",
    padding: "3px 9px",
    flexShrink: 0,
  },
  disclaimer: {
    color: "#94A3B8",
    fontSize: "11px",
    fontStyle: "italic",
    fontWeight: 500,
    margin: 0,
    textAlign: "center",
    lineHeight: 1.4,
  },
  snoozeMsg: {
    textAlign: "center",
    color: "#F39C12",
    fontSize: "12px",
    fontWeight: 700,
  },
  snoozeRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    justifyContent: "center",
  },
  snoozeLabel: {
    color: "rgba(255,255,255,0.4)",
    fontSize: "12px",
    fontWeight: 600,
    margin: 0,
  },
  snoozeBtn: {
    background: "rgba(243,156,18,0.15)",
    border: "1px solid rgba(243,156,18,0.4)",
    borderRadius: "100px",
    color: "#F39C12",
    fontSize: "12px",
    fontWeight: 700,
    padding: "7px 16px",
    cursor: "pointer",
  },
  settingsToggle: {
    background: "transparent",
    border: "none",
    color: "rgba(255,255,255,0.3)",
    fontSize: "11px",
    fontWeight: 600,
    cursor: "pointer",
    textAlign: "center",
    width: "100%",
    padding: "4px 0",
  },
};

// Settings panel styles
const ss: Record<string, React.CSSProperties> = {
  panel: {
    background: "rgba(0,0,0,0.25)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "14px",
    padding: "14px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  sectionLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: "10px",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "1px",
    margin: "0 0 4px",
  },
  timingGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "6px",
  },
  timingBtn: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "10px",
    color: "rgba(255,255,255,0.55)",
    fontSize: "12px",
    fontWeight: 600,
    padding: "9px 10px",
    cursor: "pointer",
    textAlign: "center",
  },
  timingBtnActive: {
    background: "rgba(243,156,18,0.18)",
    border: "1px solid rgba(243,156,18,0.55)",
    color: "#F39C12",
    fontWeight: 800,
  },
  checkRow: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  checkLabel: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: "rgba(255,255,255,0.65)",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
  },
  checkbox: {
    accentColor: "#F39C12",
    width: "16px",
    height: "16px",
    flexShrink: 0,
    cursor: "pointer",
  },
  voicePlaceholder: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "10px",
    padding: "9px 12px",
  },
  voicePlaceholderIcon: { fontSize: "16px" },
  voicePlaceholderText: {
    color: "rgba(255,255,255,0.3)",
    fontSize: "12px",
    fontWeight: 600,
    fontStyle: "italic",
  },
  saveRow: {
    display: "flex",
    gap: "8px",
  },
  saveBtn: {
    flex: 1,
    background: "linear-gradient(135deg, #F39C12 0%, #E67E22 100%)",
    border: "none",
    borderRadius: "100px",
    color: "#0A0A0A",
    fontSize: "13px",
    fontWeight: 900,
    padding: "11px 16px",
    cursor: "pointer",
  },
  cancelBtn: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "100px",
    color: "rgba(255,255,255,0.4)",
    fontSize: "13px",
    fontWeight: 600,
    padding: "11px 16px",
    cursor: "pointer",
  },
};
