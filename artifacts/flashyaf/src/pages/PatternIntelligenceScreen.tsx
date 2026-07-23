import { useEffect, useState, useRef } from "react";
import { collection, query, orderBy, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import type { Flash, Stage } from "@/types/flash";
import FlameSpinner from "@/components/FlameSpinner";

interface Props {
  onBack: () => void;
}

const STAGE_ORDER: Stage[] = ["STARTED", "PEAK", "COOLING_DOWN", "FLASH_ENDED", "BACK_TO_NORMAL"];
const STAGE_SHORT: Record<Stage, string> = {
  STARTED: "Started", PEAK: "Peak", COOLING_DOWN: "Cooling", FLASH_ENDED: "Ended", BACK_TO_NORMAL: "Normal",
};
const STAGE_PIP_COLORS: Record<number, string> = {
  0: "var(--color-primary)", 1: "#FF6B35", 2: "#2E86AB", 3: "#87CEEB",
};
const TIME_SLOTS = ["Morning", "Afternoon", "Evening", "Night"] as const;
const TIME_RANGES: Record<string, string> = {
  Morning: "6am–12pm", Afternoon: "12pm–6pm", Evening: "6pm–10pm", Night: "10pm–6am",
};
const TIME_ICONS: Record<string, string> = {
  Morning: "🌅", Afternoon: "☀️", Evening: "🌆", Night: "🌙",
};

function fmtDuration(s: number) {
  const m = Math.floor(s / 60); const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}
function fmtGap(ms: number) {
  const totalMin = Math.round(ms / 60000);
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60); const m = totalMin % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
function getMaxStage(flash: Flash): Stage {
  let max: Stage = "STARTED";
  for (const s of flash.stages) {
    if (STAGE_ORDER.indexOf(s.stage) > STAGE_ORDER.indexOf(max)) max = s.stage;
  }
  return max;
}
function getHourLabel(h: number) {
  if (h === 0) return "12a"; if (h < 12) return `${h}a`;
  if (h === 12) return "12p"; return `${h - 12}p`;
}
function getDayKey(d: Date) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }
function sameDay(a: Date, b: Date) {
  return a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
}
function getTimeSlot(ts: number): string {
  const h = new Date(ts).getHours();
  if (h >= 6 && h < 12) return "Morning";
  if (h >= 12 && h < 18) return "Afternoon";
  if (h >= 18 && h < 22) return "Evening";
  return "Night";
}

interface CheckinEntry {
  date: string;
  timestamp: number;
  mood: number;
  sleepQuality: number;
  energyLevel: number;
  flashSeverity: number;
  brainFog: number;
}

