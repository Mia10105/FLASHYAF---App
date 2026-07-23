import { useEffect, useState, useRef } from "react";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Flash, Stage } from "@/types/flash";
import VoiceJournalModal from "@/components/VoiceJournalModal";

interface Props {
  flash: Flash;
  onLogAnother: () => void;
  onSeeHistory: () => void;
  onGoHome: () => void;
}

const STAGE_LABELS: Record<Stage, string> = {
  STARTED: "Flash Started",
  PEAK: "Peak",
  COOLING_DOWN: "Cooling Down",
  FLASH_ENDED: "Flash Ended",
  BACK_TO_NORMAL: "Back To Normal",
};

const STAGE_COLORS: Record<Stage, string> = {
  STARTED: "#FF0000",
  PEAK: "#FF6B35",
  COOLING_DOWN: "#2E86AB",
  FLASH_ENDED: "#26A69A",
  BACK_TO_NORMAL: "#87CEEB",
};

function formatAgo(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function SummaryScreen({ flash, onLogAnother, onSeeHistory, onGoHome }: Props) {
  const min = Math.floor(flash.durationSeconds / 60);
  const sec = flash.durationSeconds % 60;
  const autoNavRef = useRef(true);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [voiceNoteSaved, setVoiceNoteSaved] = useState(false);
  const [prevFlashAgo, setPrevFlashAgo] = useState<string | null>(null);

  useEffect(() => {
    if (!flash.userId) return;
    getDocs(
      query(
        collection(db, "flashes"),
        where("userId", "==", flash.userId),
        orderBy("startTime", "desc"),
        limit(2),
      )
    ).then((snap) => {
      const docs = snap.docs.filter((d) => d.id !== flash.id);
      if (docs.length > 0) {
        const prev = docs[0].data() as { startTime: number };
        setPrevFlashAgo(formatAgo(prev.startTime));
      }
    }).catch(() => {});
  }, [flash.id, flash.userId]);

  

  function handleLogAnother() { autoNavRef.current = false; onLogAnother(); }
  function handleSeeHistory() { autoNavRef.current = false; onSeeHistory(); }
  function handleVoiceNote() { autoNavRef.current = false; setShowVoiceModal(true); }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.checkmark}>✓</div>
        <h1 style={styles.title}>Flash logged!</h1>
        <p style={styles.subtitle}>You made it through. Again.</p>

        <div style={styles.autoReturnBanner}>
          <span style={styles.autoReturnText}>
            Flash logged and saved ✓
          </span>
        </div>

        <div style={styles.durationBox}>
          <p style={styles.durationLabel}>Duration</p>
          <p style={styles.durationValue}>{min}m {sec}s</p>
          {prevFlashAgo && (
            <p style={styles.prevFlashLine}>⏱ Previous flash: {prevFlashAgo}</p>
          )}
          {flash.peakRating && flash.peakRating > 0 && (
            <p style={styles.peakRatingLine}>
              Peak intensity: {"★".repeat(flash.peakRating)}{"☆".repeat(5 - flash.peakRating)}
            </p>
          )}
          {flash.bodyAreas && flash.bodyAreas.length > 0 && (
            <p style={styles.bodyAreasLine}>
              📍 {flash.bodyAreas.map((a) => ({
                face: "Face/Head", neck: "Neck", chest: "Chest",
                back: "Back", arms: "Arms", lower: "Lower Body",
              } as Record<string, string>)[a] || a).join(", ")}
            </p>
          )}
        </div>

        <div style={styles.stagesBox}>
          <p style={styles.stagesTitle}>Stage Breakdown</p>
          {flash.stages.map((s, i) => (
            <div key={i} style={styles.stageRow}>
              <div style={{ ...styles.stageDot, background: STAGE_COLORS[s.stage] }} />
              <div style={styles.stageInfo}>
                <span style={styles.stageName}>{STAGE_LABELS[s.stage]}</span>
                <span style={styles.stageTime}>
                  {new Date(s.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Voice Journal */}
        {flash.id && !voiceNoteSaved && (
          <button style={styles.voiceNoteBtn} onClick={handleVoiceNote}>
            <span>🎙️</span>
            <div style={styles.voiceNoteBtnText}>
              <span style={styles.voiceNoteBtnTitle}>Record a Voice Note</span>
              <span style={styles.voiceNoteBtnSub}>Capture how you're feeling right now</span>
            </div>
            <span style={styles.voiceNoteBtnArrow}>›</span>
          </button>
        )}
        {voiceNoteSaved && (
          <div style={styles.voiceSavedBadge}>
            <span>🎙️</span>
            <span style={styles.voiceSavedText}>Voice note saved ✓</span>
          </div>
        )}

        <button style={styles.primaryBtn} onClick={() => { autoNavRef.current = false; onGoHome(); }}>Go Home</button>
        <button style={styles.secondaryBtn} onClick={handleSeeHistory}>See History</button>
      </div>

      {showVoiceModal && flash.id && (
        <VoiceJournalModal
          flashId={flash.id}
          userId={flash.userId}
          onClose={() => setShowVoiceModal(false)}
          onSaved={() => { setVoiceNoteSaved(true); setShowVoiceModal(false); }}
        />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh", background: "var(--color-bg)",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: "20px", fontFamily: "'Inter', sans-serif",
  },
  card: {
    background: "var(--color-card)", backdropFilter: "blur(12px)",
    border: "1px solid rgba(255,255,255,0.12)", borderRadius: "24px",
    padding: "32px 24px", width: "100%", maxWidth: "440px", textAlign: "center",
  },
  checkmark: {
    width: "60px", height: "60px", background: "#87CEEB", borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "26px", color: "#0A0A0A", fontWeight: 900, margin: "0 auto 16px",
  },
  title: { color: "var(--color-text)", fontSize: "26px", fontWeight: 900, margin: "0 0 4px" },
  subtitle: { color: "var(--color-text-muted)", fontSize: "14px", margin: "0 0 16px" },
  autoReturnBanner: {
    background: "rgba(135,206,235,0.12)", border: "1px solid rgba(135,206,235,0.3)",
    borderRadius: "10px", padding: "8px 16px", marginBottom: "20px",
  },
  autoReturnText: { color: "#87CEEB", fontSize: "13px", fontWeight: 600 },
  durationBox: { background: "rgba(255,255,255,0.05)", borderRadius: "14px", padding: "16px", marginBottom: "16px" },
  durationLabel: { color: "var(--color-text-muted)", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", margin: "0 0 4px" },
  durationValue: { color: "var(--color-text)", fontSize: "32px", fontWeight: 900, margin: "0 0 4px" },
  prevFlashLine: { color: "rgba(255,255,255,0.6)", fontSize: "12px", fontWeight: 500, margin: "0 0 6px" },
  peakRatingLine: { color: "#FF6B35", fontSize: "13px", fontWeight: 600, margin: "0 0 4px" },
  bodyAreasLine: { color: "rgba(255,255,255,0.45)", fontSize: "12px", fontWeight: 500, margin: "4px 0 0" },
  stagesBox: { background: "rgba(255,255,255,0.04)", borderRadius: "14px", padding: "14px 18px", marginBottom: "16px", textAlign: "left" },
  stagesTitle: { color: "var(--color-text-muted)", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", margin: "0 0 10px" },
  stageRow: { display: "flex", alignItems: "center", gap: "10px", padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" },
  stageDot: { width: "9px", height: "9px", borderRadius: "50%", flexShrink: 0 },
  stageInfo: { flex: 1, display: "flex", justifyContent: "space-between", alignItems: "center" },
  stageName: { color: "var(--color-text)", fontSize: "13px", fontWeight: 600 },
  stageTime: { color: "var(--color-text-muted)", fontSize: "11px" },
  voiceNoteBtn: {
    display: "flex", alignItems: "center", gap: "12px",
    width: "100%", background: "rgba(192,57,43,0.1)",
    border: "1px solid rgba(192,57,43,0.3)", borderRadius: "14px",
    padding: "14px 16px", cursor: "pointer", marginBottom: "14px",
    textAlign: "left", fontFamily: "'Inter', sans-serif",
    fontSize: "22px",
  },
  voiceNoteBtnText: { flex: 1, display: "flex", flexDirection: "column", gap: "2px" },
  voiceNoteBtnTitle: { color: "#fff", fontSize: "14px", fontWeight: 700 },
  voiceNoteBtnSub: { color: "rgba(255,255,255,0.4)", fontSize: "11px", fontWeight: 500 },
  voiceNoteBtnArrow: { color: "rgba(255,255,255,0.3)", fontSize: "20px" },
  voiceSavedBadge: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
    background: "rgba(26,188,156,0.1)", border: "1px solid rgba(26,188,156,0.25)",
    borderRadius: "12px", padding: "10px 16px", marginBottom: "14px",
  },
  voiceSavedText: { color: "#1ABC9C", fontSize: "13px", fontWeight: 700 },
  primaryBtn: {
    background: "var(--color-primary)", border: "none", borderRadius: "12px",
    color: "var(--color-text)", fontSize: "15px", fontWeight: 700,
    padding: "14px", cursor: "pointer", width: "100%", marginBottom: "10px",
    fontFamily: "'Inter', sans-serif",
  },
  secondaryBtn: {
    background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: "12px", color: "var(--color-text)", fontSize: "15px", fontWeight: 600,
    padding: "14px", cursor: "pointer", width: "100%", marginBottom: "8px",
    fontFamily: "'Inter', sans-serif",
  },
  homeBtn: {
    background: "transparent", border: "none", color: "var(--color-text-muted)",
    fontSize: "13px", fontWeight: 600, padding: "8px", cursor: "pointer",
    width: "100%", textDecoration: "underline", fontFamily: "'Inter', sans-serif",
  },
};
