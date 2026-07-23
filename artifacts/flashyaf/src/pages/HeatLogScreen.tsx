import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";

interface Props {
  onNavigate: (screen: string) => void;
  /** If true, auto-opens the "Add Entry" panel on mount (e.g. from voice "take a note") */
  autoOpen?: boolean;
}

export type LogStage =
  | "STARTED"
  | "BLAZING"
  | "COOLING_DOWN"
  | "FLASH_ENDED"
  | "BACK_TO_NORMAL"
  | "OBSERVATION";

export interface HeatLogEntry {
  id: string;
  userId: string;
  date: string;       // "YYYY-MM-DD"
  time: string;       // "HH:MM"
  stage: LogStage;
  notes: string;
  createdAt: number;
}

const LS_KEY = "flashyaf_heat_log";

const STAGE_LABELS: Record<LogStage, string> = {
  STARTED:        "🌡 Started",
  BLAZING:        "🔥 Blazing",
  COOLING_DOWN:   "🌊 Cooling Down",
  FLASH_ENDED:    "✅ Flash Ended",
  BACK_TO_NORMAL: "😌 Back to Normal",
  OBSERVATION:    "📝 Observation",
};

const STAGE_COLORS: Record<LogStage, string> = {
  STARTED:        "#F5A623",
  BLAZING:        "#FF4500",
  COOLING_DOWN:   "#00BCD4",
  FLASH_ENDED:    "#1ABC9C",
  BACK_TO_NORMAL: "#8BC34A",
  OBSERVATION:    "#9B59B6",
};

function loadEntries(userId: string): HeatLogEntry[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const all: HeatLogEntry[] = JSON.parse(raw);
    return all.filter((e) => e.userId === userId).sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

function saveEntry(entry: HeatLogEntry) {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const all: HeatLogEntry[] = raw ? JSON.parse(raw) : [];
    all.push(entry);
    localStorage.setItem(LS_KEY, JSON.stringify(all));
  } catch {}
}

function deleteEntry(id: string) {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const all: HeatLogEntry[] = raw ? JSON.parse(raw) : [];
    localStorage.setItem(LS_KEY, JSON.stringify(all.filter((e) => e.id !== id)));
  } catch {}
}

