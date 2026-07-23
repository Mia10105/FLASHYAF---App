import { useEffect, useState } from "react";
import { collection, query, orderBy, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import type { Flash } from "@/types/flash";

interface Props {
  onBack: () => void;
}

const TIME_SLOTS = ["Morning", "Afternoon", "Evening", "Night"] as const;
const TIME_ICONS: Record<string, string> = {
  Morning: "🌅", Afternoon: "☀️", Evening: "🌆", Night: "🌙",
};

function getTimeSlot(ts: number): string {
  const h = new Date(ts).getHours();
  if (h >= 6 && h < 12) return "Morning";
  if (h >= 12 && h < 18) return "Afternoon";
  if (h >= 18 && h < 22) return "Evening";
  return "Night";
}

function getWeeks(year: number, month: number): { label: string; start: number; end: number }[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks = [];
  for (let start = 1; start <= daysInMonth; start += 7) {
    const end = Math.min(start + 6, daysInMonth);
    weeks.push({ label: `${start}–${end}`, start, end });
  }
  return weeks;
}

function closingMessage(total: number, monthName: string): string {
  if (total === 0)
    return `No hot flashes were recorded in ${monthName}. Whether it was a quieter month or you're just getting started, keep the app close for next time.`;
  if (total <= 5)
    return `You logged ${total} hot flash${total > 1 ? "es" : ""} in ${monthName}. Even lighter months produce valuable data patterns over time. You're building a picture your doctor can actually use.`;
  if (total <= 20)
    return `${total} hot flashes tracked in ${monthName}. This level of consistent self-monitoring is exactly what helps healthcare providers make informed decisions. Your dedication to understanding your body is genuinely powerful.`;
  return `You logged ${total} hot flashes in ${monthName} — a detailed record that gives your medical team real, actionable data. Your resilience and commitment to self-knowledge through this journey are truly remarkable.`;
}

export default function MonthlyReportScreen({ onBack }: Props) {
  const { user } = useAuth();
  const [allFlashes, setAllFlashes] = useState<Flash[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthOffset, setMonthOffset] = useState(0); // 0 = current month

  useEffect(() => {
    if (!user) return;
    async function load() {
      const snap = await getDocs(
        query(collection(db, "users", user!.uid, "flashes"), orderBy("startTime", "desc"))
      );
      setAllFlashes(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Flash)));
      setLoading(false);
    }
    load();
  }, [user]);

  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const selectedYear = target.getFullYear();
  const selectedMonth = target.getMonth();
  const monthName = target.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const shortMonth = target.toLocaleDateString("en-US", { month: "long" });

  // ── Stats computation ────────────────────────────────────────────────────
  const monthFlashes = allFlashes.filter((f) => {
    const d = new Date(f.startTime);
    return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
  });

  const total = monthFlashes.length;
  const avgDurMin =
    total > 0
      ? (monthFlashes.reduce((s, f) => s + f.durationSeconds, 0) / total / 60).toFixed(1)
      : null;

  const ratedFlashes = monthFlashes.filter((f) => f.peakRating);
  const avgIntensity =
    ratedFlashes.length > 0
      ? (ratedFlashes.reduce((s, f) => s + (f.peakRating || 0), 0) / ratedFlashes.length).toFixed(1)
      : null;

  // Day-by-day counts within this month
  const dayCounts: Record<number, number> = {};
  for (const f of monthFlashes) {
    const d = new Date(f.startTime).getDate();
    dayCounts[d] = (dayCounts[d] || 0) + 1;
  }
  const dayEntries = Object.entries(dayCounts).map(([d, c]) => ({ day: Number(d), count: c }));
  const bestDay = dayEntries.length > 0 ? dayEntries.reduce((a, b) => (a.count <= b.count ? a : b)) : null;
  const worstDay = dayEntries.length > 0 ? dayEntries.reduce((a, b) => (a.count >= b.count ? a : b)) : null;

  // Time of day
  const timeCounts: Record<string, number> = { Morning: 0, Afternoon: 0, Evening: 0, Night: 0 };
  for (const f of monthFlashes) timeCounts[getTimeSlot(f.startTime)]++;
  const mostCommonTime =
    total > 0
      ? (Object.entries(timeCounts).reduce((a, b) => (a[1] >= b[1] ? a : b))[0] as string)
      : null;

  // Weekly breakdown
  const weeks = getWeeks(selectedYear, selectedMonth).map((w) => ({
    ...w,
    count: monthFlashes.filter((f) => {
      const d = new Date(f.startTime).getDate();
      return d >= w.start && d <= w.end;
    }).length,
  }));
  const maxWeek = Math.max(...weeks.map((w) => w.count), 1);

  const generatedDate = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const userName =
    user?.displayName || user?.email?.split("@")[0] || "Patient";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={app.container}>
      {/* App chrome — hidden on print */}
      <div style={app.chrome} className="no-print">
        <button style={app.backBtn} onClick={onBack}>← Back</button>
        <p style={app.chromeTitle}>Monthly Report</p>
        <button
          style={app.printBtn}
          onClick={() => window.print()}
          disabled={loading}
        >
          🖨️ Print / PDF
        </button>
      </div>

      {/* Month selector — hidden on print */}
      <div style={app.monthSelector} className="no-print">
        <button
          style={app.monthArrow}
          onClick={() => setMonthOffset((o) => Math.max(o - 1, -23))}
        >
          ‹
        </button>
        <p style={app.monthLabel}>{monthName}</p>
        <button
          style={{ ...app.monthArrow, opacity: monthOffset >= 0 ? 0.3 : 1 }}
          onClick={() => setMonthOffset((o) => Math.min(o + 1, 0))}
          disabled={monthOffset >= 0}
        >
          ›
        </button>
      </div>

      {/* ══ PRINTABLE REPORT ══════════════════════════════════════════════ */}
      <div style={rpt.page} data-print-report>
        {/* Header */}
        <div style={rpt.header}>
          <div style={rpt.headerLeft}>
            <p style={rpt.brand}>FLASHYAF™</p>
            <p style={rpt.reportTitle}>Hot Flash Monthly Report</p>
          </div>
          <div style={rpt.headerRight}>
            <div style={rpt.flameLogo}>🔥</div>
          </div>
        </div>

        <div style={rpt.divider} />

        {/* Meta */}
        <div style={rpt.metaRow}>
          <div style={rpt.metaItem}>
            <span style={rpt.metaLabel}>Patient</span>
            <span style={rpt.metaValue}>{userName}</span>
          </div>
          <div style={rpt.metaItem}>
            <span style={rpt.metaLabel}>Report Period</span>
            <span style={rpt.metaValue}>{monthName}</span>
          </div>
          <div style={rpt.metaItem}>
            <span style={rpt.metaLabel}>Generated</span>
            <span style={rpt.metaValue}>{generatedDate}</span>
          </div>
        </div>

        <div style={rpt.divider} />

        {loading ? (
          <p style={rpt.loadingText}>Loading data…</p>
        ) : total === 0 ? (
          <div style={rpt.noDataBox}>
            <p style={rpt.noDataTitle}>No flashes logged in {shortMonth}</p>
            <p style={rpt.noDataSub}>
              Either a quiet month or tracking hadn't started yet. Consistent logging builds a clearer picture over time.
            </p>
          </div>
        ) : (
          <>
            {/* ── Section: Summary ── */}
            <p style={rpt.sectionHeading}>📊 Summary</p>
            <div style={rpt.statsGrid}>
              <div style={rpt.statBox}>
                <p style={rpt.statNumber}>{total}</p>
                <p style={rpt.statLabel}>Total Flashes</p>
              </div>
              <div style={rpt.statBox}>
                <p style={rpt.statNumber}>{avgDurMin ?? "—"}</p>
                <p style={rpt.statLabel}>Avg Duration (min)</p>
              </div>
              <div style={rpt.statBox}>
                <p style={rpt.statNumber}>{avgIntensity ? `${avgIntensity}/5` : "—"}</p>
                <p style={rpt.statLabel}>Avg Intensity</p>
              </div>
              <div style={rpt.statBox}>
                <p style={rpt.statNumber}>{mostCommonTime ? TIME_ICONS[mostCommonTime] : "—"}</p>
                <p style={rpt.statLabel}>Peak Time: {mostCommonTime ?? "N/A"}</p>
              </div>
            </div>

            {/* ── Section: Best / Worst Day ── */}
            <div style={rpt.dayRow}>
              <div style={{ ...rpt.dayBox, borderColor: "#27AE60" }}>
                <p style={rpt.dayBoxLabel}>🟢 Best Day</p>
                <p style={rpt.dayBoxDate}>
                  {bestDay
                    ? `${shortMonth} ${bestDay.day}`
                    : "—"}
                </p>
                <p style={rpt.dayBoxCount}>
                  {bestDay ? `${bestDay.count} flash${bestDay.count !== 1 ? "es" : ""}` : ""}
                </p>
              </div>
              <div style={{ ...rpt.dayBox, borderColor: "#E74C3C" }}>
                <p style={rpt.dayBoxLabel}>🔴 Most Active Day</p>
                <p style={rpt.dayBoxDate}>
                  {worstDay
                    ? `${shortMonth} ${worstDay.day}`
                    : "—"}
                </p>
                <p style={rpt.dayBoxCount}>
                  {worstDay ? `${worstDay.count} flash${worstDay.count !== 1 ? "es" : ""}` : ""}
                </p>
              </div>
            </div>

            {/* ── Section: Time of Day breakdown ── */}
            <p style={rpt.sectionHeading}>🕐 Time of Day Breakdown</p>
            <div style={rpt.timeGrid}>
              {TIME_SLOTS.map((slot) => (
                <div key={slot} style={rpt.timeBox}>
                  <p style={rpt.timeIcon}>{TIME_ICONS[slot]}</p>
                  <p style={rpt.timeCount}>{timeCounts[slot]}</p>
                  <p style={rpt.timeLabel}>{slot}</p>
                  <div style={rpt.timeMiniBar}>
                    <div
                      style={{
                        ...rpt.timeMiniBarFill,
                        width: `${total > 0 ? Math.round((timeCounts[slot] / total) * 100) : 0}%`,
                        background: slot === mostCommonTime ? "#C0392B" : "#BDC3C7",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* ── Section: Weekly breakdown ── */}
            <p style={rpt.sectionHeading}>📅 Weekly Breakdown</p>
            <div style={rpt.weekChart}>
              {weeks.map((w, i) => (
                <div key={i} style={rpt.weekRow}>
                  <p style={rpt.weekLabel}>
                    Week {i + 1}<br />
                    <span style={rpt.weekDays}>{shortMonth.slice(0, 3)} {w.label}</span>
                  </p>
                  <div style={rpt.barTrack}>
                    <div
                      style={{
                        ...rpt.barFill,
                        width: `${Math.round((w.count / maxWeek) * 100)}%`,
                        background: w.count === Math.max(...weeks.map(x => x.count))
                          ? "#C0392B"
                          : "#2980B9",
                      }}
                    />
                  </div>
                  <p style={rpt.barCount}>{w.count}</p>
                </div>
              ))}
            </div>
          </>
        )}

        <div style={rpt.divider} />

        {/* ── Closing message ── */}
        <div style={rpt.closing}>
          <p style={rpt.closingQuote}>"</p>
          <p style={rpt.closingText}>{closingMessage(total, monthName)}</p>
          <p style={rpt.closingNote}>
            Please share this report with your healthcare provider. For questions about menopause management,
            consult a qualified medical professional.
          </p>
        </div>

        {/* Footer */}
        <div style={rpt.footer}>
          <div style={rpt.footerDivider} />
          <div style={rpt.footerRow}>
            <p style={rpt.footerLeft}>FLASHYAF™ · Hot Flash Tracking App</p>
            <p style={rpt.footerRight}>Report generated {generatedDate}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── App chrome styles (dark theme) ──────────────────────────────────────────
const app: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh", background: "var(--color-bg)",
    display: "flex", flexDirection: "column",
    maxWidth: "480px", margin: "0 auto",
    fontFamily: "'Inter', sans-serif",
  },
  chrome: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "16px 16px 8px",
    borderBottom: "1px solid rgba(255,255,255,0.1)",
  },
  backBtn: {
    background: "transparent", border: "none",
    color: "rgba(255,255,255,0.6)", fontSize: "15px",
    fontWeight: 600, cursor: "pointer", padding: "6px 0",
    fontFamily: "'Inter', sans-serif",
  },
  chromeTitle: {
    color: "#fff", fontSize: "16px", fontWeight: 800, margin: 0,
  },
  printBtn: {
    background: "rgba(192,57,43,0.85)", border: "none",
    borderRadius: "100px", color: "#fff", fontSize: "13px",
    fontWeight: 700, padding: "8px 16px", cursor: "pointer",
    fontFamily: "'Inter', sans-serif",
  },
  monthSelector: {
    display: "flex", alignItems: "center", justifyContent: "center",
    gap: "20px", padding: "12px 24px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },
  monthArrow: {
    background: "rgba(255,255,255,0.1)", border: "none",
    color: "#fff", fontSize: "22px", fontWeight: 300,
    width: "36px", height: "36px", borderRadius: "50%",
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
  },
  monthLabel: {
    color: "#fff", fontSize: "16px", fontWeight: 700, margin: 0, minWidth: "160px", textAlign: "center",
  },
};

// ── Report styles (dark theme) ───────────────────────────────────────────────
const rpt: Record<string, React.CSSProperties> = {
  page: {
    background: "#0D1B2A", color: "#fff",
    padding: "24px 20px 20px",
    margin: "12px 12px 80px",
    borderRadius: "16px",
    fontFamily: "Georgia, 'Times New Roman', serif",
    boxShadow: "0 2px 24px rgba(0,0,0,0.35)",
    border: "1px solid rgba(255,255,255,0.1)",
  },
  loadingText: { textAlign: "center", color: "rgba(255,255,255,0.4)", padding: "40px 0", fontFamily: "Georgia, serif" },
  header: {
    display: "flex", justifyContent: "space-between", alignItems: "flex-start",
    marginBottom: "16px",
  },
  headerLeft: { display: "flex", flexDirection: "column", gap: "4px" },
  brand: {
    fontSize: "11px", fontWeight: 800, letterSpacing: "3px",
    color: "#FF4500", margin: 0, fontFamily: "'Inter', sans-serif",
    textTransform: "uppercase",
  },
  reportTitle: {
    fontSize: "20px", fontWeight: 700, color: "#fff", margin: 0,
    letterSpacing: "-0.3px",
  },
  headerRight: { display: "flex", alignItems: "center" },
  flameLogo: { fontSize: "36px", opacity: 0.85 },
  divider: {
    height: "1px", background: "rgba(255,255,255,0.1)",
    margin: "14px 0",
  },
  metaRow: {
    display: "flex", gap: "0",
    flexWrap: "wrap" as const,
  },
  metaItem: {
    flex: "1 1 0", display: "flex", flexDirection: "column", gap: "2px",
    minWidth: "120px",
  },
  metaLabel: {
    fontSize: "9px", fontWeight: 700, textTransform: "uppercase" as const,
    letterSpacing: "1px", color: "rgba(255,255,255,0.4)", fontFamily: "'Inter', sans-serif",
  },
  metaValue: {
    fontSize: "12px", fontWeight: 600, color: "#fff",
    fontFamily: "'Inter', sans-serif",
  },
  sectionHeading: {
    fontSize: "11px", fontWeight: 800, textTransform: "uppercase" as const,
    letterSpacing: "1.5px", color: "#FF4500",
    margin: "16px 0 10px",
    fontFamily: "'Inter', sans-serif",
    borderLeft: "3px solid #FF4500",
    paddingLeft: "8px",
  },
  statsGrid: {
    display: "grid", gridTemplateColumns: "1fr 1fr",
    gap: "8px",
  },
  statBox: {
    border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px",
    padding: "12px 14px", textAlign: "center",
    background: "rgba(255,255,255,0.05)",
  },
  statNumber: {
    fontSize: "24px", fontWeight: 800, color: "#FF4500", margin: "0 0 2px",
    fontFamily: "'Inter', sans-serif", lineHeight: 1,
  },
  statLabel: {
    fontSize: "10px", fontWeight: 600, color: "rgba(255,255,255,0.45)", margin: 0,
    fontFamily: "'Inter', sans-serif",
    textTransform: "uppercase" as const, letterSpacing: "0.5px",
  },
  dayRow: {
    display: "flex", gap: "8px", margin: "12px 0 0",
  },
  dayBox: {
    flex: 1, border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px",
    padding: "12px 14px", textAlign: "center", background: "rgba(255,255,255,0.05)",
  },
  dayBoxLabel: {
    fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.45)", margin: "0 0 6px",
    fontFamily: "'Inter', sans-serif", textTransform: "uppercase" as const, letterSpacing: "0.5px",
  },
  dayBoxDate: {
    fontSize: "15px", fontWeight: 800, color: "#fff", margin: "0 0 2px",
    fontFamily: "'Inter', sans-serif",
  },
  dayBoxCount: {
    fontSize: "11px", color: "rgba(255,255,255,0.45)", margin: 0,
    fontFamily: "'Inter', sans-serif", fontWeight: 600,
  },
  timeGrid: {
    display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "6px",
  },
  timeBox: {
    border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px",
    padding: "10px 8px", textAlign: "center", background: "rgba(255,255,255,0.05)",
  },
  timeIcon: { fontSize: "18px", margin: "0 0 4px" },
  timeCount: {
    fontSize: "18px", fontWeight: 800, color: "#fff", margin: "0 0 1px",
    fontFamily: "'Inter', sans-serif", lineHeight: 1,
  },
  timeLabel: {
    fontSize: "9px", fontWeight: 700, color: "rgba(255,255,255,0.45)", margin: "0 0 6px",
    fontFamily: "'Inter', sans-serif", textTransform: "uppercase" as const,
  },
  timeMiniBar: {
    height: "4px", background: "rgba(255,255,255,0.1)", borderRadius: "2px", overflow: "hidden",
  },
  timeMiniBarFill: {
    height: "100%", borderRadius: "2px", transition: "width 0.4s ease",
  },
  weekChart: {
    display: "flex", flexDirection: "column", gap: "8px",
  },
  weekRow: {
    display: "flex", alignItems: "center", gap: "10px",
  },
  weekLabel: {
    fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.5)", margin: 0,
    fontFamily: "'Inter', sans-serif", minWidth: "64px", lineHeight: 1.3,
    textAlign: "right" as const,
  },
  weekDays: {
    fontWeight: 400, color: "rgba(255,255,255,0.35)",
  },
  barTrack: {
    flex: 1, height: "16px", background: "rgba(255,255,255,0.08)",
    borderRadius: "4px", overflow: "hidden",
  },
  barFill: {
    height: "100%", borderRadius: "4px",
    transition: "width 0.5s ease",
    minWidth: "4px",
  },
  barCount: {
    fontSize: "12px", fontWeight: 800, color: "#fff",
    margin: 0, fontFamily: "'Inter', sans-serif",
    minWidth: "24px", textAlign: "right" as const,
  },
  noDataBox: {
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "12px", padding: "32px 24px", textAlign: "center",
    margin: "16px 0",
  },
  noDataTitle: {
    fontSize: "16px", fontWeight: 700, color: "rgba(255,255,255,0.7)",
    margin: "0 0 8px", fontFamily: "'Inter', sans-serif",
  },
  noDataSub: {
    fontSize: "12px", color: "rgba(255,255,255,0.4)", lineHeight: 1.6, margin: 0,
    fontFamily: "'Inter', sans-serif",
  },
  closing: {
    background: "rgba(192,57,43,0.1)", border: "1px solid rgba(192,57,43,0.25)",
    borderRadius: "12px", padding: "18px 20px",
    margin: "4px 0 0",
  },
  closingQuote: {
    fontSize: "48px", color: "#FF4500", fontWeight: 900,
    lineHeight: 0.6, margin: "0 0 8px", opacity: 0.4,
  },
  closingText: {
    fontSize: "13px", lineHeight: 1.7, color: "rgba(255,255,255,0.8)",
    margin: "0 0 12px", fontStyle: "italic",
  },
  closingNote: {
    fontSize: "10px", color: "rgba(255,255,255,0.35)", lineHeight: 1.6, margin: 0,
    fontFamily: "'Inter', sans-serif",
    borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "10px",
  },
  footer: { marginTop: "20px" },
  footerDivider: { height: "1px", background: "rgba(255,255,255,0.08)", marginBottom: "10px" },
  footerRow: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
  },
  footerLeft: {
    fontSize: "9px", color: "rgba(255,255,255,0.3)", margin: 0, fontWeight: 700,
    letterSpacing: "1px", textTransform: "uppercase" as const,
    fontFamily: "'Inter', sans-serif",
  },
  footerRight: {
    fontSize: "9px", color: "rgba(255,255,255,0.3)", margin: 0,
    fontFamily: "'Inter', sans-serif",
  },
};
