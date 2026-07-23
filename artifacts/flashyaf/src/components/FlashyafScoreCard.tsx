import { useState, useEffect } from "react";
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

interface CheckinEntry { mood: number; timestamp: number; }
interface BreakdownRow { label: string; delta: number; }

function computeScore(
  todayFlashes: Flash[],
  avgPerDay: number,
  checkins: CheckinEntry[],
  breathingDone: boolean,
): { score: number; breakdown: BreakdownRow[] } {
  const breakdown: BreakdownRow[] = [];
  let score = 100;

  // -8 per flash above average
  const aboveAvg = Math.max(0, todayFlashes.length - Math.floor(avgPerDay));
  if (aboveAvg > 0) {
    const d = -8 * aboveAvg;
    score += d;
    breakdown.push({ label: `${aboveAvg} flash${aboveAvg > 1 ? "es" : ""} above your daily average`, delta: d });
  }

  // -5 per peak rated 4 or 5
  const highPeaks = todayFlashes.filter((f) => (f.peakRating ?? 0) >= 4).length;
  if (highPeaks > 0) {
    const d = -5 * highPeaks;
    score += d;
    breakdown.push({ label: `${highPeaks} high-intensity peak${highPeaks > 1 ? "s" : ""} (★4–5)`, delta: d });
  }

  // -3 per mood check-in below 5
  const lowMoods = checkins.filter((c) => c.mood < 5).length;
  if (lowMoods > 0) {
    const d = -3 * lowMoods;
    score += d;
    breakdown.push({ label: `${lowMoods} low-mood check-in${lowMoods > 1 ? "s" : ""}`, delta: d });
  }

  // +10 breathing
  if (breathingDone) {
    score += 10;
    breakdown.push({ label: "Breathing session completed", delta: 10 });
  }

  // +5 for logging all 4 stages on any flash
  const fullFlashes = todayFlashes.filter((f) =>
    f.stages.some((s) => s.stage === "BACK_TO_NORMAL")
  ).length;
  if (fullFlashes > 0) {
    const d = Math.min(20, 5 * fullFlashes);
    score += d;
    breakdown.push({ label: `${fullFlashes} fully tracked flash${fullFlashes > 1 ? "es" : ""} (all 4 stages)`, delta: d });
  }

  // +5 check-in submitted
  if (checkins.length > 0) {
    score += 5;
    breakdown.push({ label: "Daily check-in submitted", delta: 5 });
  }

  // +3 for opening the app
  score += 3;
  breakdown.push({ label: "Opened the app today", delta: 3 });

  return { score: Math.max(0, Math.min(100, Math.round(score))), breakdown };
}

function scoreColor(v: number) {
  if (v >= 80) return "#1ABC9C";
  if (v >= 60) return "#F5A623";
  if (v >= 40) return "#E67E22";
  return "#C0392B";
}

function scoreMsg(v: number) {
  if (v >= 90) return "You are crushing it today.";
  if (v >= 70) return "Holding strong. Keep going.";
  if (v >= 50) return "Rough day — we see you. You showed up.";
  return "Hard day. You showed up anyway. That counts.";
}

interface Props { flashes: Flash[]; }

