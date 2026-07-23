import { useEffect, useState } from "react";
import { collection, query, orderBy, getDocs, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useDemo } from "@/context/DemoContext";
import type { Flash, Stage } from "@/types/flash";
import { ALL_BADGES, computeEarnedBadgeIds } from "@/lib/badges";
import FlameSpinner from "@/components/FlameSpinner";

function buildDoctorReport(flashes: Flash[]): string {
  const now = new Date();
  const cutoff = Date.now() - 30 * 86400000;
  const recent = flashes.filter((f) => f.startTime >= cutoff);

  const totalFlashes = recent.length;
  const avgDurSec = totalFlashes > 0
    ? recent.reduce((s, f) => s + f.durationSeconds, 0) / totalFlashes
    : 0;
  const avgDurStr = `${Math.floor(avgDurSec / 60)}m ${Math.round(avgDurSec % 60)}s`;

  const byHour = Array(24).fill(0) as number[];
  recent.forEach((f) => { byHour[new Date(f.startTime).getHours()]++; });
  const peakHour = byHour.indexOf(Math.max(...byHour));
  const timeLabel = (h: number) => {
    if (h < 12) return `${h === 0 ? 12 : h}:00 AM`;
    if (h === 12) return "12:00 PM";
    return `${h - 12}:00 PM`;
  };

  const ratedFlashes = recent.filter((f) => f.peakRating && f.peakRating > 0);
  const avgIntensity = ratedFlashes.length > 0
    ? (ratedFlashes.reduce((s, f) => s + (f.peakRating || 0), 0) / ratedFlashes.length).toFixed(1)
    : "Not rated";

  const byDay: Record<string, number> = {};
  recent.forEach((f) => {
    const d = new Date(f.startTime).toLocaleDateString([], { month: "short", day: "numeric" });
    byDay[d] = (byDay[d] || 0) + 1;
  });
  const topDay = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0];

  const notesFlashes = recent.filter((f) => f.notes && f.notes.trim().length > 0);

  const timeOfDay = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  recent.forEach((f) => {
    const h = new Date(f.startTime).getHours();
    if (h >= 5 && h < 12) timeOfDay.morning++;
    else if (h >= 12 && h < 17) timeOfDay.afternoon++;
    else if (h >= 17 && h < 21) timeOfDay.evening++;
    else timeOfDay.night++;
  });

  const dateStr = now.toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>FLASHYAF™ — Hot Flash Report for Doctor Visit</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; background: #fff; color: #1a1a1a; padding: 40px; max-width: 750px; margin: 0 auto; }
  .header { border-bottom: 3px solid #C0392B; padding-bottom: 18px; margin-bottom: 28px; display: flex; justify-content: space-between; align-items: flex-end; }
  .brand { font-size: 28px; font-weight: 900; color: #C0392B; font-family: Arial, sans-serif; letter-spacing: 2px; }
  .brand-sub { font-size: 12px; color: #888; font-family: Arial, sans-serif; margin-top: 2px; }
  .date-block { text-align: right; font-size: 12px; color: #666; font-family: Arial, sans-serif; }
  h2 { font-size: 15px; font-family: Arial, sans-serif; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #C0392B; margin: 24px 0 10px; border-bottom: 1px solid #eee; padding-bottom: 6px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin: 0 0 8px; }
  .stat { background: #f9f9f9; border: 1px solid #ddd; border-radius: 8px; padding: 14px 16px; }
  .stat-label { font-size: 11px; font-family: Arial, sans-serif; color: #888; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
  .stat-value { font-size: 24px; font-weight: 900; color: #C0392B; font-family: Arial, sans-serif; margin: 4px 0 2px; }
  .stat-sub { font-size: 11px; color: #aaa; font-family: Arial, sans-serif; }
  .row { display: flex; justify-content: space-between; font-size: 13px; font-family: Arial, sans-serif; padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
  .row-label { color: #555; }
  .row-value { font-weight: 700; color: #1a1a1a; }
  .notes-list { list-style: none; }
  .notes-list li { font-size: 13px; font-family: Arial, sans-serif; padding: 8px 0; border-bottom: 1px solid #f0f0f0; color: #444; }
  .notes-list li .note-date { color: #C0392B; font-weight: 700; margin-right: 8px; }
  .disclaimer { margin-top: 32px; padding: 14px 18px; background: #fff8f8; border: 1px solid #f5c6c6; border-radius: 8px; font-size: 11px; font-family: Arial, sans-serif; color: #888; line-height: 1.6; }
  .footer { margin-top: 24px; text-align: center; font-size: 11px; font-family: Arial, sans-serif; color: #ccc; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="brand">FLASHYAF™</div>
    <div class="brand-sub">Hot Flash Tracker · BrownWorks4U2 LLC</div>
  </div>
  <div class="date-block">
    <div><strong>Report Generated</strong></div>
    <div>${dateStr}</div>
    <div>Last 30 Days</div>
  </div>
</div>

<h2>Summary</h2>
<div class="grid">
  <div class="stat">
    <div class="stat-label">Total Flashes</div>
    <div class="stat-value">${totalFlashes}</div>
    <div class="stat-sub">in 30 days</div>
  </div>
  <div class="stat">
    <div class="stat-label">Avg Duration</div>
    <div class="stat-value">${avgDurStr}</div>
    <div class="stat-sub">per flash</div>
  </div>
  <div class="stat">
    <div class="stat-label">Avg Intensity</div>
    <div class="stat-value">${avgIntensity}${avgIntensity !== "Not rated" ? "/5" : ""}</div>
    <div class="stat-sub">${ratedFlashes.length} rated</div>
  </div>
</div>

<h2>Time of Day Patterns</h2>
<div class="row"><span class="row-label">Peak flash hour</span><span class="row-value">${timeLabel(peakHour)}</span></div>
<div class="row"><span class="row-label">Morning (5am–12pm)</span><span class="row-value">${timeOfDay.morning} flash${timeOfDay.morning !== 1 ? "es" : ""}</span></div>
<div class="row"><span class="row-label">Afternoon (12pm–5pm)</span><span class="row-value">${timeOfDay.afternoon} flash${timeOfDay.afternoon !== 1 ? "es" : ""}</span></div>
<div class="row"><span class="row-label">Evening (5pm–9pm)</span><span class="row-value">${timeOfDay.evening} flash${timeOfDay.evening !== 1 ? "es" : ""}</span></div>
<div class="row"><span class="row-label">Night (9pm–5am)</span><span class="row-value">${timeOfDay.night} flash${timeOfDay.night !== 1 ? "es" : ""}</span></div>
${topDay ? `<div class="row"><span class="row-label">Highest single-day count</span><span class="row-value">${topDay[1]} on ${topDay[0]}</span></div>` : ""}

${notesFlashes.length > 0 ? `
<h2>Trigger Notes (${notesFlashes.length})</h2>
<ul class="notes-list">
  ${notesFlashes.slice(0, 15).map((f) => {
    const d = new Date(f.startTime).toLocaleDateString([], { month: "short", day: "numeric" });
    return `<li><span class="note-date">${d}</span>${f.notes}</li>`;
  }).join("")}
</ul>` : ""}

<div class="disclaimer">
  <strong>For informational purposes only, not a medical record.</strong><br>
  Generated by FLASHYAF™ app — a self-tracking tool for women navigating menopause. This data is based on self-reported entries and should be used as a supplement to, not a replacement for, professional medical evaluation. Please consult your healthcare provider with any concerns.
</div>
<div class="footer">FLASHYAF™ · BrownWorks4U2 LLC · flashyafapp.com</div>
<script>window.onload = function() { window.print(); }</script>
</body>
</html>`;
}

interface Props {
  onNavigate: (screen: string) => void;
}

const MAX_STAGE_LABEL: Record<Stage, string> = {
  STARTED: "Flash Started",
  PEAK: "Peak Intensity",
  COOLING_DOWN: "Cooling Down",
  FLASH_ENDED: "Flash Ended",
  BACK_TO_NORMAL: "Back To Normal",
};

const MAX_STAGE_COLOR: Record<Stage, string> = {
  STARTED: "#FF0000",
  PEAK: "#FF6B35",
  COOLING_DOWN: "#1A3A5C",
  FLASH_ENDED: "#26A69A",
  BACK_TO_NORMAL: "#87CEEB",
};

function getMaxStage(flash: Flash): Stage {
  const order: Stage[] = ["STARTED", "PEAK", "COOLING_DOWN", "FLASH_ENDED", "BACK_TO_NORMAL"];
  let max: Stage = "STARTED";
  for (const s of flash.stages) {
    if (order.indexOf(s.stage) > order.indexOf(max)) max = s.stage;
  }
  return max;
}

export default function HistoryScreen({ onNavigate }: Props) {
  const { user } = useAuth();
  const { isDemo, demoFlashes, demoBadgeIds } = useDemo();
  const [flashes, setFlashes] = useState<Flash[]>([]);
  const [loading, setLoading] = useState(true);
  const [earnedIds, setEarnedIds] = useState<string[]>([]);

  useEffect(() => {
    if (isDemo) {
      setFlashes(demoFlashes);
      setEarnedIds(demoBadgeIds);
      setLoading(false);
      return;
    }
    if (!user) return;
    async function load() {
      // Load flashes + user profile in parallel
      const [flashSnap, userSnap] = await Promise.all([
        getDocs(query(collection(db, "users", user!.uid, "flashes"), orderBy("startTime", "desc"))),
        getDoc(doc(db, "users", user!.uid)),
      ]);

      const loadedFlashes = flashSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Flash));
      const userData = userSnap.exists() ? userSnap.data() : {};
      const partnerMode = !!userData.partnerMode;
      const storedBadgeIds: string[] = userData.earnedBadges || [];
      const referralCount: number = userData.referralCount || 0;

      // Compute newly earned badges
      const computedIds = computeEarnedBadgeIds(loadedFlashes, partnerMode, undefined, referralCount);

      // Union: never remove a badge once earned
      const allEarned = Array.from(new Set([...storedBadgeIds, ...computedIds]));

      // Persist if anything changed
      const newlyEarned = allEarned.filter((id) => !storedBadgeIds.includes(id));
      if (newlyEarned.length > 0) {
        setDoc(doc(db, "users", user!.uid), { earnedBadges: allEarned }, { merge: true }).catch(() => {});
      }

      setFlashes(loadedFlashes);
      setEarnedIds(allEarned);
      setLoading(false);
    }
    load();
  }, [user, isDemo]);

  const earnedCount = earnedIds.length;
  const totalCount = ALL_BADGES.length;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.appName}>FLASHYAF™</h1>
        <p style={styles.headerTitle}>History</p>
      </div>

      <div style={styles.content}>
        {/* ── Achievements section ── */}
        <div style={styles.achievementsCard}>
          <div style={styles.achievementsHeader}>
            <div>
              <p style={styles.achievementsTitle}>🏅 Achievements</p>
              <p style={styles.achievementsSub}>
                {loading ? "Loading…" : `${earnedCount} of ${totalCount} earned`}
              </p>
            </div>
            {!loading && earnedCount > 0 && (
              <div style={styles.progressPill}>
                <div
                  style={{
                    ...styles.progressFill,
                    width: `${Math.round((earnedCount / totalCount) * 100)}%`,
                  }}
                />
              </div>
            )}
          </div>

          <div style={styles.badgeGrid}>
            {ALL_BADGES.map((badge) => {
              const earned = earnedIds.includes(badge.id);
              return (
                <div
                  key={badge.id}
                  style={{
                    ...styles.badgeCard,
                    ...(earned ? styles.badgeCardEarned : styles.badgeCardLocked),
                  }}
                >
                  <div style={styles.badgeIconWrap}>
                    <span
                      style={{
                        ...styles.badgeIcon,
                        filter: earned ? "none" : "grayscale(1) opacity(0.3)",
                      }}
                    >
                      {badge.icon}
                    </span>
                    {!earned && <span style={styles.lockOverlay}>🔒</span>}
                  </div>
                  <p style={{ ...styles.badgeName, color: earned ? "#F5A623" : "rgba(255,255,255,0.25)" }}>
                    {badge.name}
                  </p>
                  <p style={{ ...styles.badgeDesc, color: earned ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.18)" }}>
                    {badge.desc}
                  </p>
                  {earned && <div style={styles.earnedDot} />}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Export for Doctor button ── */}
        <button
          style={{ ...styles.exportBtn, background: "rgba(26,188,156,0.08)", border: "1px solid rgba(26,188,156,0.3)" }}
          onClick={() => {
            const html = buildDoctorReport(flashes);
            const win = window.open("", "_blank");
            if (win) { win.document.write(html); win.document.close(); }
          }}
        >
          <span style={styles.exportIcon}>🩺</span>
          <div style={styles.exportText}>
            <span style={{ ...styles.exportTitle, color: "#1ABC9C" }}>Export For My Doctor</span>
            <span style={styles.exportSub}>30-day summary · patterns · triggers · print-ready</span>
          </div>
          <span style={{ ...styles.exportArrow, color: "#1ABC9C" }}>›</span>
        </button>

        {/* ── Export Monthly Report button ── */}
        <button style={styles.exportBtn} onClick={() => onNavigate("monthly-report")}>
          <span style={styles.exportIcon}>📄</span>
          <div style={styles.exportText}>
            <span style={styles.exportTitle}>Export Monthly Report</span>
            <span style={styles.exportSub}>Print or save PDF · share with your doctor</span>
          </div>
          <span style={styles.exportArrow}>›</span>
        </button>

        {/* ── Flash history ── */}
        <p style={styles.sectionLabel}>Flash Log</p>

        {loading && <FlameSpinner label="Loading your history…" />}
        {!loading && flashes.length === 0 && (
          <div style={styles.emptyState}>
            <p style={styles.emptyIcon}>🧠</p>
            <p style={styles.empty}>No flashes logged yet.</p>
            <p style={styles.emptyHint}>
              When your first flash hits, tap{" "}
              <strong style={{ color: "var(--color-accent)" }}>Flash Started</strong>{" "}
              on the home screen. We'll track it together.
            </p>
          </div>
        )}
        {flashes.map((flash) => {
          const maxStage = getMaxStage(flash);
          const min = Math.floor(flash.durationSeconds / 60);
          const sec = flash.durationSeconds % 60;
          const date = new Date(flash.startTime);
          const stageColor = MAX_STAGE_COLOR[maxStage];
          return (
            <div key={flash.id} style={styles.flashRow}>
              <div style={styles.flashTopRow}>
                <div style={styles.flashLeft}>
                  <p style={styles.flashDate}>
                    {date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
                  </p>
                  <p style={styles.flashTime}>
                    {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <div style={styles.flashMid}>
                  <p style={styles.flashDuration}>{min}m {sec}s</p>
                </div>
                <div style={styles.flashRight}>
                  <span style={{ ...styles.stagePill, background: stageColor + "33", color: stageColor }}>
                    {MAX_STAGE_LABEL[maxStage]}
                  </span>
                  {flash.peakRating && (
                    <p style={styles.peakRatingText}>
                      {"★".repeat(flash.peakRating)}{"☆".repeat(5 - flash.peakRating)}
                    </p>
                  )}
                </div>
              </div>
              {flash.notes && flash.notes.trim().length > 0 && (
                <div style={styles.notesRow}>
                  <span style={styles.notesIcon}>📝</span>
                  <p style={styles.notesText}>{flash.notes.trim()}</p>
                </div>
              )}
              {flash.bodyAreas && flash.bodyAreas.length > 0 && (
                <div style={styles.notesRow}>
                  <span style={styles.notesIcon}>📍</span>
                  <p style={styles.notesText}>
                    {flash.bodyAreas.map((a) => ({
                      face: "Face/Head", neck: "Neck", chest: "Chest",
                      back: "Back", arms: "Arms", lower: "Lower Body",
                    } as Record<string, string>)[a] || a).join(", ")}
                  </p>
                </div>
              )}
              {flash.audioNoteUrl && (
                <div style={styles.audioRow}>
                  <span style={styles.notesIcon}>🎙️</span>
                  <audio
                    controls
                    src={flash.audioNoteUrl}
                    style={styles.audioPlayer}
                    preload="none"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={styles.bottomNav}>
        <button style={styles.navBtn} onClick={() => onNavigate("home")}>
          <span>🏠</span><span style={styles.navLabel}>Home</span>
        </button>
        <button style={{ ...styles.navBtn, ...styles.navBtnActive }} onClick={() => onNavigate("history")}>
          <span>📋</span><span style={styles.navLabel}>History</span>
        </button>
        <button style={styles.navBtn} onClick={() => onNavigate("community")}>
          <span>💬</span><span style={styles.navLabel}>Community</span>
        </button>
        <button style={styles.navBtn} onClick={() => onNavigate("learn")}>
          <span>📚</span><span style={styles.navLabel}>Learn</span>
        </button>
        <button style={styles.navBtn} onClick={() => onNavigate("shop")}>
          <span>🛍️</span><span style={styles.navLabel}>Shop</span>
        </button>
        <button style={styles.navBtn} onClick={() => onNavigate("settings")}>
          <span>⚙️</span><span style={styles.navLabel}>Settings</span>
        </button>
      </div>
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
    padding: "20px 24px 16px",
    borderBottom: "1px solid rgba(255,255,255,0.1)",
    textAlign: "center",
  },
  appName: {
    color: "var(--color-accent)", fontSize: "13px",
    fontWeight: 900, letterSpacing: "2px", margin: "0 0 4px",
  },
  headerTitle: {
    color: "var(--color-text)", fontSize: "22px", fontWeight: 800, margin: 0,
  },
  content: {
    flex: 1, overflowY: "auto",
    padding: "16px",
    display: "flex", flexDirection: "column", gap: "10px",
  },

  // Achievements card
  achievementsCard: {
    background: "var(--color-card)",
    border: "1px solid rgba(245,166,35,0.2)",
    borderRadius: "18px",
    padding: "18px",
    marginBottom: "4px",
  },
  achievementsHeader: {
    display: "flex", alignItems: "center",
    justifyContent: "space-between", gap: "16px",
    marginBottom: "16px",
  },
  achievementsTitle: {
    color: "var(--color-text)", fontSize: "16px",
    fontWeight: 800, margin: "0 0 3px",
  },
  achievementsSub: {
    color: "rgba(255,255,255,0.4)", fontSize: "12px",
    fontWeight: 600, margin: 0,
  },
  progressPill: {
    flex: "0 0 80px", height: "6px", borderRadius: "3px",
    background: "rgba(255,255,255,0.1)", overflow: "hidden",
  },
  progressFill: {
    height: "100%", borderRadius: "3px",
    background: "linear-gradient(90deg, #F5A623 0%, #FFD700 100%)",
    transition: "width 0.6s ease",
  },
  badgeGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
  },
  badgeCard: {
    borderRadius: "14px",
    padding: "14px 12px 12px",
    display: "flex", flexDirection: "column",
    alignItems: "center", gap: "5px",
    position: "relative" as const,
    textAlign: "center" as const,
    transition: "border 0.2s ease, box-shadow 0.2s ease",
  },
  badgeCardEarned: {
    background: "linear-gradient(145deg, rgba(245,166,35,0.12) 0%, rgba(255,215,0,0.06) 100%)",
    border: "1px solid rgba(245,166,35,0.45)",
    boxShadow: "0 0 16px rgba(245,166,35,0.12)",
  },
  badgeCardLocked: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.07)",
  },
  badgeIconWrap: {
    position: "relative" as const,
    display: "flex", alignItems: "center", justifyContent: "center",
    width: "44px", height: "44px",
    marginBottom: "2px",
  },
  badgeIcon: { fontSize: "32px", lineHeight: 1 },
  lockOverlay: {
    position: "absolute" as const,
    bottom: "-4px", right: "-4px",
    fontSize: "12px", lineHeight: 1,
  },
  badgeName: {
    fontSize: "11px", fontWeight: 800,
    letterSpacing: "0.3px", margin: 0,
    lineHeight: 1.3,
  },
  badgeDesc: {
    fontSize: "10px", fontWeight: 500,
    margin: 0, lineHeight: 1.4,
  },
  earnedDot: {
    position: "absolute" as const,
    top: "10px", right: "10px",
    width: "6px", height: "6px",
    borderRadius: "50%",
    background: "#F5A623",
    boxShadow: "0 0 6px #F5A623",
  },

  audioRow: {
    display: "flex", alignItems: "center", gap: "8px",
    padding: "8px 12px",
    borderTop: "1px solid rgba(255,255,255,0.05)",
  },
  audioPlayer: {
    flex: 1, height: "36px", borderRadius: "8px",
    accentColor: "#C0392B",
  },

  // Section separator
  sectionLabel: {
    color: "rgba(255,255,255,0.35)", fontSize: "11px",
    fontWeight: 700, textTransform: "uppercase" as const,
    letterSpacing: "1.2px", margin: "4px 0 2px",
  },

  // Flash list
  emptyState: { textAlign: "center", padding: "40px 20px" },
  emptyIcon: { fontSize: "48px", margin: "0 0 12px" },
  empty: {
    color: "var(--color-text-muted)", fontSize: "16px",
    textAlign: "center", margin: 0,
  },
  emptyHint: { color: "rgba(255,255,255,0.3)", fontSize: "13px", marginTop: "8px" },
  flashRow: {
    background: "var(--color-card)", borderRadius: "14px",
    padding: "14px 16px",
    display: "flex", flexDirection: "column", gap: "0px",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  flashTopRow: { display: "flex", alignItems: "center", gap: "12px" },
  flashLeft: { minWidth: "80px" },
  flashDate: { color: "var(--color-text)", fontSize: "13px", fontWeight: 700, margin: "0 0 2px" },
  flashTime: { color: "var(--color-text-muted)", fontSize: "12px", margin: 0 },
  flashMid: { flex: 1, textAlign: "center" },
  flashDuration: { color: "var(--color-text)", fontSize: "18px", fontWeight: 800, margin: 0 },
  flashRight: { textAlign: "right" },
  stagePill: {
    borderRadius: "100px", padding: "4px 10px",
    fontSize: "11px", fontWeight: 700, whiteSpace: "nowrap",
  },
  peakRatingText: {
    color: "#FF6B35", fontSize: "10px", fontWeight: 700,
    margin: "4px 0 0", textAlign: "right", letterSpacing: "1px",
  },
  notesRow: {
    display: "flex", alignItems: "flex-start", gap: "8px",
    marginTop: "10px", paddingTop: "10px",
    borderTop: "1px solid rgba(255,255,255,0.07)",
  },
  notesIcon: { fontSize: "13px", flexShrink: 0, marginTop: "1px" },
  notesText: {
    color: "rgba(255,255,255,0.55)", fontSize: "12px", fontWeight: 500,
    margin: 0, lineHeight: 1.5, fontStyle: "italic", flex: 1,
  },

  // Export button
  exportBtn: {
    display: "flex", alignItems: "center", gap: "12px",
    background: "rgba(192,57,43,0.1)",
    border: "1px solid rgba(192,57,43,0.35)",
    borderRadius: "14px", padding: "14px 16px",
    cursor: "pointer", width: "100%", textAlign: "left" as const,
  },
  exportIcon: { fontSize: "22px", flexShrink: 0 },
  exportText: {
    flex: 1, display: "flex", flexDirection: "column" as const, gap: "2px",
  },
  exportTitle: {
    color: "var(--color-text)", fontSize: "15px", fontWeight: 700,
  },
  exportSub: {
    color: "rgba(255,255,255,0.4)", fontSize: "11px", fontWeight: 500,
  },
  exportArrow: {
    color: "var(--color-accent)", fontSize: "20px", fontWeight: 300, flexShrink: 0,
  },

  // Nav
  bottomNav: {
    display: "flex", borderTop: "1px solid rgba(255,255,255,0.1)",
    background: "var(--color-bg)", padding: "12px 0 20px",
  },
  navBtn: {
    flex: 1, background: "transparent", border: "none",
    color: "rgba(255,255,255,0.4)", display: "flex", flexDirection: "column",
    alignItems: "center", gap: "4px", cursor: "pointer",
    fontSize: "22px", padding: "4px 0",
  },
  navBtnActive: { color: "var(--color-accent)" },
  navLabel: { fontSize: "11px", fontWeight: 600 },
};
