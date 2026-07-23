import { useEffect, useState } from "react";
import { collection, addDoc, setDoc, doc, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

export interface CheckinRecord {
  id: string;
  date: string;
  timestamp: number;
  flashSeverity: number;
  sleepQuality: number;
  mood: number;
  energyLevel: number;
  brainFog: number;
}

const METRICS = [
  {
    id: "flashSeverity" as const,
    emoji: "🔥",
    label: "Hot Flash Severity Today",
    lowLabel: "Mild",
    highLabel: "Intense",
    color: "#C0392B",
    bg: "rgba(192,57,43,0.15)",
  },
  {
    id: "sleepQuality" as const,
    emoji: "😴",
    label: "Sleep Quality Last Night",
    lowLabel: "Poor",
    highLabel: "Great",
    color: "#2980B9",
    bg: "rgba(41,128,185,0.15)",
  },
  {
    id: "mood" as const,
    emoji: "💜",
    label: "Mood Today",
    lowLabel: "Low",
    highLabel: "Great",
    color: "#8E44AD",
    bg: "rgba(142,68,173,0.15)",
  },
  {
    id: "energyLevel" as const,
    emoji: "⚡",
    label: "Energy Level Today",
    lowLabel: "Drained",
    highLabel: "Energized",
    color: "#E67E22",
    bg: "rgba(230,126,34,0.15)",
  },
  {
    id: "brainFog" as const,
    emoji: "🌫️",
    label: "Brain Fog Level Today",
    lowLabel: "Clear",
    highLabel: "Foggy",
    color: "#7F8C8D",
    bg: "rgba(127,140,141,0.15)",
  },
] as const;

type MetricId = (typeof METRICS)[number]["id"];
type Values = Record<MetricId, number>;

const DEFAULT_VALUES: Values = {
  flashSeverity: 5,
  sleepQuality: 5,
  mood: 5,
  energyLevel: 5,
  brainFog: 5,
};

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });
}