export default function FlashyafScoreCard({ flashes }: Props) {
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
        .map((d) => ({ mood: d.data().mood ?? 5, timestamp: d.data().timestamp ?? 0 }));
      setCheckins(todayEntries);
    }).catch(() => {});
  }, [user]);

  const now = new Date();
  const todayFlashes = flashes.filter((f) => sameDay(new Date(f.startTime), now));
  const first = flashes.length > 0 ? new Date(flashes[flashes.length - 1].startTime) : now;
  const daysTracked = Math.max(1, Math.round((Date.now() - first.getTime()) / 86400000));
  const avgPerDay = flashes.length / daysTracked;

  const { score: todayScore, breakdown } = computeScore(todayFlashes, avgPerDay, checkins, breathingDone);
  const color = scoreColor(todayScore);

  // Last 7 days sparkline (uses flash data only for trend, checkins not available per-day easily)
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() - (6 - i));
    const df = flashes.filter((f) => sameDay(new Date(f.startTime), d));
    const { score } = computeScore(df, avgPerDay, i === 6 ? checkins : [], i === 6 ? breathingDone : false);
    return score;
  });

  const W = 160, H = 30;
  const pts = week.map((v, i) => ({ x: (i / 6) * W, y: H - (v / 100) * H }));
  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${W} ${H} L 0 ${H} Z`;

  return (
    <>
      <button
        style={{ ...s.card, borderColor: `${color}44`, cursor: "pointer", textAlign: "left", width: "100%", boxSizing: "border-box" }}
        onClick={() => setShowBreakdown(true)}
      >
        <div style={s.header}>
          <div>
            <p style={s.badge}>✦ FLASHYAF SCORE</p>
            <p style={s.sub}>Today · {new Date().toLocaleDateString([], { month: "short", day: "numeric" })} · tap for breakdown</p>
          </div>
          <div style={s.scoreWrap}>
            <span style={{ ...s.score, color }}>{todayScore}</span>
            <span style={s.outOf}>/100</span>
          </div>
        </div>

        <p style={{ ...s.msg, color }}>{scoreMsg(todayScore)}</p>

        <div style={s.sparkWrap}>
          <p style={s.sparkLabel}>7-day trend</p>
          <svg viewBox={`0 0 ${W} ${H}`} style={s.sparkline} preserveAspectRatio="none">
            <defs>
              <linearGradient id="sgGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <path d={areaPath} fill="url(#sgGrad)" />
            <path d={linePath} fill="none" stroke={color} strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round" />
            {pts.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y}
                r={i === 6 ? 3.5 : 1.8}
                fill={i === 6 ? color : `${color}77`} />
            ))}
          </svg>
          <div style={s.days}>
            {["6d", "5d", "4d", "3d", "2d", "1d", "Today"].map((d) => (
              <span key={d} style={s.dayLabel}>{d}</span>
            ))}
          </div>
        </div>
      </button>

      {showBreakdown && (
        <div style={s.overlay} onClick={() => setShowBreakdown(false)}>
          <div style={s.sheet} onClick={(e) => e.stopPropagation()}>
            <div style={s.sheetHandle} />
            <p style={s.sheetTitle}>✦ Score Breakdown</p>
            <p style={s.sheetScore}><span style={{ color, fontSize: "44px", fontWeight: 900 }}>{todayScore}</span><span style={s.sheetOutOf}> / 100</span></p>
            <p style={{ ...s.sheetMsg, color }}>{scoreMsg(todayScore)}</p>
            <div style={s.rows}>
              <div style={s.startRow}>
                <span style={s.rowLabel}>Starting score</span>
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
            <p style={s.formulaNote}>
              Formula: −8/flash above avg · −5/peak ★4+ · −3/low mood · +10 breathing · +5 full flash · +5 check-in · +3 app open
            </p>
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
    background: "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)",
    border: "1.5px solid", borderRadius: "20px", padding: "16px 18px 14px",
    fontFamily: "inherit",
  },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" },
  badge: {
    color: "rgba(255,255,255,0.35)", fontSize: "9px", fontWeight: 800,
    letterSpacing: "2px", textTransform: "uppercase", margin: "0 0 2px",
  },
  sub: { color: "rgba(255,255,255,0.22)", fontSize: "11px", fontWeight: 600, margin: 0 },
  scoreWrap: { display: "flex", alignItems: "baseline", gap: "2px" },
  score: { fontSize: "56px", fontWeight: 900, lineHeight: 1 },
  outOf: { color: "rgba(255,255,255,0.22)", fontSize: "14px", fontWeight: 600 },
  msg: { fontSize: "13px", fontWeight: 700, margin: "0 0 16px", lineHeight: 1.4 },
  sparkWrap: { display: "flex", flexDirection: "column", gap: "5px" },
  sparkLabel: {
    color: "rgba(255,255,255,0.2)", fontSize: "9px", fontWeight: 700,
    textTransform: "uppercase", letterSpacing: "1px", margin: 0,
  },
  sparkline: { width: "100%", height: "30px", overflow: "visible" },
  days: { display: "flex", justifyContent: "space-between" },
  dayLabel: { color: "rgba(255,255,255,0.14)", fontSize: "8px", fontWeight: 600 },

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
    maxHeight: "85vh", overflowY: "auto",
    display: "flex", flexDirection: "column", gap: "0px",
  },
  sheetHandle: {
    width: "36px", height: "4px", borderRadius: "2px",
    background: "rgba(255,255,255,0.18)", margin: "0 auto 18px",
  },
  sheetTitle: {
    color: "rgba(255,255,255,0.35)", fontSize: "10px", fontWeight: 800,
    letterSpacing: "2px", textTransform: "uppercase", margin: "0 0 6px", textAlign: "center",
  },
  sheetScore: { textAlign: "center", margin: "0 0 6px", color: "#fff" },
  sheetOutOf: { color: "rgba(255,255,255,0.3)", fontSize: "18px", fontWeight: 600 },
  sheetMsg: { textAlign: "center", fontSize: "14px", fontWeight: 700, margin: "0 0 20px" },
  rows: { display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" },
  startRow: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "9px 12px", background: "rgba(255,255,255,0.04)",
    borderRadius: "10px", border: "1px solid rgba(255,255,255,0.06)",
  },
  breakRow: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "9px 12px", background: "rgba(255,255,255,0.03)",
    borderRadius: "10px",
  },
  rowLabel: { color: "rgba(255,255,255,0.7)", fontSize: "13px", fontWeight: 500, flex: 1 },
  rowDelta: { fontSize: "14px", fontWeight: 800, flexShrink: 0, marginLeft: "8px" },
  formulaNote: {
    color: "rgba(255,255,255,0.2)", fontSize: "10px", lineHeight: 1.6,
    margin: "0 0 18px", textAlign: "center",
  },
  closeBtn: {
    background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: "100px", color: "#fff", fontSize: "15px", fontWeight: 700,
    padding: "14px", cursor: "pointer", width: "100%",
  },
};