function nowDate() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}
function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function formatDate(dateStr: string, timeStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h, min] = timeStr.split(":").map(Number);
  const dt = new Date(y, m - 1, d, h, min);
  return dt.toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function speakEntry(entry: HeatLogEntry) {
  if (!("speechSynthesis" in window)) return;
  const stageName = STAGE_LABELS[entry.stage].replace(/^[^\w]+/, "");
  const text = `${formatDate(entry.date, entry.time)}. Stage: ${stageName}. ${entry.notes ? "Note: " + entry.notes : "No notes."}`;
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.0; u.pitch = 1.1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

export default function HeatLogScreen({ onNavigate, autoOpen = false }: Props) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<HeatLogEntry[]>(() =>
    user ? loadEntries(user.uid) : []
  );
  const [showForm, setShowForm] = useState(autoOpen);
  const [stage, setStage] = useState<LogStage>("OBSERVATION");
  const [date, setDate] = useState(nowDate);
  const [time, setTime] = useState(nowTime);
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (user) setEntries(loadEntries(user.uid));
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  function openForm() {
    setDate(nowDate());
    setTime(nowTime());
    setStage("OBSERVATION");
    setNotes("");
    setSaved(false);
    setShowForm(true);
  }

  function handleSave() {
    if (!user) return;
    const entry: HeatLogEntry = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      userId: user.uid,
      date,
      time,
      stage,
      notes: notes.trim(),
      createdAt: Date.now(),
    };
    saveEntry(entry);
    refresh();
    setSaved(true);
    setTimeout(() => { setShowForm(false); setSaved(false); }, 1200);
  }

  function handleDelete(id: string) {
    deleteEntry(id);
    refresh();
    setConfirmDeleteId(null);
  }

  function handleSpeak(entry: HeatLogEntry) {
    setSpeakingId(entry.id);
    speakEntry(entry);
    const len = Math.min(3000, 1000 + entry.notes.length * 60);
    setTimeout(() => setSpeakingId(null), len);
  }

  const grouped: Record<string, HeatLogEntry[]> = {};
  for (const e of entries) {
    if (!grouped[e.date]) grouped[e.date] = [];
    grouped[e.date].push(e);
  }
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div style={s.root}>
      {/* ── Header ── */}
      <div style={s.header}>
        <button style={s.backBtn} onClick={() => onNavigate("home")}>← Back</button>
        <div style={s.headerCenter}>
          <p style={s.appName}>FLASHYAF™</p>
          <p style={s.headerTitle}>My Heat Log &amp; Journal</p>
        </div>
        <button style={s.addBtn} onClick={openForm} title="New entry">＋</button>
      </div>

      {/* ── Privacy badge ── */}
      <div style={s.privacyBanner}>
        <span style={s.lockIcon}>🔒</span>
        <span style={s.privacyText}>Stored only on this device · Never uploaded</span>
      </div>

      <div style={s.content}>
        {/* ── Add entry form ── */}
        {showForm && (
          <div style={s.formCard}>
            <p style={s.formTitle}>New Journal Entry</p>

            {/* Date + Time row */}
            <div style={s.rowTwo}>
              <div style={s.fieldGroup}>
                <label style={s.label}>Date</label>
                <input
                  style={s.input}
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div style={s.fieldGroup}>
                <label style={s.label}>Time</label>
                <input
                  style={s.input}
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </div>
            </div>

            {/* Stage */}
            <div style={s.fieldGroup}>
              <label style={s.label}>Stage</label>
              <select
                style={s.select}
                value={stage}
                onChange={(e) => setStage(e.target.value as LogStage)}
              >
                {(Object.keys(STAGE_LABELS) as LogStage[]).map((k) => (
                  <option key={k} value={k}>{STAGE_LABELS[k]}</option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div style={s.fieldGroup}>
              <label style={s.label}>Notes <span style={s.optional}>(optional)</span></label>
              <textarea
                style={s.textarea}
                placeholder="How are you feeling? What's happening in your body?"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
            </div>

            <div style={s.formActions}>
              <button style={s.cancelBtn} onClick={() => setShowForm(false)}>Cancel</button>
              <button
                style={{ ...s.saveBtn, background: saved ? "#1ABC9C" : "linear-gradient(135deg,#C0392B,#FF4500)" }}
                onClick={handleSave}
                disabled={saved}
              >
                {saved ? "✓ Saved!" : "Save Entry"}
              </button>
            </div>
          </div>
        )}

        {/* ── Empty state ── */}
        {entries.length === 0 && !showForm && (
          <div style={s.emptyCard}>
            <p style={s.emptyIcon}>📓</p>
            <p style={s.emptyTitle}>No entries yet</p>
            <p style={s.emptyBody}>Tap + or say "Hey Flashy, take a note" to start your private heat journal.</p>
            <button style={s.emptyBtn} onClick={openForm}>Add First Entry</button>
          </div>
        )}

        {/* ── Entry list grouped by date ── */}
        {sortedDates.map((d) => (
          <div key={d}>
            <p style={s.dateLabel}>{new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
            {grouped[d].map((entry) => (
              <div key={entry.id} style={s.entryCard}>
                {/* Top row: time + stage badge */}
                <div style={s.entryTop}>
                  <span style={s.entryTime}>{entry.time}</span>
                  <span style={{
                    ...s.stageBadge,
                    background: STAGE_COLORS[entry.stage] + "22",
                    color: STAGE_COLORS[entry.stage],
                    borderColor: STAGE_COLORS[entry.stage] + "55",
                  }}>
                    {STAGE_LABELS[entry.stage]}
                  </span>
                  <div style={s.entryActions}>
                    {/* TTS playback */}
                    <button
                      style={{
                        ...s.iconBtn,
                        background: speakingId === entry.id ? "rgba(26,188,156,0.2)" : "rgba(255,255,255,0.07)",
                        border: speakingId === entry.id ? "1px solid rgba(26,188,156,0.5)" : "1px solid rgba(255,255,255,0.1)",
                      }}
                      onClick={() => handleSpeak(entry)}
                      title="Read aloud"
                    >
                      {speakingId === entry.id ? "🔊" : "▶"}
                    </button>
                    {/* Delete */}
                    {confirmDeleteId === entry.id ? (
                      <>
                        <button style={{ ...s.iconBtn, background: "rgba(231,76,60,0.25)", border: "1px solid rgba(231,76,60,0.5)", color: "#E74C3C" }} onClick={() => handleDelete(entry.id)}>✓ Delete</button>
                        <button style={s.iconBtn} onClick={() => setConfirmDeleteId(null)}>✕</button>
                      </>
                    ) : (
                      <button style={s.iconBtn} onClick={() => setConfirmDeleteId(entry.id)} title="Delete entry">🗑</button>
                    )}
                  </div>
                </div>

                {/* Notes */}
                {entry.notes ? (
                  <p style={s.entryNotes}>{entry.notes}</p>
                ) : (
                  <p style={s.entryNoNotes}>No notes</p>
                )}
              </div>
            ))}
          </div>
        ))}

        {/* Bottom nav spacer */}
        <div style={{ height: "40px" }} />
      </div>

      {/* ── Bottom Nav ── */}
      <div style={s.bottomNav}>
        {[
          { label: "Home", icon: "🏠", screen: "home" },
          { label: "History", icon: "📊", screen: "history" },
          { label: "Log", icon: "📓", screen: "heat-log" },
          { label: "Community", icon: "💬", screen: "community" },
          { label: "Settings", icon: "⚙️", screen: "settings" },
        ].map((item) => (
          <button
            key={item.screen}
            style={{
              ...s.navItem,
              color: item.screen === "heat-log" ? "var(--color-accent)" : "rgba(255,255,255,0.4)",
            }}
            onClick={() => onNavigate(item.screen)}
          >
            <span style={s.navIcon}>{item.icon}</span>
            <span style={s.navLabel}>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh",
    background: "#05070B",
    display: "flex", flexDirection: "column",
    maxWidth: "480px", margin: "0 auto",
    fontFamily: "'Inter', sans-serif",
    color: "#fff",
    position: "relative",
  },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "16px 16px 12px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    background: "#05070B",
    position: "sticky" as const, top: 0, zIndex: 50,
  },
  backBtn: {
    background: "transparent", border: "none",
    color: "rgba(255,255,255,0.55)", fontSize: "15px",
    fontWeight: 600, cursor: "pointer",
    fontFamily: "'Inter', sans-serif", minWidth: "60px",
  },
  headerCenter: { textAlign: "center" },
  appName: {
    color: "var(--color-accent)", fontSize: "10px",
    fontWeight: 900, letterSpacing: "2px", margin: 0,
  },
  headerTitle: {
    color: "#fff", fontSize: "16px", fontWeight: 800, margin: 0,
  },
  addBtn: {
    background: "linear-gradient(135deg,#C0392B,#FF4500)",
    border: "none", borderRadius: "50%",
    width: "34px", height: "34px",
    color: "#fff", fontSize: "20px", lineHeight: 1,
    cursor: "pointer", fontFamily: "'Inter', sans-serif",
    display: "flex", alignItems: "center", justifyContent: "center",
    boxShadow: "0 0 12px rgba(192,57,43,0.4)",
  },
  privacyBanner: {
    display: "flex", alignItems: "center", gap: "8px",
    background: "linear-gradient(90deg, rgba(11,31,58,0.9), rgba(5,7,11,0.0))",
    padding: "10px 18px",
    borderBottom: "1px solid rgba(255,255,255,0.04)",
  },
  lockIcon: { fontSize: "13px" },
  privacyText: {
    color: "rgba(255,255,255,0.35)", fontSize: "11px", fontWeight: 600, margin: 0,
    letterSpacing: "0.3px",
  },
  content: {
    flex: 1, padding: "16px 14px",
    display: "flex", flexDirection: "column", gap: "10px",
    overflowY: "auto",
    paddingBottom: "90px",
  },

  // ── Form ──
  formCard: {
    background: "linear-gradient(160deg, #0B1F3A 0%, #0D0D14 100%)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "18px", padding: "20px 18px",
    display: "flex", flexDirection: "column", gap: "14px",
    boxShadow: "0 8px 40px rgba(0,0,0,0.4)",
  },
  formTitle: {
    color: "#fff", fontSize: "16px", fontWeight: 800, margin: 0,
    letterSpacing: "0.3px",
  },
  rowTwo: { display: "flex", gap: "10px" },
  fieldGroup: { display: "flex", flexDirection: "column", gap: "5px", flex: 1 },
  label: {
    color: "rgba(255,255,255,0.45)", fontSize: "10px",
    fontWeight: 700, textTransform: "uppercase" as const,
    letterSpacing: "0.8px",
  },
  optional: { fontWeight: 400, textTransform: "none" as const },
  input: {
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: "10px", padding: "10px 12px",
    color: "#fff", fontSize: "14px",
    fontFamily: "'Inter', sans-serif",
    colorScheme: "dark" as const,
    width: "100%", boxSizing: "border-box" as const,
  },
  select: {
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: "10px", padding: "10px 12px",
    color: "#fff", fontSize: "14px",
    fontFamily: "'Inter', sans-serif",
    colorScheme: "dark" as const,
    width: "100%", boxSizing: "border-box" as const,
    cursor: "pointer",
  },
  textarea: {
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: "10px", padding: "10px 12px",
    color: "#fff", fontSize: "14px",
    fontFamily: "'Inter', sans-serif",
    resize: "vertical" as const,
    width: "100%", boxSizing: "border-box" as const,
    lineHeight: 1.5,
  },
  formActions: { display: "flex", gap: "10px", justifyContent: "flex-end" },
  cancelBtn: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "100px", color: "rgba(255,255,255,0.5)",
    fontSize: "14px", fontWeight: 700,
    padding: "11px 22px", cursor: "pointer",
    fontFamily: "'Inter', sans-serif",
  },
  saveBtn: {
    border: "none", borderRadius: "100px",
    color: "#fff", fontSize: "14px", fontWeight: 800,
    padding: "11px 26px", cursor: "pointer",
    fontFamily: "'Inter', sans-serif",
    boxShadow: "0 0 20px rgba(192,57,43,0.35)",
    transition: "background 0.3s ease",
  },

  // ── Empty state ──
  emptyCard: {
    background: "rgba(11,31,58,0.5)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: "18px", padding: "40px 24px",
    textAlign: "center",
    display: "flex", flexDirection: "column", alignItems: "center", gap: "10px",
  },
  emptyIcon: { fontSize: "44px", margin: 0 },
  emptyTitle: { color: "#fff", fontSize: "18px", fontWeight: 800, margin: 0 },
  emptyBody: { color: "rgba(255,255,255,0.4)", fontSize: "13px", lineHeight: 1.6, margin: 0 },
  emptyBtn: {
    marginTop: "8px",
    background: "linear-gradient(135deg,#C0392B,#FF4500)",
    border: "none", borderRadius: "100px",
    color: "#fff", fontSize: "15px", fontWeight: 700,
    padding: "13px 30px", cursor: "pointer",
    fontFamily: "'Inter', sans-serif",
    boxShadow: "0 0 20px rgba(192,57,43,0.35)",
  },

  // ── Entry list ──
  dateLabel: {
    color: "rgba(255,255,255,0.25)", fontSize: "11px",
    fontWeight: 700, textTransform: "uppercase" as const,
    letterSpacing: "1px", margin: "8px 4px 4px",
  },
  entryCard: {
    background: "linear-gradient(150deg, #0B1F3A 0%, #0D0D18 100%)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: "14px", padding: "14px 14px",
    display: "flex", flexDirection: "column", gap: "8px",
  },
  entryTop: {
    display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" as const,
  },
  entryTime: {
    color: "rgba(255,255,255,0.55)", fontSize: "12px", fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
  },
  stageBadge: {
    fontSize: "11px", fontWeight: 700,
    padding: "3px 10px", borderRadius: "100px",
    border: "1px solid",
    flexShrink: 0,
  },
  entryActions: {
    display: "flex", gap: "6px", marginLeft: "auto", flexShrink: 0,
  },
  iconBtn: {
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "100px", color: "rgba(255,255,255,0.55)",
    fontSize: "12px", fontWeight: 700,
    padding: "4px 10px", cursor: "pointer",
    fontFamily: "'Inter', sans-serif",
    transition: "background 0.2s",
  },
  entryNotes: {
    color: "rgba(255,255,255,0.7)", fontSize: "14px", lineHeight: 1.6,
    margin: 0, whiteSpace: "pre-wrap" as const,
  },
  entryNoNotes: {
    color: "rgba(255,255,255,0.2)", fontSize: "12px",
    fontStyle: "italic", margin: 0,
  },

  // ── Bottom Nav ──
  bottomNav: {
    position: "fixed" as const, bottom: 0, left: "50%",
    transform: "translateX(-50%)",
    width: "100%", maxWidth: "480px",
    display: "flex", justifyContent: "space-around",
    background: "rgba(5,7,11,0.97)",
    borderTop: "1px solid rgba(255,255,255,0.08)",
    padding: "8px 0 env(safe-area-inset-bottom, 8px)",
    zIndex: 100,
  },
  navItem: {
    display: "flex", flexDirection: "column", alignItems: "center", gap: "3px",
    background: "none", border: "none", cursor: "pointer",
    fontFamily: "'Inter', sans-serif", padding: "6px 12px",
    transition: "color 0.2s",
  },
  navIcon: { fontSize: "18px" },
  navLabel: { fontSize: "9px", fontWeight: 700, letterSpacing: "0.5px" },
};
