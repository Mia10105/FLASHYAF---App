import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import type { Flash } from "@/types/flash";

function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function sameDay(a: Date, b: Date) {
  return a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
}

interface CheckinEntry { mood: number; sleepQuality: number; timestamp: number; }
interface BreakdownRow { label: string; delta: number; }

function computeBattery(
  flashes: Flash[],
  checkins: CheckinEntry[],
  breathingDone: boolean,
): { battery: number; breakdown: BreakdownRow[] } {
  const breakdown: BreakdownRow[] = [];
  let score = 100;
  const now = new Date();
  const todayFlashes = flashes.filter((f) => sameDay(new Date(f.startTime), now));
  const first = flashes.length > 0 ? new Date(flashes[flashes.length - 1].startTime) : now;
  const daysTracked = Math.max(1, Math.round((Date.now() - first.getTime()) / 86400000));
  const avgPerDay = flashes.length / daysTracked;

  // -10 per flash above daily average
  const aboveAvg = Math.max(0, todayFlashes.length - Math.floor(avgPerDay));
  if (aboveAvg > 0) {
    const d = -10 * aboveAvg;
    score += d;
    breakdown.push({ label: `${aboveAvg} flash${aboveAvg > 1 ? "es" : ""} above your daily average`, delta: d });
  }

  // -8 per peak rated 4 or 5
  const highPeaks = todayFlashes.filter((f) => (f.peakRating ?? 0) >= 4).length;
  if (highPeaks > 0) {
    const d = -8 * highPeaks;
    score += d;
    breakdown.push({ label: `${highPeaks} high-intensity peak${highPeaks > 1 ? "s" : ""} (★4–5)`, delta: d });
  }

  // -5 per mood check-in below 5
  const lowMoods = checkins.filter((c) => c.mood < 5).length;
  if (lowMoods > 0) {
    const d = -5 * lowMoods;
    score += d;
    breakdown.push({ label: `${lowMoods} low-mood check-in${lowMoods > 1 ? "s" : ""}`, delta: d });
  }

  // -10 if sleep quality below 5 (most recent check-in)
  const withSleep = [...checkins].sort((a, b) => b.timestamp - a.timestamp);
  const lastSleep = withSleep.length > 0 ? withSleep[0].sleepQuality : null;
  if (lastSleep !== null && lastSleep < 5) {
    score -= 10;
    breakdown.push({ label: `Poor sleep quality (${lastSleep}/10)`, delta: -10 });
  }

  // +15 breathing done today
  if (breathingDone) {
    score += 15;
    breakdown.push({ label: "Breathing exercise completed", delta: 15 });
  }

  // +10 no flashes in last 3 hours
  const threeHoursAgo = Date.now() - 3 * 3600000;
  const recentFlashes = todayFlashes.filter((f) => f.startTime >= threeHoursAgo).length;
  if (recentFlashes === 0) {
    score += 10;
    breakdown.push({ label: "No flashes in the last 3 hours", delta: 10 });
  }

  // +5 today's count below average
  if (avgPerDay > 0 && todayFlashes.length < avgPerDay) {
    score += 5;
    breakdown.push({ label: "Fewer flashes than usual today", delta: 5 });
  }

  return { battery: Math.max(0, Math.min(100, Math.round(score))), breakdown };
}

function batteryColor(v: number) {
  if (v >= 80) return "#1ABC9C";
  if (v >= 60) return "#F5A623";
  if (v >= 40) return "#E67E22";
  return "#C0392B";
}
function batteryLabel(v: number) {
  if (v >= 80) return "Fully Charged";
  if (v >= 60) return "Good Energy";
  if (v >= 40) return "Running Low";
  return "Rest Mode";
}
function batteryMsg(v: number) {
  if (v >= 80) return "Your body is recharged and ready";
  if (v >= 60) return "Holding steady — good momentum";
  if (v >= 40) return "Energy dipping — rest when you can";
  return "Rest Mode — be very gentle with yourself";
}

interface Props { flashes: Flash[]; }

