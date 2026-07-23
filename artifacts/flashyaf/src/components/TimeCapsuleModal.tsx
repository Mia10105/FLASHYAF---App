import { useState } from "react";
import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Flash } from "@/types/flash";
import type { User } from "firebase/auth";

interface Props {
  flashes: Flash[];
  milestone: 30 | 60 | 90;
  user: User;
  onClose: () => void;
  onSealed: () => void;
}

interface CapsuleStats {
  startDate: string;
  totalFlashes: number;
  hardestDay: string;
  hardestDayCount: number;
  easiestDay: string;
  easiestDayCount: number;
  avgDuration: string;
  avgIntensity: number;
  topBodyArea: string;
  badgesEarned: string[];
  scoreTrend: { first: number; last: number; improved: boolean };
}

const BADGE_THRESHOLDS = [
  { min: 1, badge: "🔥 First Flame" },
  { min: 10, badge: "⚡ Spark Tracker" },
  { min: 25, badge: "💪 Flash Fighter" },
  { min: 50, badge: "🌟 Menopause Warrior" },
  { min: 100, badge: "🏆 Flash Legend" },
  { min: 250, badge: "👑 Founding Legend" },
];

const FLASHY_MESSAGES: Record<30 | 60 | 90, string> = {
  30: "Look how far you've come in 30 days. I have been with you through every single one. Every flash. Every breath. Every time you hit log instead of hiding. I am so proud of you.",
  60: "Two months. That is not tracking — that is a practice. You are building self-knowledge most people never have. I see every pattern in your data, and what I see is a woman who refuses to disappear.",
  90: "90 days. A full season. You started this when you didn't know what the next flash would bring. Now you have data, patterns, and proof — you handle everything. Every. Single. Time.",
};

function computeStats(flashes: Flash[]): CapsuleStats {
  const sorted = [...flashes].sort((a, b) => a.startTime - b.startTime);

  // Start date
  const startDate = sorted.length
    ? new Date(sorted[0].startTime).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })
    : "Unknown";

  // Group by day
  const byDay: Record<string, Flash[]> = {};
  sorted.forEach((f) => {
    const key = new Date(f.startTime).toLocaleDateString();
    if (!byDay[key]) byDay[key] = [];
    byDay[key].push(f);
  });
  const days = Object.entries(byDay);

  // Hardest day (most flashes)
  const hardest = days.reduce((a, b) => (b[1].length > a[1].length ? b : a), days[0] || ["—", []]);
  const hardestDay = hardest
    ? new Date(hardest[0]).toLocaleDateString([], { month: "long", day: "numeric" })
    : "—";
  const hardestDayCount = hardest ? hardest[1].length : 0;

  // Easiest day (fewest flashes among days that had any)
  const easiest = days.reduce((a, b) => (b[1].length < a[1].length ? b : a), days[0] || ["—", []]);
  const easiestDay = easiest
    ? new Date(easiest[0]).toLocaleDateString([], { month: "long", day: "numeric" })
    : "—";
  const easiestDayCount = easiest ? easiest[1].length : 0;

  // Avg duration
  const avgSec = sorted.length
    ? sorted.reduce((s, f) => s + f.durationSeconds, 0) / sorted.length
    : 0;
  const avgDuration = `${Math.floor(avgSec / 60)}m ${Math.round(avgSec % 60)}s`;

  // Avg intensity
  const withRating = sorted.filter((f) => (f.peakRating ?? 0) > 0);
  const avgIntensity = withRating.length
    ? Math.round((withRating.reduce((s, f) => s + (f.peakRating ?? 0), 0) / withRating.length) * 10) / 10
    : 0;

  // Top body area
  const areaCount: Record<string, number> = {};
  sorted.forEach((f) => {
    if (Array.isArray(f.bodyAreas)) {
      f.bodyAreas.forEach((a) => { areaCount[a] = (areaCount[a] || 0) + 1; });
    }
  });
  const topBodyArea = Object.entries(areaCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  // Badges earned
  const badgesEarned = BADGE_THRESHOLDS.filter((b) => sorted.length >= b.min).map((b) => b.badge);

  // Score trend: avg intensity first 7 days vs last 7 days
  const firstWeek = sorted.filter((f) => {
    if (!sorted[0]) return false;
    return f.startTime - sorted[0].startTime < 7 * 86400 * 1000;
  }).filter((f) => (f.peakRating ?? 0) > 0);
  const lastWeek = sorted.filter((f) => {
    const last = sorted[sorted.length - 1];
    if (!last) return false;
    return last.startTime - f.startTime < 7 * 86400 * 1000;
  }).filter((f) => (f.peakRating ?? 0) > 0);
  const firstAvg = firstWeek.length ? firstWeek.reduce((s, f) => s + (f.peakRating ?? 0), 0) / firstWeek.length : 0;
  const lastAvg = lastWeek.length ? lastWeek.reduce((s, f) => s + (f.peakRating ?? 0), 0) / lastWeek.length : 0;
  const improved = lastAvg < firstAvg;

  return {
    startDate, totalFlashes: sorted.length,
    hardestDay, hardestDayCount, easiestDay, easiestDayCount,
    avgDuration, avgIntensity, topBodyArea, badgesEarned,
    scoreTrend: { first: Math.round(firstAvg * 10) / 10, last: Math.round(lastAvg * 10) / 10, improved },
  };
}