export default function DailyCheckInModal({ onClose, onSaved }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [todayCount, setTodayCount] = useState(0);
  const [prefill, setPrefill] = useState<Values | null>(null);
  const [values, setValues] = useState<Values>({ ...DEFAULT_VALUES });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const today = todayKey();

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    async function check() {
      const snap = await getDocs(collection(db, "users", user!.uid, "checkinLog"));
      const todayDocs = snap.docs.filter((d) => d.data().date === today);
      setTodayCount(todayDocs.length);
      if (todayDocs.length > 0) {
        const sorted = [...todayDocs].sort((a, b) => (b.data().timestamp || 0) - (a.data().timestamp || 0));
        const latest = sorted[0].data();
        const pf: Values = {
          flashSeverity: latest.flashSeverity ?? 5,
          sleepQuality: latest.sleepQuality ?? 5,
          mood: latest.mood ?? 5,
          energyLevel: latest.energyLevel ?? 5,
          brainFog: latest.brainFog ?? 5,
        };
        setPrefill(pf);
        setValues(pf);
      }
      setLoading(false);
    }
    check();
  }, [user, today]);

  function setVal(id: MetricId, val: number) {
    setValues((prev) => ({ ...prev, [id]: val }));
  }

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    try {
      const payload = { date: today, timestamp: Date.now(), ...values };
      await addDoc(collection(db, "users", user!.uid, "checkinLog"), payload);
      await setDoc(doc(db, "users", user!.uid, "checkins", today), payload);
      setSaved(true);
      onSaved();
      setTimeout(() => onClose(), 1600);
    } catch {
      setSaving(false);
    }
  }

  return (
    <div style={s.backdrop}>
      <div style={s.sheet}>
        {/* Top bar */}
        <div style={s.topBar}>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
          <div style={s.topBarCenter}>
            <p style={s.topBarBrand}>FLASHYAF™</p>
            <p style={s.topBarTitle}>Daily Check-In</p>
          </div>
          <div style={{ width: "32px" }} />
        </div>

        {/* Date */}
        <div style={s.dateBar}>
          <span style={s.dateText}>{fmtDate(today)}</span>
          {todayCount > 0 && (
            <span style={s.doneBadge}>✓ {todayCount}x today</span>
          )}
        </div>

        {loading && (
          <div style={s.loadingBox}>
            <p style={s.loadingText}>Loading…</p>
          </div>
        )}

        {!loading && saved && (
          <div style={s.successBox}>
            <p style={s.successEmoji}>✅</p>
            <p style={s.successTitle}>Check-In Saved!</p>
            <p style={s.successSub}>Your symptom data helps track your journey over time.</p>
          </div>
        )}

        {!loading && !saved && (
          <>
            <div style={s.scroll}>
              {todayCount > 0 && prefill && (
                <div style={s.prevNote}>
                  <span>📊</span>
                  <p style={s.prevText}>
                    You've checked in {todayCount} time{todayCount > 1 ? "s" : ""} today. Sliders are pre-filled from your last entry — adjust as needed.
                  </p>
                </div>
              )}

              {METRICS.map((metric) => {
                const val = values[metric.id];
                const fillPct = ((val - 1) / 9) * 100;
                return (
                  <div key={metric.id} style={{ ...s.metricCard, background: metric.bg, border: `1px solid ${metric.color}44` }}>
                    <div style={s.metricHeader}>
                      <div style={s.metricLeft}>
                        <span style={s.metricEmoji}>{metric.emoji}</span>
                        <p style={s.metricLabel}>{metric.label}</p>
                      </div>
                      <div style={{ ...s.metricBadge, background: metric.color }}>
                        <span style={s.metricBadgeNum}>{val}</span>
                        <span style={s.metricBadgeDen}>/10</span>
                      </div>
                    </div>

                    <div style={s.sliderWrap}>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        step="1"
                        value={val}
                        onChange={(e) => setVal(metric.id, Number(e.target.value))}
                        className="checkin-slider"
                        style={{
                          background: `linear-gradient(to right, ${metric.color} 0%, ${metric.color} ${fillPct}%, rgba(255,255,255,0.14) ${fillPct}%, rgba(255,255,255,0.14) 100%)`,
                        } as React.CSSProperties}
                      />
                      <div style={s.scaleLabels}>
                        <span style={s.scaleLabelLeft}>{metric.lowLabel}</span>
                        <div style={s.scalePips}>
                          {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                            <span key={n} style={{
                              ...s.scalePip,
                              color: n <= val ? metric.color : "rgba(255,255,255,0.2)",
                              fontWeight: n === val ? 800 : 400,
                            }}>
                              {n === val ? n : "·"}
                            </span>
                          ))}
                        </div>
                        <span style={s.scaleLabelRight}>{metric.highLabel}</span>
                      </div>
                    </div>
                  </div>
                );
              })}

              <p style={s.privacyNote}>
                🔒 Your check-in data is private and helps personalize your experience. You can check in multiple times per day.
              </p>
            </div>

            <div style={s.actionBar}>
              <button
                style={{ ...s.saveBtn, opacity: saving ? 0.6 : 1 }}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Saving…" : todayCount > 0 ? "💾 Submit Another Check-In" : "💾 Save Today's Check-In"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  backdrop: {
    position: "fixed", inset: 0, zIndex: 700,
    background: "rgba(0,0,0,0.82)", backdropFilter: "blur(8px)",
    display: "flex", alignItems: "flex-end", justifyContent: "center",
  },
  sheet: {
    width: "100%", maxWidth: "480px", height: "92vh",
    background: "var(--color-bg)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "24px 24px 0 0",
    display: "flex", flexDirection: "column",
    overflow: "hidden",
    animation: "slideUp 0.35s ease",
  },
  topBar: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "18px 18px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0,
  },
  closeBtn: {
    background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "50%",
    color: "var(--color-text)", fontSize: "15px", fontWeight: 700,
    width: "32px", height: "32px", cursor: "pointer", flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  topBarCenter: { flex: 1, textAlign: "center" },
  topBarBrand: { color: "var(--color-accent)", fontSize: "11px", fontWeight: 900, letterSpacing: "2px", margin: "0 0 1px" },
  topBarTitle: { color: "var(--color-text)", fontSize: "16px", fontWeight: 800, margin: 0 },
  dateBar: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "10px 18px 8px", flexShrink: 0,
  },
  dateText: { color: "rgba(255,255,255,0.5)", fontSize: "12px", fontWeight: 600 },
  doneBadge: {
    background: "rgba(26,188,156,0.18)", border: "1px solid rgba(26,188,156,0.35)",
    color: "#1ABC9C", borderRadius: "100px", padding: "3px 9px", fontSize: "11px", fontWeight: 700,
  },
  loadingBox: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center" },
  loadingText: { color: "rgba(255,255,255,0.4)", fontSize: "14px" },
  successBox: {
    flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", gap: "10px", padding: "32px",
  },
  successEmoji: { fontSize: "52px", margin: 0 },
  successTitle: { color: "#1ABC9C", fontSize: "22px", fontWeight: 900, margin: 0 },
  successSub: { color: "rgba(255,255,255,0.45)", fontSize: "14px", textAlign: "center", lineHeight: 1.5, margin: 0 },
  scroll: { flex: 1, overflowY: "auto", padding: "8px 14px 0" },
  prevNote: {
    display: "flex", gap: "10px", alignItems: "flex-start",
    background: "rgba(26,188,156,0.1)", border: "1px solid rgba(26,188,156,0.25)",
    borderRadius: "14px", padding: "12px 14px", marginBottom: "12px",
  },
  prevText: { color: "rgba(255,255,255,0.65)", fontSize: "13px", lineHeight: 1.5, margin: 0 },
  metricCard: { borderRadius: "18px", padding: "14px 16px", marginBottom: "10px" },
  metricHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" },
  metricLeft: { display: "flex", alignItems: "center", gap: "8px" },
  metricEmoji: { fontSize: "20px", lineHeight: 1 },
  metricLabel: { color: "var(--color-text)", fontSize: "13px", fontWeight: 700, margin: 0 },
  metricBadge: { borderRadius: "100px", padding: "4px 10px", display: "flex", alignItems: "baseline", gap: "2px" },
  metricBadgeNum: { color: "#fff", fontSize: "18px", fontWeight: 900, lineHeight: 1 },
  metricBadgeDen: { color: "rgba(255,255,255,0.55)", fontSize: "11px", fontWeight: 600 },
  sliderWrap: { display: "flex", flexDirection: "column", gap: "8px" },
  scaleLabels: { display: "flex", alignItems: "center", gap: "6px" },
  scaleLabelLeft: { color: "rgba(255,255,255,0.35)", fontSize: "10px", fontWeight: 600, flexShrink: 0 },
  scaleLabelRight: { color: "rgba(255,255,255,0.35)", fontSize: "10px", fontWeight: 600, flexShrink: 0 },
  scalePips: { flex: 1, display: "flex", justifyContent: "space-between", alignItems: "center" },
  scalePip: { fontSize: "11px", lineHeight: 1, width: "16px", textAlign: "center" },
  privacyNote: {
    color: "rgba(255,255,255,0.22)", fontSize: "11px", lineHeight: 1.6,
    textAlign: "center", margin: "8px 0 18px",
  },
  actionBar: {
    padding: "12px 14px 24px", borderTop: "1px solid rgba(255,255,255,0.07)", flexShrink: 0,
  },
  saveBtn: {
    width: "100%", background: "linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%)",
    border: "none", borderRadius: "100px", color: "#fff",
    fontSize: "16px", fontWeight: 800, padding: "17px",
    cursor: "pointer", letterSpacing: "0.5px",
  },
};