export default function BodyBatteryGauge({ flashes }: Props) {
  const { user } = useAuth();
  const [checkins, setCheckins] = useState<CheckinEntry[]>([]);
  const [breathingDone, setBreathingDone] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  useEffect(() => {
    const today = getTodayKey();
    setBreathingDone(!!localStorage.getItem(`flashyaf_breathe_done_${today}`));

    if (!user) return;
    getDocs(collection(db, "users", user.uid, "checkinLog")).then((snap) => {
      const todayEntries = snap.docs
        .filter((d) => d.data().date === today)
        .map((d) => ({
          mood: d.data().mood ?? 5,
          sleepQuality: d.data().sleepQuality ?? 5,
          timestamp: d.data().timestamp ?? 0,
        }));
      setCheckins(todayEntries);
    }).catch(() => {});
  }, [user]);

  const { battery, breakdown } = computeBattery(flashes, checkins, breathingDone);
  const color = batteryColor(battery);
  const now = new Date();
  const todayCount = flashes.filter((f) => sameDay(new Date(f.startTime), now)).length;
  const withSleep = [...checkins].sort((a, b) => b.timestamp - a.timestamp);
  const sleepDisplay = withSleep.length > 0 ? withSleep[0].sleepQuality : null;

  // SVG arc gauge — 210° start, 240° sweep
  const R = 52, cx = 70, cy = 74;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const startDeg = 210, sweepDeg = 240;
  const arcX = (deg: number) => cx + R * Math.cos(toRad(deg));
  const arcY = (deg: number) => cy + R * Math.sin(toRad(deg));
  const bgEndDeg = startDeg + sweepDeg;
  const fillDeg  = startDeg + (battery / 100) * sweepDeg;
  const fillLarge = (battery / 100) * sweepDeg > 180 ? 1 : 0;
  const bgLarge   = sweepDeg > 180 ? 1 : 0;

  return (
    <>
      <button
        style={{ ...s.card, cursor: "pointer", textAlign: "left", width: "100%", boxSizing: "border-box", fontFamily: "inherit" }}
        onClick={() => setShowBreakdown(true)}
      >
        <div style={s.inner}>
          <svg viewBox="0 0 140 148" style={s.svg}>
            <path
              d={`M ${arcX(startDeg).toFixed(1)} ${arcY(startDeg).toFixed(1)} A ${R} ${R} 0 ${bgLarge} 1 ${arcX(bgEndDeg).toFixed(1)} ${arcY(bgEndDeg).toFixed(1)}`}
              fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="13" strokeLinecap="round"
            />
            {battery > 2 && (
              <path
                d={`M ${arcX(startDeg).toFixed(1)} ${arcY(startDeg).toFixed(1)} A ${R} ${R} 0 ${fillLarge} 1 ${arcX(fillDeg).toFixed(1)} ${arcY(fillDeg).toFixed(1)}`}
                fill="none" stroke={color} strokeWidth="13" strokeLinecap="round"
                style={{ filter: `drop-shadow(0 0 7px ${color}99)` }}
              />
            )}
            <text x={cx} y={cy - 2} textAnchor="middle" fontSize="27" fontWeight="900"
              fill="#fff" fontFamily="Inter, sans-serif">{battery}</text>
            <text x={cx} y={cy + 16} textAnchor="middle" fontSize="8.5" fontWeight="800"
              fill={color} fontFamily="Inter, sans-serif" letterSpacing="1.2">BATTERY</text>
          </svg>

          <div style={s.info}>
            <p style={s.badge}>⚡ BODY BATTERY · tap to see breakdown</p>
            <p style={{ ...s.level, color }}>{batteryLabel(battery)}</p>
            <p style={s.msg}>{batteryMsg(battery)}</p>
            <div style={s.chips}>
              <div style={s.chip}><span>🔥</span><span style={s.chipText}>{todayCount} today</span></div>
              {sleepDisplay !== null && (
                <div style={s.chip}><span>😴</span><span style={s.chipText}>Sleep {sleepDisplay}/10</span></div>
              )}
            </div>
          </div>
        </div>
      </button>

      {showBreakdown && (
        <div style={s.overlay} onClick={() => setShowBreakdown(false)}>
          <div style={s.sheet} onClick={(e) => e.stopPropagation()}>
            <div style={s.sheetHandle} />
            <p style={s.sheetTitle}>⚡ Body Battery Breakdown</p>
            <p style={s.sheetScore}>
              <span style={{ color, fontSize: "44px", fontWeight: 900 }}>{battery}</span>
              <span style={s.sheetOutOf}> / 100</span>
            </p>
            <p style={{ ...s.sheetLevel, color }}>{batteryLabel(battery)}</p>
            <div style={s.rows}>
              <div style={s.startRow}>
                <span style={s.rowLabel}>Starting charge</span>
                <span style={s.rowDelta}>100</span>
              </div>
              {breakdown.map((row, i) => (
                <div key={i} style={s.breakRow}>
                  <span style={s.rowLabel}>{row.label}</span>
                  <span style={{ ...s.rowDelta, color: row.delta >= 0 ? "#1ABC9C" : "#E74C3C" }}>
                    {row.delta >= 0 ? "+" : ""}{row.delta}
                  </span>
                </div>
              ))}
            </div>
            <div style={s.labelKey}>
              {[{ range: "80–100", label: "Fully Charged", color: "#1ABC9C" },
                { range: "60–79", label: "Good Energy", color: "#F5A623" },
                { range: "40–59", label: "Running Low", color: "#E67E22" },
                { range: "< 40",  label: "Rest Mode",   color: "#C0392B" }].map((k) => (
                <div key={k.range} style={s.keyRow}>
                  <span style={{ ...s.keyDot, background: k.color }} />
                  <span style={s.keyRange}>{k.range}</span>
                  <span style={{ ...s.keyLabel, color: k.color }}>{k.label}</span>
                </div>
              ))}
            </div>
            <button style={s.closeBtn} onClick={() => setShowBreakdown(false)}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  card: {
    marginTop: "14px",
    background: "linear-gradient(135deg, rgba(26,188,156,0.07) 0%, rgba(52,73,94,0.05) 100%)",
    border: "1.5px solid rgba(26,188,156,0.22)", borderRadius: "20px", padding: "14px 18px",
  },
  inner: { display: "flex", alignItems: "center", gap: "14px" },
  svg: { width: "90px", height: "95px", flexShrink: 0 },
  info: { flex: 1, display: "flex", flexDirection: "column", gap: "4px" },
  badge: {
    color: "rgba(255,255,255,0.32)", fontSize: "9px", fontWeight: 800,
    letterSpacing: "1.5px", textTransform: "uppercase", margin: 0,
  },
  level: { fontSize: "20px", fontWeight: 900, margin: 0, lineHeight: 1.1 },
  msg: { color: "rgba(255,255,255,0.45)", fontSize: "12px", lineHeight: 1.4, margin: "2px 0 6px" },
  chips: { display: "flex", gap: "6px", flexWrap: "wrap" },
  chip: {
    display: "flex", alignItems: "center", gap: "4px",
    background: "rgba(255,255,255,0.07)", borderRadius: "100px", padding: "3px 8px",
  },
  chipText: { color: "rgba(255,255,255,0.45)", fontSize: "11px", fontWeight: 600 },

  // Breakdown overlay
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)",
    backdropFilter: "blur(6px)", zIndex: 800,
    display: "flex", alignItems: "flex-end", justifyContent: "center",
  },
  sheet: {
    width: "100%", maxWidth: "480px", background: "#0F0F0F",
    borderRadius: "28px 28px 0 0", padding: "16px 22px 36px",
    border: "1px solid rgba(255,255,255,0.1)",
    maxHeight: "88vh", overflowY: "auto",
    display: "flex", flexDirection: "column",
  },
  sheetHandle: {
    width: "36px", height: "4px", borderRadius: "2px",
    background: "rgba(255,255,255,0.18)", margin: "0 auto 18px",
  },
  sheetTitle: {
    color: "rgba(255,255,255,0.35)", fontSize: "10px", fontWeight: 800,
    letterSpacing: "2px", textTransform: "uppercase", margin: "0 0 6px", textAlign: "center",
  },
  sheetScore: { textAlign: "center", margin: "0 0 4px", color: "#fff" },
  sheetOutOf: { color: "rgba(255,255,255,0.3)", fontSize: "18px", fontWeight: 600 },
  sheetLevel: { textAlign: "center", fontSize: "18px", fontWeight: 900, margin: "0 0 20px" },
  rows: { display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" },
  startRow: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "9px 12px", background: "rgba(255,255,255,0.04)",
    borderRadius: "10px", border: "1px solid rgba(255,255,255,0.06)",
  },
  breakRow: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "9px 12px", background: "rgba(255,255,255,0.03)", borderRadius: "10px",
  },
  rowLabel: { color: "rgba(255,255,255,0.7)", fontSize: "13px", fontWeight: 500, flex: 1 },
  rowDelta: { fontSize: "14px", fontWeight: 800, flexShrink: 0, marginLeft: "8px" },
  labelKey: {
    display: "flex", flexDirection: "column", gap: "6px",
    marginBottom: "20px", padding: "12px 14px",
    background: "rgba(255,255,255,0.03)", borderRadius: "12px",
  },
  keyRow: { display: "flex", alignItems: "center", gap: "8px" },
  keyDot: { width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0 },
  keyRange: { color: "rgba(255,255,255,0.4)", fontSize: "11px", fontWeight: 600, width: "48px", flexShrink: 0 },
  keyLabel: { fontSize: "12px", fontWeight: 700 },
  closeBtn: {
    background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: "100px", color: "#fff", fontSize: "15px", fontWeight: 700,
    padding: "14px", cursor: "pointer", width: "100%", marginTop: "4px",
  },
};