export default function TimeCapsuleModal({ flashes, milestone, user, onClose, onSealed }: Props) {
  const stats = computeStats(flashes);
  const [sealing, setSealing] = useState(false);
  const [sealed, setSealed] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const milestoneLabel = `${milestone}-Day`;
  const flashyMsg = FLASHY_MESSAGES[milestone];

  async function handleSeal() {
    setSealing(true);
    try {
      await setDoc(doc(collection(db, "users", user.uid, "timeCapsules"), `day${milestone}`), {
        milestone,
        generatedAt: serverTimestamp(),
        stats,
        flashyMessage: flashyMsg,
        userId: user.uid,
      });
      setSealed(true);
      onSealed();
    } catch {
      setSealing(false);
    }
  }

  function handleShare() {
    const text = `🕰️ My FLASHYAF™ ${milestoneLabel} Time Capsule\n\n` +
      `Started: ${stats.startDate}\n` +
      `Total flashes logged: ${stats.totalFlashes}\n` +
      `Hardest day: ${stats.hardestDay} (${stats.hardestDayCount} flashes)\n` +
      `Easiest day: ${stats.easiestDay} (${stats.easiestDayCount} flash${stats.easiestDayCount !== 1 ? "es" : ""})\n` +
      `Badges earned: ${stats.badgesEarned.length > 0 ? stats.badgesEarned.join(", ") : "Just getting started"}\n\n` +
      `Tracked with FLASHYAF™ — Your hot flash. Your data. Your power. 🔥`;
    navigator.clipboard.writeText(text).catch(() => {});
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2500);
  }

  const s = styles;
  const milestoneColor = milestone === 30 ? "#FF4500" : milestone === 60 ? "#E91E8C" : "#FFD700";

  return (
    <div style={s.backdrop} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={s.sheet}>
        {/* Header */}
        <div style={{ ...s.headerBand, background: `linear-gradient(135deg, ${milestoneColor}20, transparent)`, borderBottom: `1px solid ${milestoneColor}30` }}>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
          <div style={s.capsuleIcon}>
            <span style={{ fontSize: "40px", lineHeight: 1 }}>🕰️</span>
          </div>
          <p style={{ ...s.capsuleTitle, color: milestoneColor }}>YOUR {milestone}-DAY TIME CAPSULE</p>
          <p style={s.capsuleDate}>Journey began {stats.startDate}</p>
        </div>

        <div style={s.scrollArea}>
          {/* Flashy message */}
          <div style={{ ...s.flashyCard, borderColor: `${milestoneColor}35` }}>
            <p style={s.flashyLabel}>🔥 A message from Flashy</p>
            <p style={s.flashyMsg}>"{flashyMsg}"</p>
            <p style={{ ...s.flashySig, color: milestoneColor }}>— Flashy, your AI companion</p>
          </div>

          {/* Key stats grid */}
          <div style={s.gridLabel}>YOUR {milestoneLabel.toUpperCase()} IN NUMBERS</div>
          <div style={s.statsGrid}>
            <MiniStat icon="🔥" value={stats.totalFlashes.toString()} label="Flashes Logged" color={milestoneColor} />
            <MiniStat icon="⏱️" value={stats.avgDuration} label="Avg Duration" color="#9B59B6" />
            <MiniStat icon="📈" value={stats.avgIntensity > 0 ? `${stats.avgIntensity}/10` : "—"} label="Avg Intensity" color="#E74C3C" />
            <MiniStat icon="🧠" value={stats.topBodyArea !== "—" ? stats.topBodyArea : "Tracking"} label="Top Symptom" color="#2980B9" />
          </div>

          {/* Story cards */}
          <StoryCard
            icon="💪"
            title="Your Hardest Day"
            value={stats.hardestDay}
            sub={`${stats.hardestDayCount} flash${stats.hardestDayCount !== 1 ? "es" : ""} in one day — and you got through every single one.`}
            color="#E74C3C"
          />
          <StoryCard
            icon="😮‍💨"
            title="Your Easiest Day"
            value={stats.easiestDay}
            sub={`Only ${stats.easiestDayCount} flash${stats.easiestDayCount !== 1 ? "es" : ""} — your body gave you a break, and you noticed.`}
            color="#27AE60"
          />

          {/* Score trend */}
          {stats.scoreTrend.first > 0 && stats.scoreTrend.last > 0 && (
            <div style={{ ...s.trendCard, borderColor: stats.scoreTrend.improved ? "rgba(39,174,96,0.3)" : "rgba(255,255,255,0.1)" }}>
              <p style={s.gridLabel}>📊 YOUR FLASHYAF SCORE TREND</p>
              <div style={{ display: "flex", gap: "12px", alignItems: "center", marginTop: "10px" }}>
                <div style={{ flex: 1, textAlign: "center" as const }}>
                  <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "11px", fontWeight: 700, margin: "0 0 4px" }}>WEEK 1</p>
                  <p style={{ color: "#E74C3C", fontSize: "24px", fontWeight: 900, margin: 0 }}>{stats.scoreTrend.first}</p>
                  <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "11px", margin: 0 }}>avg intensity</p>
                </div>
                <div style={{ fontSize: "24px" }}>{stats.scoreTrend.improved ? "→📉" : "→"}</div>
                <div style={{ flex: 1, textAlign: "center" as const }}>
                  <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "11px", fontWeight: 700, margin: "0 0 4px" }}>LAST WEEK</p>
                  <p style={{ color: stats.scoreTrend.improved ? "#27AE60" : "#E74C3C", fontSize: "24px", fontWeight: 900, margin: 0 }}>{stats.scoreTrend.last}</p>
                  <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "11px", margin: 0 }}>avg intensity</p>
                </div>
              </div>
              {stats.scoreTrend.improved && (
                <p style={{ color: "#27AE60", fontSize: "13px", fontWeight: 700, margin: "12px 0 0", textAlign: "center" as const }}>
                  Your intensity has been trending down. That is progress. 💜
                </p>
              )}
            </div>
          )}

          {/* Badges */}
          {stats.badgesEarned.length > 0 && (
            <div style={s.badgesCard}>
              <p style={s.gridLabel}>🏅 BADGES EARNED</p>
              <div style={{ display: "flex", flexWrap: "wrap" as const, gap: "8px", marginTop: "10px" }}>
                {stats.badgesEarned.map((badge, i) => (
                  <div key={i} style={s.badgePill}>
                    <span style={{ fontSize: "13px" }}>{badge}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Next milestone teaser */}
          {milestone < 90 && (
            <div style={s.nextCard}>
              <p style={s.nextLabel}>⏭️ What's next?</p>
              <p style={s.nextText}>
                At {milestone === 30 ? "60" : "90"} days, a new time capsule will be waiting for you.
                Keep tracking — your future self will thank you for the data.
              </p>
            </div>
          )}

          {/* Actions */}
          <div style={s.actions}>
            <button style={{ ...s.shareBtn, background: shareCopied ? "rgba(26,188,156,0.2)" : "rgba(255,255,255,0.07)", border: shareCopied ? "1px solid rgba(26,188,156,0.4)" : "1px solid rgba(255,255,255,0.12)", color: shareCopied ? "#1ABC9C" : "#fff" }} onClick={handleShare}>
              {shareCopied ? "✓ Copied to clipboard!" : "📤 Share This Journey"}
            </button>

            {!sealed ? (
              <button
                style={{ ...s.sealBtn, background: `linear-gradient(135deg, ${milestoneColor}, ${milestoneColor}cc)`, opacity: sealing ? 0.7 : 1 }}
                onClick={handleSeal}
                disabled={sealing}
              >
                {sealing ? "Sealing…" : `🔒 Seal My ${milestoneLabel} Capsule`}
              </button>
            ) : (
              <div style={s.sealedBadge}>
                <span style={{ fontSize: "20px" }}>🔒</span>
                <p style={s.sealedText}>Capsule sealed. Revisit it anytime from your profile.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ icon, value, label, color }: { icon: string; value: string; label: string; color: string }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)", border: `1px solid ${color}25`,
      borderRadius: "14px", padding: "14px 12px",
      display: "flex", flexDirection: "column" as const, gap: "5px",
    }}>
      <span style={{ fontSize: "20px", lineHeight: 1 }}>{icon}</span>
      <p style={{ color, fontSize: "18px", fontWeight: 900, margin: 0, lineHeight: 1.1 }}>{value}</p>
      <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "11px", fontWeight: 600, margin: 0, lineHeight: 1.3 }}>{label}</p>
    </div>
  );
}