export default function PatternIntelligenceScreen({ onBack }: Props) {
  const { user } = useAuth();
  const [flashes, setFlashes] = useState<Flash[]>([]);
  const [checkins, setCheckins] = useState<CheckinEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDoctorReport, setShowDoctorReport] = useState(false);
  const [copied, setCopied] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    async function load() {
      const [flashSnap, checkinSnap] = await Promise.all([
        getDocs(query(collection(db, "users", user!.uid, "flashes"), orderBy("startTime", "asc"))),
        getDocs(collection(db, "users", user!.uid, "checkinLog")),
      ]);
      setFlashes(flashSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Flash)));
      setCheckins(checkinSnap.docs.map((d) => d.data() as CheckinEntry).sort((a, b) => b.timestamp - a.timestamp));
      setLoading(false);
    }
    load();
  }, [user]);

  // ── Existing stats ──────────────────────────────────────────────────────
  const totalFlashes = flashes.length;
  const avgDuration = totalFlashes > 0
    ? Math.round(flashes.reduce((s, f) => s + f.durationSeconds, 0) / totalFlashes) : 0;

  const gaps: number[] = [];
  for (let i = 1; i < flashes.length; i++) gaps.push(flashes[i].startTime - flashes[i - 1].endTime);
  const avgGap = gaps.length > 0 ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : 0;
  const longestGap = gaps.length > 0 ? Math.max(...gaps) : 0;

  const byHour = Array(24).fill(0) as number[];
  flashes.forEach((f) => { byHour[new Date(f.startTime).getHours()]++; });
  const peakHour = byHour.indexOf(Math.max(...byHour));
  const peakHourLabel = totalFlashes > 0 ? `${getHourLabel(peakHour)}–${getHourLabel((peakHour + 1) % 24)}` : "—";

  const now = new Date();
  const last7: { shortLabel: string; count: number }[] = [];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const count = flashes.filter((f) => sameDay(new Date(f.startTime), d)).length;
    last7.push({ shortLabel: i === 0 ? "Today" : dayNames[d.getDay()], count });
  }
  const max7 = Math.max(...last7.map((d) => d.count), 1);

  const startOfThisWeek = new Date(now);
  startOfThisWeek.setDate(now.getDate() - now.getDay());
  startOfThisWeek.setHours(0, 0, 0, 0);
  const startOfLastWeek = new Date(startOfThisWeek);
  startOfLastWeek.setDate(startOfThisWeek.getDate() - 7);

  const thisWeekCount = flashes.filter((f) => f.startTime >= startOfThisWeek.getTime()).length;
  const lastWeekCount = flashes.filter((f) =>
    f.startTime >= startOfLastWeek.getTime() && f.startTime < startOfThisWeek.getTime()
  ).length;
  const weekDelta = thisWeekCount - lastWeekCount;

  const flashDayKeys = new Set(flashes.map((f) => getDayKey(new Date(f.startTime))));
  const sortedDayKeys = [...flashDayKeys].sort();
  let longestStreak = 0, currentStreak = 0;
  let prevDate: Date | null = null;
  for (const key of sortedDayKeys) {
    const [y, m, d] = key.split("-").map(Number);
    const date = new Date(y, m, d);
    if (prevDate) {
      const diffDays = Math.round((date.getTime() - prevDate.getTime()) / 86400000);
      currentStreak = diffDays <= 1 ? currentStreak + 1 : 1;
    } else { currentStreak = 1; }
    longestStreak = Math.max(longestStreak, currentStreak);
    prevDate = date;
  }

  const ratedFlashes = flashes.filter((f) => f.peakRating && f.peakRating > 0);
  const intensityByDay: Record<string, number[]> = {};
  ratedFlashes.forEach((f) => {
    const d = new Date(f.startTime);
    const label = d.toLocaleDateString([], { month: "short", day: "numeric" });
    if (!intensityByDay[label]) intensityByDay[label] = [];
    intensityByDay[label].push(f.peakRating!);
  });
  const intensityDays = Object.entries(intensityByDay)
    .map(([day, ratings]) => ({ day, avg: ratings.reduce((a, b) => a + b, 0) / ratings.length }))
    .slice(-7);
  const overallAvgRating = ratedFlashes.length > 0
    ? (ratedFlashes.reduce((s, f) => s + (f.peakRating ?? 0), 0) / ratedFlashes.length).toFixed(1) : "—";

  const maxBar = Math.max(...byHour, 1);
  const BAR_MAX_H = 80, BAR_W = 10, BAR_GAP = 2;
  const CHART_W = 24 * (BAR_W + BAR_GAP);
  const CHART_H = BAR_MAX_H + 24;

  // ── Doctor Report data (last 30 days) ───────────────────────────────────
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const last30Flashes = flashes.filter((f) => f.startTime >= thirtyDaysAgo);
  const l30Total = last30Flashes.length;
  const l30AvgPerDay = (l30Total / 30).toFixed(2);
  const l30AvgDurSec = l30Total > 0
    ? Math.round(last30Flashes.reduce((s, f) => s + f.durationSeconds, 0) / l30Total) : 0;
  const l30AvgDurMin = l30Total > 0 ? (l30AvgDurSec / 60).toFixed(1) : null;
  const l30Rated = last30Flashes.filter((f) => f.peakRating);
  const l30AvgIntensity = l30Rated.length > 0
    ? (l30Rated.reduce((s, f) => s + (f.peakRating || 0), 0) / l30Rated.length).toFixed(1) : null;
  const l30TimeCounts = { Morning: 0, Afternoon: 0, Evening: 0, Night: 0 };
  last30Flashes.forEach((f) => {
    (l30TimeCounts as Record<string, number>)[getTimeSlot(f.startTime)]++;
  });
  const l30PeakTime = l30Total > 0
    ? Object.entries(l30TimeCounts).reduce((a, b) => a[1] >= b[1] ? a : b)[0] : null;

  // 30-day chart
  const last30Days: { date: Date; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    last30Days.push({ date: d, count: last30Flashes.filter((f) => sameDay(new Date(f.startTime), d)).length });
  }
  const max30Day = Math.max(...last30Days.map((d) => d.count), 1);

  // Unique symptom notes (last 30 days, capped at 10)
  const symptomNotes = last30Flashes
    .filter((f) => f.notes && f.notes.trim())
    .map((f) => f.notes!.trim())
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 10);

  // Intensity trend: is average going up, down, or stable vs prior 30 days?
  const prior30Flashes = flashes.filter((f) =>
    f.startTime >= thirtyDaysAgo - 30 * 24 * 60 * 60 * 1000 && f.startTime < thirtyDaysAgo
  );
  const priorRated = prior30Flashes.filter((f) => f.peakRating);
  const priorAvgIntensity = priorRated.length > 0
    ? priorRated.reduce((s, f) => s + (f.peakRating || 0), 0) / priorRated.length : null;
  const currentAvgIntensityNum = l30Rated.length > 0
    ? l30Rated.reduce((s, f) => s + (f.peakRating || 0), 0) / l30Rated.length : null;
  let intensityTrend = "Insufficient data to determine trend";
  if (priorAvgIntensity !== null && currentAvgIntensityNum !== null) {
    const diff = currentAvgIntensityNum - priorAvgIntensity;
    if (diff > 0.3) intensityTrend = `Increasing (up ${diff.toFixed(1)} pts vs prior 30 days)`;
    else if (diff < -0.3) intensityTrend = `Decreasing (down ${Math.abs(diff).toFixed(1)} pts vs prior 30 days)`;
    else intensityTrend = "Stable (similar to prior 30 days)";
  }

  const reportDate = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const userName = user?.displayName || user?.email?.split("@")[0] || "Patient";
  const rangeStart = new Date(thirtyDaysAgo).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const rangeEnd = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  function buildTextReport(): string {
    const lines: string[] = [];
    lines.push("══════════════════════════════════════════");
    lines.push("  FLASHYAF™ — Hot Flash Medical Summary");
    lines.push("══════════════════════════════════════════");
    lines.push(`  Patient:       ${userName}`);
    lines.push(`  Report Period: ${rangeStart} – ${rangeEnd} (30 days)`);
    lines.push(`  Generated:     ${reportDate}`);
    lines.push("");
    lines.push("── SUMMARY ────────────────────────────────");
    lines.push(`  Total Flashes (30 days):  ${l30Total}`);
    lines.push(`  Avg Flashes per Day:      ${l30AvgPerDay}`);
    lines.push(`  Avg Duration:             ${l30AvgDurMin ? `${l30AvgDurMin} minutes` : "N/A"}`);
    lines.push(`  Avg Peak Intensity:       ${l30AvgIntensity ? `${l30AvgIntensity} / 5` : "N/A (not rated)"}`);
    lines.push(`  Intensity Trend:          ${intensityTrend}`);
    lines.push(`  Most Active Time of Day:  ${l30PeakTime ? `${l30PeakTime} (${TIME_RANGES[l30PeakTime]})` : "N/A"}`);
    lines.push("");
    lines.push("── TIME OF DAY BREAKDOWN ───────────────────");
    for (const slot of TIME_SLOTS) {
      const count = (l30TimeCounts as Record<string, number>)[slot];
      const pct = l30Total > 0 ? Math.round((count / l30Total) * 100) : 0;
      lines.push(`  ${slot.padEnd(12)} (${TIME_RANGES[slot]}):  ${count} flash${count !== 1 ? "es" : ""} (${pct}%)`);
    }
    lines.push("");
    lines.push("── 30-DAY WEEKLY OVERVIEW ──────────────────");
    for (let w = 0; w < 4; w++) {
      const weekFlashes = last30Days.slice(w * 7, (w + 1) * 7);
      const wTotal = weekFlashes.reduce((s, d) => s + d.count, 0);
      const bar = "█".repeat(Math.min(wTotal, 20)) + "░".repeat(Math.max(0, 20 - wTotal));
      lines.push(`  Week ${w + 1}:  ${bar}  ${wTotal}`);
    }
    if (symptomNotes.length > 0) {
      lines.push("");
      lines.push("── SYMPTOM NOTES ───────────────────────────");
      lines.push("  (Self-reported notes from logged flashes)");
      symptomNotes.forEach((n, i) => lines.push(`  ${i + 1}. "${n}"`));
    }
    lines.push("");
    lines.push("── DISCLAIMER ──────────────────────────────");
    lines.push("  This report is generated from self-reported");
    lines.push("  data using the FLASHYAF™ Hot Flash Tracking");
    lines.push("  app. It is for informational purposes ONLY");
    lines.push("  and does not constitute medical advice.");
    lines.push("  Please discuss this data with your qualified");
    lines.push("  healthcare provider.");
    lines.push("");
    lines.push("  Generated by FLASHYAF™ Hot Flash Tracker");
    lines.push("══════════════════════════════════════════");
    return lines.join("\n");
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(buildTextReport());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* fallback — silent */ }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={onBack}>← Back</button>
        <div style={styles.headerCenter}>
          <p style={styles.appName}>FLASHYAF™</p>
          <p style={styles.headerTitle}>Pattern Intelligence</p>
        </div>
        <div style={{ width: "72px" }} />
      </div>

      {loading && <FlameSpinner label="Analyzing your patterns…" />}

      {!loading && totalFlashes === 0 && (
        <div style={{ textAlign: "center", padding: "64px 28px", flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "14px" }}>
          <span style={{ fontSize: "56px" }}>🧠</span>
          <p style={{ color: "#fff", fontSize: "20px", fontWeight: 800, margin: 0, letterSpacing: "-0.3px" }}>No patterns yet</p>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "14px", lineHeight: 1.65, margin: 0, maxWidth: "280px" }}>
            When your first flash hits, tap{" "}
            <strong style={{ color: "var(--color-accent)" }}>Flash Started</strong>{" "}
            on the home screen. We'll track it together.
          </p>
        </div>
      )}

      {!loading && totalFlashes > 0 && (
        <div style={styles.scroll}>
          {/* ── Share with Doctor CTA ── */}
          <button style={styles.doctorBtn} onClick={() => setShowDoctorReport(true)}>
            <span style={styles.doctorBtnIcon}>🩺</span>
            <div style={styles.doctorBtnText}>
              <span style={styles.doctorBtnTitle}>Share With My Doctor</span>
              <span style={styles.doctorBtnSub}>30-day medical summary · PDF or copy text</span>
            </div>
            <span style={styles.doctorBtnArrow}>›</span>
          </button>

          {/* ── Symptom Body Map ── */}
          {totalFlashes > 0 && flashes.some((f) => f.bodyAreas && f.bodyAreas.length > 0) && (() => {
            const AREA_META: Record<string, { label: string; icon: string }> = {
              face:  { label: "Face / Head", icon: "🧠" },
              neck:  { label: "Neck",        icon: "🧣" },
              chest: { label: "Chest",       icon: "💗" },
              back:  { label: "Back",        icon: "🔙" },
              arms:  { label: "Arms",        icon: "💪" },
              lower: { label: "Lower Body",  icon: "🦵" },
            };
            const counts: Record<string, number> = {};
            flashes.forEach((f) => {
              (f.bodyAreas || []).forEach((a) => { counts[a] = (counts[a] || 0) + 1; });
            });
            const maxCount = Math.max(...Object.values(counts), 1);
            const withAreas = flashes.filter((f) => f.bodyAreas && f.bodyAreas.length > 0).length;
            const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
            return (
              <div style={styles.sectionCard}>
                <p style={styles.sectionTitle}>🗺️ Symptom Body Map</p>
                <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "11px", margin: "0 0 14px" }}>
                  Body areas reported across {withAreas} flash{withAreas !== 1 ? "es" : ""}
                </p>
                {sorted.map(([area, count]) => {
                  const meta = AREA_META[area] || { label: area, icon: "📍" };
                  const pct = (count / maxCount) * 100;
                  const intensity = pct >= 75 ? "#C0392B" : pct >= 50 ? "#E67E22" : pct >= 25 ? "#F5A623" : "#2E86AB";
                  return (
                    <div key={area} style={{ marginBottom: "10px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "5px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                          <span style={{ fontSize: "16px" }}>{meta.icon}</span>
                          <span style={{ color: "#fff", fontSize: "13px", fontWeight: 600 }}>{meta.label}</span>
                        </div>
                        <span style={{ color: intensity, fontSize: "12px", fontWeight: 700 }}>
                          {count} flash{count !== 1 ? "es" : ""} · {Math.round((count / withAreas) * 100)}%
                        </span>
                      </div>
                      <div style={{ height: "7px", borderRadius: "4px", background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                        <div style={{
                          height: "100%", borderRadius: "4px",
                          background: intensity,
                          width: `${pct}%`,
                          boxShadow: `0 0 8px ${intensity}88`,
                          transition: "width 0.4s ease",
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* ── Summary Stats ── */}
          <div style={styles.sectionCard}>
            <p style={styles.sectionTitle}>📊 Summary Stats</p>
            <div style={styles.statsGrid}>
              <StatBox label="Total Flashes" value={totalFlashes.toString()} />
              <StatBox label="Avg Duration" value={totalFlashes > 0 ? fmtDuration(avgDuration) : "—"} />
              <StatBox label="Avg Gap" value={avgGap > 0 ? fmtGap(avgGap) : "—"} />
              <StatBox label="Peak Time" value={peakHourLabel} />
              <StatBox label="Longest Gap" value={longestGap > 0 ? fmtGap(longestGap) : "—"} />
              <StatBox label="Completion" value={totalFlashes > 0
                ? `${Math.round((flashes.filter(f => getMaxStage(f) === "BACK_TO_NORMAL").length / totalFlashes) * 100)}%` : "—"} />
              <StatBox label="Day Streak" value={longestStreak > 0 ? `${longestStreak}d` : "—"} accent />
              <StatBox label="Avg Intensity" value={overallAvgRating !== "—" ? `★ ${overallAvgRating}` : "—"} accent />
              <StatBox label="This Week" value={thisWeekCount.toString()} accent />
            </div>
          </div>

          {/* ── Last 7 Days bar chart ── */}
          <div style={styles.sectionCard}>
            <p style={styles.sectionTitle}>📅 Last 7 Days</p>
            {totalFlashes === 0 ? (
              <p style={styles.emptyNote}>No data yet.</p>
            ) : (
              <div style={styles.weekChart}>
                {last7.map((day, i) => (
                  <div key={i} style={styles.weekBar}>
                    <div style={styles.weekBarTrack}>
                      <div style={{
                        ...styles.weekBarFill,
                        height: `${Math.max(day.count > 0 ? (day.count / max7) * 100 : 0, day.count > 0 ? 8 : 0)}%`,
                        background: i === 6 ? "var(--color-primary)" : "var(--color-cool)",
                      }} />
                    </div>
                    <span style={styles.weekBarCount}>{day.count > 0 ? day.count : ""}</span>
                    <span style={{ ...styles.weekBarLabel, color: i === 6 ? "var(--color-accent)" : "rgba(255,255,255,0.45)" }}>
                      {day.shortLabel}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Week Comparison ── */}
          <div style={styles.sectionCard}>
            <p style={styles.sectionTitle}>📈 Week Comparison</p>
            <div style={styles.weekCompareRow}>
              <div style={styles.weekCompareBox}>
                <span style={styles.weekCompareNum}>{thisWeekCount}</span>
                <span style={styles.weekCompareLabel}>This Week</span>
              </div>
              <div style={styles.weekCompareDivider}>
                <span style={{
                  ...styles.weekDelta,
                  color: weekDelta > 0 ? "#FF6B35" : weekDelta < 0 ? "#2E86AB" : "rgba(255,255,255,0.4)",
                }}>
                  {weekDelta > 0 ? `+${weekDelta}` : weekDelta < 0 ? `${weekDelta}` : "—"}
                </span>
                <span style={styles.weekDeltaLabel}>{weekDelta > 0 ? "more" : weekDelta < 0 ? "fewer" : "same"}</span>
              </div>
              <div style={styles.weekCompareBox}>
                <span style={styles.weekCompareNum}>{lastWeekCount}</span>
                <span style={styles.weekCompareLabel}>Last Week</span>
              </div>
            </div>
            {longestStreak > 0 && (
              <div style={styles.streakBanner}>
                <span style={styles.streakIcon}>🔥</span>
                <div>
                  <p style={styles.streakTitle}>Longest Tracking Streak</p>
                  <p style={styles.streakValue}>{longestStreak} day{longestStreak !== 1 ? "s" : ""} in a row</p>
                </div>
              </div>
            )}
          </div>

          {/* ── Fix 1: Check-In Timeline ── */}
          {checkins.length > 0 && (
            <div style={styles.sectionCard}>
              <p style={styles.sectionTitle}>📋 Check-In Timeline</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {checkins.slice(0, 14).map((c, i) => {
                  const d = new Date(c.timestamp);
                  const label = d.toLocaleDateString([], { month: "short", day: "numeric" });
                  const time  = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "10px 12px", background: "rgba(255,255,255,0.03)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.05)" }}>
                      <div style={{ flexShrink: 0, textAlign: "center" }}>
                        <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "11px", fontWeight: 700, margin: "0 0 1px" }}>{label}</p>
                        <p style={{ color: "rgba(255,255,255,0.25)", fontSize: "10px", margin: 0 }}>{time}</p>
                      </div>
                      <div style={{ flex: 1, display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        {[
                          { label: "🔥", val: c.flashSeverity, color: "#C0392B" },
                          { label: "😴", val: c.sleepQuality,  color: "#2980B9" },
                          { label: "💜", val: c.mood,          color: "#8E44AD" },
                          { label: "⚡", val: c.energyLevel,   color: "#E67E22" },
                          { label: "🌫️", val: c.brainFog,      color: "#7F8C8D" },
                        ].map((m) => (
                          <div key={m.label} style={{ display: "flex", alignItems: "center", gap: "3px", background: `${m.color}18`, border: `1px solid ${m.color}33`, borderRadius: "8px", padding: "2px 7px" }}>
                            <span style={{ fontSize: "11px" }}>{m.label}</span>
                            <span style={{ color: m.color, fontSize: "12px", fontWeight: 800 }}>{m.val}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {checkins.length > 14 && (
                  <p style={{ color: "rgba(255,255,255,0.25)", fontSize: "11px", textAlign: "center", margin: "4px 0 0" }}>
                    Showing most recent 14 of {checkins.length} check-ins
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── Avg peak intensity per day ── */}
          {intensityDays.length > 0 && (
            <div style={styles.sectionCard}>
              <p style={styles.sectionTitle}>⭐ Peak Intensity by Day</p>
              <div style={styles.intensityList}>
                {intensityDays.map(({ day, avg }) => (
                  <div key={day} style={styles.intensityRow}>
                    <span style={styles.intensityDay}>{day}</span>
                    <div style={styles.intensityStars}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <span key={s} style={{ color: s <= Math.round(avg) ? "#FF6B35" : "rgba(255,255,255,0.15)", fontSize: "14px" }}>★</span>
                      ))}
                    </div>
                    <span style={styles.intensityAvg}>{avg.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Hourly chart ── */}
          <div style={styles.sectionCard}>
            <p style={styles.sectionTitle}>⏰ Flashes by Hour of Day</p>
            {totalFlashes === 0 ? (
              <p style={styles.emptyNote}>No data yet.</p>
            ) : (
              <div style={styles.chartWrap}>
                <svg width="100%" viewBox={`0 0 ${CHART_W} ${CHART_H}`} style={{ overflow: "visible" }}>
                  {byHour.map((count, h) => {
                    const barH = count > 0 ? Math.max(4, Math.round((count / maxBar) * BAR_MAX_H)) : 2;
                    const x = h * (BAR_W + BAR_GAP);
                    const y = BAR_MAX_H - barH;
                    const isPeak = h === peakHour && count > 0;
                    return (
                      <g key={h}>
                        <rect x={x} y={y} width={BAR_W} height={barH} rx={3}
                          fill={isPeak ? "var(--color-primary)" : count > 0 ? "var(--color-cool)" : "rgba(255,255,255,0.08)"} />
                        {(h % 3 === 0) && (
                          <text x={x + BAR_W / 2} y={CHART_H - 4} textAnchor="middle" fontSize={7} fill="rgba(255,255,255,0.4)">
                            {getHourLabel(h)}
                          </text>
                        )}
                        {count > 0 && (
                          <text x={x + BAR_W / 2} y={y - 3} textAnchor="middle" fontSize={7}
                            fill={isPeak ? "var(--color-primary)" : "rgba(255,255,255,0.55)"}>
                            {count}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>
                <div style={styles.chartLegend}>
                  <span style={styles.legendItem}><span style={{ ...styles.legendDot, background: "var(--color-primary)" }} />Peak hour</span>
                  <span style={styles.legendItem}><span style={{ ...styles.legendDot, background: "var(--color-cool)" }} />Active hours</span>
                </div>
              </div>
            )}
          </div>

          {/* ── All Flash Logs ── */}
          <div style={styles.sectionCard}>
            <p style={styles.sectionTitle}>📋 All Flash Logs</p>
            {totalFlashes === 0 ? (
              <p style={styles.emptyNote}>No flashes logged yet. Start tracking!</p>
            ) : (
              <div style={styles.tableWrap}>
                <div style={{ ...styles.tableRow, ...styles.tableHeader }}>
                  <span style={{ ...styles.col, ...styles.colDate }}>Date & Time</span>
                  <span style={{ ...styles.col, ...styles.colDur }}>Duration</span>
                  <span style={{ ...styles.col, ...styles.colStage }}>Stages</span>
                </div>
                {[...flashes].reverse().map((flash) => {
                  const date = new Date(flash.startTime);
                  const maxStage = getMaxStage(flash);
                  const stagesCompleted = STAGE_ORDER.indexOf(maxStage) + 1;
                  return (
                    <div key={flash.id} style={styles.tableRow}>
                      <div style={{ ...styles.col, ...styles.colDate }}>
                        <span style={styles.dateMain}>{date.toLocaleDateString([], { month: "short", day: "numeric" })}</span>
                        <span style={styles.dateSub}>{date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      <div style={{ ...styles.col, ...styles.colDur }}>
                        <span style={styles.durVal}>{fmtDuration(flash.durationSeconds)}</span>
                        {flash.peakRating && flash.peakRating > 0 && (
                          <span style={styles.ratingMini}>{"★".repeat(flash.peakRating)}</span>
                        )}
                      </div>
                      <div style={{ ...styles.col, ...styles.colStage }}>
                        <div style={styles.stagePips}>
                          {STAGE_ORDER.map((s, i) => (
                            <div key={s} title={STAGE_SHORT[s]} style={{
                              ...styles.pip,
                              background: i < stagesCompleted ? STAGE_PIP_COLORS[i] : "rgba(255,255,255,0.12)",
                            }} />
                          ))}
                        </div>
                        <span style={styles.stageLabel}>{STAGE_SHORT[maxStage]}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div style={{ height: "32px" }} />
        </div>
      )}

      {/* ══ Doctor Report Modal ═════════════════════════════════════════════ */}
      {showDoctorReport && (
        <div style={dr.backdrop}>
          <div style={dr.sheet}>
            {/* Sticky top bar */}
            <div style={dr.topBar} className="no-print">
              <button style={dr.closeBtn} onClick={() => setShowDoctorReport(false)}>✕</button>
              <p style={dr.topBarTitle}>Medical Summary</p>
              <div style={{ width: "32px" }} />
            </div>

            {/* Scrollable report */}
            <div style={dr.scrollArea}>
              <div ref={reportRef} style={dr.report} data-print-report>
                {/* Report header */}
                <div style={dr.reportHeader}>
                  <div>
                    <p style={dr.reportBrand}>FLASHYAF™</p>
                    <p style={dr.reportTitle}>Hot Flash Medical Summary</p>
                    <p style={dr.reportSubtitle}>For Healthcare Provider Use</p>
                  </div>
                  <div style={dr.reportHeaderRight}>
                    <span style={dr.reportFlame}>🔥</span>
                  </div>
                </div>

                <div style={dr.divider} />

                {/* Meta */}
                <div style={dr.metaGrid}>
                  <div style={dr.metaItem}>
                    <p style={dr.metaLabel}>Patient</p>
                    <p style={dr.metaValue}>{userName}</p>
                  </div>
                  <div style={dr.metaItem}>
                    <p style={dr.metaLabel}>Report Period</p>
                    <p style={dr.metaValue}>{rangeStart} – {rangeEnd}</p>
                  </div>
                  <div style={dr.metaItem}>
                    <p style={dr.metaLabel}>Generated</p>
                    <p style={dr.metaValue}>{reportDate}</p>
                  </div>
                </div>

                <div style={dr.divider} />

                {/* Section: Summary */}
                <p style={dr.sectionHead}>📊 30-Day Summary</p>
                <div style={dr.statGrid}>
                  <div style={dr.statBox}>
                    <p style={dr.statNum}>{l30Total}</p>
                    <p style={dr.statLbl}>Total Flashes</p>
                  </div>
                  <div style={dr.statBox}>
                    <p style={dr.statNum}>{l30AvgPerDay}</p>
                    <p style={dr.statLbl}>Avg / Day</p>
                  </div>
                  <div style={dr.statBox}>
                    <p style={dr.statNum}>{l30AvgDurMin ? `${l30AvgDurMin}m` : "—"}</p>
                    <p style={dr.statLbl}>Avg Duration</p>
                  </div>
                  <div style={dr.statBox}>
                    <p style={dr.statNum}>{l30AvgIntensity ? `${l30AvgIntensity}/5` : "—"}</p>
                    <p style={dr.statLbl}>Avg Intensity</p>
                  </div>
                </div>

                {/* Intensity trend + peak time */}
                <div style={dr.infoRow}>
                  <div style={dr.infoBox}>
                    <p style={dr.infoLabel}>📈 Intensity Trend</p>
                    <p style={dr.infoValue}>{intensityTrend}</p>
                  </div>
                </div>
                {l30PeakTime && (
                  <div style={dr.infoRow}>
                    <div style={dr.infoBox}>
                      <p style={dr.infoLabel}>🕐 Most Active Time of Day</p>
                      <p style={dr.infoValue}>
                        {TIME_ICONS[l30PeakTime]} {l30PeakTime} ({TIME_RANGES[l30PeakTime]})
                      </p>
                    </div>
                  </div>
                )}

                {/* Time of day breakdown */}
                <p style={dr.sectionHead}>🕐 Time of Day Breakdown</p>
                <div style={dr.timeGrid}>
                  {TIME_SLOTS.map((slot) => {
                    const count = (l30TimeCounts as Record<string, number>)[slot];
                    const pct = l30Total > 0 ? Math.round((count / l30Total) * 100) : 0;
                    return (
                      <div key={slot} style={dr.timeBox}>
                        <p style={dr.timeIcon}>{TIME_ICONS[slot]}</p>
                        <p style={dr.timeCount}>{count}</p>
                        <p style={dr.timeName}>{slot}</p>
                        <p style={dr.timePct}>{pct}%</p>
                        <div style={dr.timeMiniBar}>
                          <div style={{
                            ...dr.timeMiniBarFill,
                            width: `${pct}%`,
                            background: slot === l30PeakTime ? "#C0392B" : "#BDC3C7",
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 30-day chart */}
                <p style={dr.sectionHead}>📅 30-Day Flash Overview</p>
                <div style={dr.chart30Wrap}>
                  <div style={dr.chart30Bars}>
                    {last30Days.map((day, i) => {
                      const h = day.count > 0 ? Math.max(4, Math.round((day.count / max30Day) * 60)) : 2;
                      const isToday = i === 29;
                      const isSunday = day.date.getDay() === 0;
                      return (
                        <div key={i} style={dr.barCol}>
                          <div style={dr.barTrack}>
                            <div style={{
                              ...dr.barFill,
                              height: `${h}px`,
                              background: isToday ? "#C0392B" : day.count > 0 ? "#2980B9" : "#E8E8E8",
                            }} />
                          </div>
                          {(i % 7 === 0 || isToday) && (
                            <p style={{
                              ...dr.barLabel,
                              color: isToday ? "#C0392B" : "#999",
                              fontWeight: isToday ? 700 : 400,
                            }}>
                              {isToday ? "Today" : day.date.toLocaleDateString([], { month: "numeric", day: "numeric" })}
                            </p>
                          )}
                          {isSunday && i > 0 && (
                            <div style={dr.weekSep} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div style={dr.chart30Legend}>
                    <span style={dr.legendItem}><span style={{ ...dr.legendDot, background: "#C0392B" }} /> Today</span>
                    <span style={dr.legendItem}><span style={{ ...dr.legendDot, background: "#2980B9" }} /> Flash logged</span>
                    <span style={dr.legendItem}><span style={{ ...dr.legendDot, background: "#E8E8E8" }} /> No flash</span>
                  </div>
                </div>

                {/* Symptom notes */}
                {symptomNotes.length > 0 && (
                  <>
                    <p style={dr.sectionHead}>📝 Symptom Notes</p>
                    <div style={dr.notesBox}>
                      <p style={dr.notesIntro}>
                        Self-reported observations logged during flash episodes (last 30 days):
                      </p>
                      {symptomNotes.map((note, i) => (
                        <div key={i} style={dr.noteRow}>
                          <span style={dr.noteBullet}>{i + 1}.</span>
                          <p style={dr.noteText}>"{note}"</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <div style={dr.divider} />

                {/* Disclaimer */}
                <div style={dr.disclaimer}>
                  <p style={dr.disclaimerTitle}>⚕️ Important Disclaimer</p>
                  <p style={dr.disclaimerText}>
                    This report is generated from self-reported data collected by the FLASHYAF™ Hot Flash Tracking
                    application. It is intended for informational purposes only and does not constitute medical advice,
                    diagnosis, or treatment. The data presented reflects patient-reported episodes and has not been
                    clinically validated. Please evaluate this information alongside a comprehensive clinical assessment.
                  </p>
                </div>

                {/* Footer */}
                <div style={dr.footer}>
                  <div style={dr.footerDivider} />
                  <div style={dr.footerRow}>
                    <p style={dr.footerL}>FLASHYAF™ · Hot Flash Tracking App</p>
                    <p style={dr.footerR}>Generated {reportDate}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Sticky action bar */}
            <div style={dr.actionBar} className="no-print">
              <button style={dr.printBtn} onClick={() => window.print()}>
                📄 Print / Save PDF
              </button>
              <button
                style={{ ...dr.copyBtn, background: copied ? "rgba(26,188,156,0.2)" : "rgba(255,255,255,0.08)" }}
                onClick={handleCopy}
              >
                {copied ? "✓ Copied!" : "📋 Copy Text"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ ...styles.statBox, ...(accent && { border: "1px solid rgba(255,107,53,0.2)" }) }}>
      <span style={styles.statValue}>{value}</span>
      <span style={styles.statLabel}>{label}</span>
    </div>
  );
}

// ── App styles (dark) ────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  container: { minHeight: "100vh", background: "var(--color-bg)", display: "flex", flexDirection: "column", maxWidth: "480px", margin: "0 auto", fontFamily: "'Inter', sans-serif" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 16px 14px", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 },
  backBtn: { background: "var(--color-card)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "100px", color: "var(--color-text)", fontSize: "13px", fontWeight: 600, padding: "8px 14px", cursor: "pointer", width: "72px", whiteSpace: "nowrap" },
  headerCenter: { textAlign: "center", flex: 1 },
  appName: { color: "var(--color-accent)", fontSize: "11px", fontWeight: 900, letterSpacing: "2px", margin: "0 0 2px" },
  headerTitle: { color: "var(--color-text)", fontSize: "17px", fontWeight: 800, margin: 0 },
  loadingBox: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center" },
  loadingText: { color: "var(--color-text-muted)", fontSize: "15px" },
  scroll: { flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "14px" },
  sectionCard: { background: "var(--color-card)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "18px", padding: "18px" },
  sectionTitle: { color: "var(--color-text)", fontSize: "15px", fontWeight: 800, margin: "0 0 16px", letterSpacing: "0.2px" },
  statsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" },
  statBox: { background: "rgba(255,255,255,0.05)", borderRadius: "12px", padding: "12px 10px", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" },
  statValue: { color: "var(--color-text)", fontSize: "18px", fontWeight: 900, lineHeight: 1 },
  statLabel: { color: "var(--color-text-muted)", fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px", textAlign: "center", lineHeight: 1.3 },
  weekChart: { display: "flex", gap: "6px", alignItems: "flex-end", height: "100px", padding: "0 4px" },
  weekBar: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" },
  weekBarTrack: { flex: 1, width: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", background: "rgba(255,255,255,0.06)", borderRadius: "6px", overflow: "hidden", minHeight: "60px" },
  weekBarFill: { width: "100%", borderRadius: "6px 6px 0 0", transition: "height 0.5s ease", minHeight: "0" },
  weekBarCount: { color: "rgba(255,255,255,0.7)", fontSize: "11px", fontWeight: 700, height: "14px", lineHeight: "14px" },
  weekBarLabel: { fontSize: "10px", fontWeight: 600 },
  weekCompareRow: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" },
  weekCompareBox: { flex: 1, background: "rgba(255,255,255,0.05)", borderRadius: "14px", padding: "14px 10px", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" },
  weekCompareNum: { color: "var(--color-text)", fontSize: "28px", fontWeight: 900, lineHeight: 1 },
  weekCompareLabel: { color: "var(--color-text-muted)", fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" },
  weekCompareDivider: { display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" },
  weekDelta: { fontSize: "22px", fontWeight: 900 },
  weekDeltaLabel: { color: "rgba(255,255,255,0.35)", fontSize: "10px", fontWeight: 600 },
  streakBanner: { background: "rgba(255,107,53,0.1)", border: "1px solid rgba(255,107,53,0.2)", borderRadius: "12px", padding: "12px 16px", display: "flex", alignItems: "center", gap: "12px" },
  streakIcon: { fontSize: "28px", flexShrink: 0 },
  streakTitle: { color: "var(--color-text-muted)", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 2px" },
  streakValue: { color: "var(--color-text)", fontSize: "16px", fontWeight: 800, margin: 0 },
  intensityList: { display: "flex", flexDirection: "column", gap: "10px" },
  intensityRow: { display: "flex", alignItems: "center", gap: "10px" },
  intensityDay: { color: "var(--color-text-muted)", fontSize: "12px", fontWeight: 600, flex: "0 0 70px" },
  intensityStars: { display: "flex", gap: "2px", flex: 1 },
  intensityAvg: { color: "#FF6B35", fontSize: "13px", fontWeight: 700, flex: "0 0 28px", textAlign: "right" },
  chartWrap: { width: "100%", overflowX: "auto" },
  chartLegend: { display: "flex", gap: "16px", marginTop: "10px", justifyContent: "center" },
  legendItem: { display: "flex", alignItems: "center", gap: "6px", color: "var(--color-text-muted)", fontSize: "11px", fontWeight: 600 },
  legendDot: { width: "8px", height: "8px", borderRadius: "2px", display: "inline-block", flexShrink: 0 },
  emptyNote: { color: "rgba(255,255,255,0.35)", fontSize: "13px", textAlign: "center", padding: "16px 0", margin: 0 },
  tableWrap: { display: "flex", flexDirection: "column", gap: "0" },
  tableRow: { display: "flex", alignItems: "center", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", gap: "8px" },
  tableHeader: { padding: "0 0 10px", borderBottom: "1px solid rgba(255,255,255,0.12)" },
  col: { display: "flex", flexDirection: "column", gap: "2px" },
  colDate: { flex: "0 0 90px" },
  colDur: { flex: "0 0 68px" },
  colStage: { flex: 1, alignItems: "flex-end" },
  dateMain: { color: "var(--color-text)", fontSize: "13px", fontWeight: 700 },
  dateSub: { color: "rgba(255,255,255,0.4)", fontSize: "11px" },
  durVal: { color: "var(--color-cool)", fontSize: "14px", fontWeight: 700 },
  ratingMini: { color: "#FF6B35", fontSize: "10px" },
  stagePips: { display: "flex", gap: "4px" },
  pip: { width: "10px", height: "10px", borderRadius: "3px" },
  stageLabel: { color: "rgba(255,255,255,0.4)", fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.3px" },

  // Doctor button
  doctorBtn: {
    display: "flex", alignItems: "center", gap: "12px",
    background: "linear-gradient(135deg, rgba(192,57,43,0.18) 0%, rgba(255,69,0,0.1) 100%)",
    border: "1px solid rgba(192,57,43,0.5)",
    borderRadius: "16px", padding: "16px",
    cursor: "pointer", width: "100%", textAlign: "left" as const,
    boxShadow: "0 0 20px rgba(192,57,43,0.1)",
  },
  doctorBtnIcon: { fontSize: "26px", flexShrink: 0 },
  doctorBtnText: { flex: 1, display: "flex", flexDirection: "column" as const, gap: "3px" },
  doctorBtnTitle: { color: "var(--color-text)", fontSize: "15px", fontWeight: 800, margin: 0 },
  doctorBtnSub: { color: "rgba(255,255,255,0.45)", fontSize: "12px", fontWeight: 500, margin: 0 },
  doctorBtnArrow: { color: "var(--color-accent)", fontSize: "22px", fontWeight: 300, flexShrink: 0 },
};

// ── Doctor report / modal styles (white/professional) ────────────────────────
const dr: Record<string, React.CSSProperties> = {
  backdrop: {
    position: "fixed" as const, inset: 0, zIndex: 600,
    background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)",
    display: "flex", alignItems: "flex-end", justifyContent: "center",
  },
  sheet: {
    width: "100%", maxWidth: "480px",
    height: "92vh",
    background: "#0D1B2A",
    borderRadius: "24px 24px 0 0",
    display: "flex", flexDirection: "column",
    overflow: "hidden",
    animation: "slideUp 0.35s ease",
    boxShadow: "0 -20px 60px rgba(0,0,0,0.5)",
  },
  topBar: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "14px 16px 12px",
    background: "#0D1B2A",
    borderBottom: "1px solid rgba(255,255,255,0.1)",
    flexShrink: 0,
  },
  closeBtn: {
    background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "50%",
    width: "32px", height: "32px", cursor: "pointer",
    fontSize: "14px", color: "rgba(255,255,255,0.6)", fontFamily: "'Inter', sans-serif",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  topBarTitle: {
    color: "#fff", fontSize: "16px", fontWeight: 800,
    fontFamily: "'Inter', sans-serif", margin: 0,
  },
  scrollArea: { flex: 1, overflowY: "auto" },
  report: {
    background: "#0D1B2A", padding: "20px",
    fontFamily: "Georgia, 'Times New Roman', serif",
  },

  // Report header
  reportHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" },
  reportBrand: { fontSize: "10px", fontWeight: 800, letterSpacing: "3px", color: "#FF4500", margin: "0 0 4px", fontFamily: "'Inter', sans-serif", textTransform: "uppercase" as const },
  reportTitle: { fontSize: "19px", fontWeight: 700, color: "#fff", margin: "0 0 2px", letterSpacing: "-0.3px" },
  reportSubtitle: { fontSize: "11px", color: "rgba(255,255,255,0.45)", margin: 0, fontFamily: "'Inter', sans-serif", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.8px" },
  reportHeaderRight: { flexShrink: 0 },
  reportFlame: { fontSize: "38px" },
  divider: { height: "1px", background: "rgba(255,255,255,0.1)", margin: "14px 0" },

  // Meta
  metaGrid: { display: "flex", gap: "0", flexWrap: "wrap" as const },
  metaItem: { flex: "1 1 0", minWidth: "110px", display: "flex", flexDirection: "column", gap: "2px" },
  metaLabel: { fontSize: "9px", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "1px", color: "rgba(255,255,255,0.4)", margin: 0, fontFamily: "'Inter', sans-serif" },
  metaValue: { fontSize: "11px", fontWeight: 600, color: "#fff", margin: 0, fontFamily: "'Inter', sans-serif" },

  // Section heading
  sectionHead: { fontSize: "10px", fontWeight: 800, textTransform: "uppercase" as const, letterSpacing: "1.5px", color: "#FF4500", margin: "16px 0 10px", fontFamily: "'Inter', sans-serif", borderLeft: "3px solid #FF4500", paddingLeft: "8px" },

  // Stats
  statGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "6px", marginBottom: "10px" },
  statBox: { border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", padding: "10px 6px", textAlign: "center", background: "rgba(255,255,255,0.05)" },
  statNum: { fontSize: "20px", fontWeight: 800, color: "#FF4500", margin: "0 0 2px", fontFamily: "'Inter', sans-serif", lineHeight: 1 },
  statLbl: { fontSize: "9px", fontWeight: 600, color: "rgba(255,255,255,0.45)", margin: 0, fontFamily: "'Inter', sans-serif", textTransform: "uppercase" as const, letterSpacing: "0.3px" },

  // Info rows
  infoRow: { marginBottom: "8px" },
  infoBox: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", padding: "10px 14px" },
  infoLabel: { fontSize: "9px", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.8px", color: "rgba(255,255,255,0.4)", margin: "0 0 3px", fontFamily: "'Inter', sans-serif" },
  infoValue: { fontSize: "13px", fontWeight: 600, color: "#fff", margin: 0, fontFamily: "'Inter', sans-serif" },

  // Time of day
  timeGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "6px", marginBottom: "4px" },
  timeBox: { border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", padding: "10px 6px", textAlign: "center", background: "rgba(255,255,255,0.05)" },
  timeIcon: { fontSize: "16px", margin: "0 0 2px" },
  timeCount: { fontSize: "18px", fontWeight: 800, color: "#fff", margin: 0, fontFamily: "'Inter', sans-serif", lineHeight: 1 },
  timeName: { fontSize: "9px", fontWeight: 700, color: "rgba(255,255,255,0.45)", margin: "1px 0 2px", fontFamily: "'Inter', sans-serif", textTransform: "uppercase" as const },
  timePct: { fontSize: "10px", fontWeight: 600, color: "#FF4500", margin: "0 0 4px", fontFamily: "'Inter', sans-serif" },
  timeMiniBar: { height: "3px", background: "rgba(255,255,255,0.1)", borderRadius: "2px", overflow: "hidden" },
  timeMiniBarFill: { height: "100%", borderRadius: "2px" },

  // 30-day chart
  chart30Wrap: { marginBottom: "4px" },
  chart30Bars: { display: "flex", alignItems: "flex-end", gap: "2px", height: "80px", position: "relative" as const },
  barCol: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", position: "relative" as const },
  barTrack: { width: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "64px" },
  barFill: { width: "100%", borderRadius: "2px 2px 0 0", minHeight: "2px" },
  barLabel: { fontSize: "7px", marginTop: "2px", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap", transform: "rotate(-35deg)", transformOrigin: "top center", color: "rgba(255,255,255,0.35)" },
  weekSep: { position: "absolute" as const, left: 0, top: 0, bottom: 0, width: "1px", background: "rgba(255,255,255,0.1)" },
  chart30Legend: { display: "flex", gap: "12px", marginTop: "16px", justifyContent: "center" },
  legendItem: { display: "flex", alignItems: "center", gap: "5px", color: "rgba(255,255,255,0.45)", fontSize: "10px", fontFamily: "'Inter', sans-serif" },
  legendDot: { width: "8px", height: "8px", borderRadius: "2px", display: "inline-block", flexShrink: 0 },

  // Notes
  notesBox: { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", padding: "12px 14px", display: "flex", flexDirection: "column", gap: "8px" },
  notesIntro: { fontSize: "10px", color: "rgba(255,255,255,0.4)", margin: 0, fontFamily: "'Inter', sans-serif", fontStyle: "italic" },
  noteRow: { display: "flex", gap: "8px", alignItems: "flex-start" },
  noteBullet: { fontSize: "10px", fontWeight: 700, color: "#FF4500", flexShrink: 0, fontFamily: "'Inter', sans-serif", paddingTop: "1px" },
  noteText: { fontSize: "12px", color: "rgba(255,255,255,0.75)", margin: 0, lineHeight: 1.5, fontStyle: "italic" },

  // Disclaimer
  disclaimer: { background: "rgba(192,57,43,0.12)", border: "1px solid rgba(192,57,43,0.3)", borderRadius: "10px", padding: "14px" },
  disclaimerTitle: { fontSize: "10px", fontWeight: 800, textTransform: "uppercase" as const, letterSpacing: "0.8px", color: "#FF4500", margin: "0 0 6px", fontFamily: "'Inter', sans-serif" },
  disclaimerText: { fontSize: "10px", color: "rgba(255,255,255,0.5)", lineHeight: 1.7, margin: 0, fontFamily: "'Inter', sans-serif" },

  // Footer
  footer: { marginTop: "16px" },
  footerDivider: { height: "1px", background: "rgba(255,255,255,0.1)", marginBottom: "8px" },
  footerRow: { display: "flex", justifyContent: "space-between" },
  footerL: { fontSize: "8px", color: "rgba(255,255,255,0.3)", margin: 0, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase" as const, fontFamily: "'Inter', sans-serif" },
  footerR: { fontSize: "8px", color: "rgba(255,255,255,0.3)", margin: 0, fontFamily: "'Inter', sans-serif" },

  // Action bar
  actionBar: {
    display: "flex", gap: "10px",
    padding: "12px 16px 20px",
    background: "#0D1B2A", borderTop: "1px solid rgba(255,255,255,0.1)", flexShrink: 0,
  },
  printBtn: {
    flex: 1, background: "#C0392B", border: "none",
    borderRadius: "100px", color: "#fff",
    fontSize: "15px", fontWeight: 800, padding: "15px",
    cursor: "pointer", fontFamily: "'Inter', sans-serif",
    boxShadow: "0 4px 16px rgba(192,57,43,0.35)",
  },
  copyBtn: {
    flex: 1, border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: "100px", color: "rgba(255,255,255,0.8)",
    fontSize: "15px", fontWeight: 700, padding: "15px",
    cursor: "pointer", fontFamily: "'Inter', sans-serif",
    transition: "background 0.2s ease", background: "transparent",
  },
};