function StoryCard({ icon, title, value, sub, color }: { icon: string; title: string; value: string; sub: string; color: string }) {
  return (
    <div style={{
      background: `${color}08`, border: `1px solid ${color}25`,
      borderRadius: "16px", padding: "16px",
      display: "flex", gap: "14px", alignItems: "flex-start",
    }}>
      <div style={{
        width: "44px", height: "44px", borderRadius: "12px", flexShrink: 0,
        background: `${color}18`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "22px", lineHeight: 1,
      }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "11px", fontWeight: 800, textTransform: "uppercase" as const, letterSpacing: "0.8px", margin: "0 0 4px" }}>{title}</p>
        <p style={{ color, fontSize: "17px", fontWeight: 900, margin: "0 0 5px", lineHeight: 1.2 }}>{value}</p>
        <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "12px", lineHeight: 1.55, margin: 0 }}>{sub}</p>
      </div>
    </div>
  );
}

const styles = {
  backdrop: {
    position: "fixed" as const, inset: 0, zIndex: 500,
    background: "rgba(0,0,0,0.82)", backdropFilter: "blur(8px)",
    display: "flex", alignItems: "flex-end" as const, justifyContent: "center",
  },
  sheet: {
    width: "100%", maxWidth: "480px",
    maxHeight: "92dvh",
    background: "#0F0F0F",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "28px 28px 0 0",
    display: "flex", flexDirection: "column" as const,
    overflow: "hidden",
    boxShadow: "0 -20px 60px rgba(0,0,0,0.6)",
  },
  headerBand: {
    padding: "24px 20px 20px",
    display: "flex", flexDirection: "column" as const, alignItems: "center", gap: "8px",
    position: "relative" as const,
  },
  closeBtn: {
    position: "absolute" as const, top: "16px", right: "16px",
    background: "rgba(255,255,255,0.08)", border: "none",
    borderRadius: "100px", color: "rgba(255,255,255,0.5)",
    fontSize: "14px", fontWeight: 700, cursor: "pointer",
    width: "32px", height: "32px",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "'Inter', sans-serif",
  },
  capsuleIcon: {
    width: "72px", height: "72px", borderRadius: "50%",
    background: "rgba(255,255,255,0.05)", border: "2px solid rgba(255,255,255,0.1)",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  capsuleTitle: {
    fontSize: "14px", fontWeight: 900, margin: 0,
    letterSpacing: "2px", fontFamily: "'Inter', sans-serif",
  },
  capsuleDate: {
    color: "rgba(255,255,255,0.35)", fontSize: "12px", fontWeight: 600, margin: 0,
  },
  scrollArea: {
    flex: 1, overflowY: "auto" as const,
    padding: "16px 16px 32px",
    display: "flex", flexDirection: "column" as const, gap: "12px",
  },
  flashyCard: {
    background: "rgba(192,57,43,0.07)",
    border: "1px solid",
    borderRadius: "16px", padding: "16px",
    display: "flex", flexDirection: "column" as const, gap: "8px",
  },
  flashyLabel: {
    color: "rgba(255,255,255,0.35)", fontSize: "11px", fontWeight: 800,
    textTransform: "uppercase" as const, letterSpacing: "1px", margin: 0,
  },
  flashyMsg: {
    color: "rgba(255,255,255,0.88)", fontSize: "14px",
    lineHeight: 1.7, fontStyle: "italic", margin: 0, fontWeight: 500,
  },
  flashySig: {
    fontSize: "12px", fontWeight: 800, margin: 0,
  },
  gridLabel: {
    color: "rgba(255,255,255,0.3)", fontSize: "10px", fontWeight: 900,
    letterSpacing: "1.5px", textTransform: "uppercase" as const, margin: "4px 0 0",
  },
  statsGrid: {
    display: "grid", gridTemplateColumns: "1fr 1fr",
    gap: "10px",
  },
  trendCard: {
    background: "rgba(255,255,255,0.02)", border: "1px solid",
    borderRadius: "16px", padding: "16px",
    display: "flex", flexDirection: "column" as const, gap: "0px",
  },
  badgesCard: {
    background: "rgba(255,215,0,0.04)", border: "1px solid rgba(255,215,0,0.15)",
    borderRadius: "16px", padding: "16px",
  },
  badgePill: {
    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "100px", padding: "7px 14px",
    fontSize: "13px", fontWeight: 700, color: "#fff",
    fontFamily: "'Inter', sans-serif",
  },
  nextCard: {
    background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "14px", padding: "14px",
  },
  nextLabel: {
    color: "#fff", fontSize: "13px", fontWeight: 900, margin: "0 0 5px",
  },
  nextText: {
    color: "rgba(255,255,255,0.45)", fontSize: "13px", lineHeight: 1.6, margin: 0,
  },
  actions: {
    display: "flex", flexDirection: "column" as const, gap: "10px", marginTop: "8px",
  },
  shareBtn: {
    width: "100%", borderRadius: "14px",
    fontSize: "14px", fontWeight: 900,
    padding: "14px", cursor: "pointer",
    fontFamily: "'Inter', sans-serif",
    transition: "all 0.2s",
  },
  sealBtn: {
    width: "100%", border: "none", borderRadius: "14px",
    color: "#fff", fontSize: "14px", fontWeight: 900,
    padding: "16px", cursor: "pointer",
    fontFamily: "'Inter', sans-serif",
    boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
  },
  sealedBadge: {
    display: "flex", gap: "12px", alignItems: "center",
    background: "rgba(26,188,156,0.08)", border: "1px solid rgba(26,188,156,0.25)",
    borderRadius: "14px", padding: "14px",
  },
  sealedText: {
    color: "#1ABC9C", fontSize: "13px", fontWeight: 700,
    lineHeight: 1.5, margin: 0,
  },
};
