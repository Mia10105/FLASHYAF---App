import { useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

interface Props {
  onComplete: () => void;
}

const DURATIONS = [
  { label: "Just Started", sub: "Less than 3 months", icon: "🌱" },
  { label: "3–6 Months", sub: "Getting the hang of it", icon: "⏱️" },
  { label: "6–12 Months", sub: "You've been here a while", icon: "📅" },
  { label: "Over a Year", sub: "A seasoned veteran", icon: "🏆" },
];

const SYMPTOMS = [
  { label: "Hot Flashes", icon: "🔥" },
  { label: "Night Sweats", icon: "🌙" },
  { label: "Mood Changes", icon: "😤" },
  { label: "Sleep Issues", icon: "😴" },
  { label: "Brain Fog", icon: "🧠" },
  { label: "All of the Above", icon: "✅" },
];

const SUPPORT_STYLES = [
  { label: "Humor", icon: "😂", desc: "Make me laugh through it" },
  { label: "Encouragement", icon: "💪", desc: "Cheer me on" },
  { label: "Calm", icon: "🌊", desc: "Keep it peaceful" },
  { label: "Mix It Up", icon: "🎲", desc: "Surprise me" },
];

export default function OnboardingScreen({ onComplete }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [opacity, setOpacity] = useState(1);
  const [saving, setSaving] = useState(false);

  // Answers
  const [symptomDuration, setSymptomDuration] = useState("");
  const [mainSymptoms, setMainSymptoms] = useState<string[]>([]);
  const [supportStyle, setSupportStyle] = useState("");

  function fadeToStep(next: number) {
    setOpacity(0);
    setTimeout(() => { setStep(next); setOpacity(1); }, 180);
  }

  function toggleSymptom(label: string) {
    if (label === "All of the Above") {
      setMainSymptoms(["All of the Above"]);
      return;
    }
    setMainSymptoms((prev) => {
      const withoutAll = prev.filter((s) => s !== "All of the Above");
      if (withoutAll.includes(label)) return withoutAll.filter((s) => s !== label);
      return [...withoutAll, label];
    });
  }

  async function handleFinish() {
    if (!user || saving) return;
    setSaving(true);
    try {
      await setDoc(doc(db, "users", user.uid), {
        onboardingComplete: true,
        onboardingCompletedAt: Date.now(),
        symptomDuration,
        mainSymptoms,
        supportStyle,
        referralCode: user.uid.slice(0, 8).toUpperCase(),
        referralCount: 0,
      }, { merge: true });
    } catch { /* silent */ }
    setSaving(false);
    onComplete();
  }

  const canNext2 = symptomDuration !== "";
  const canNext3 = mainSymptoms.length > 0;
  const canNext4 = supportStyle !== "";

  return (
    <div style={styles.container}>
      {/* Skip X button — top right */}
      <button
        style={styles.skipBtn}
        onClick={onComplete}
        aria-label="Skip onboarding"
      >
        ✕
      </button>

      {/* Progress dots */}
      <div style={styles.progressRow}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            style={{
              ...styles.dot,
              background: i <= step ? "var(--color-primary)" : "rgba(255,255,255,0.18)",
              transform: i === step ? "scale(1.4)" : "scale(1)",
            }}
          />
        ))}
      </div>

      {/* Animated content */}
      <div style={{ ...styles.content, opacity, transition: "opacity 0.18s ease" }}>

        {/* ── Step 1: Welcome ── */}
        {step === 1 && (
          <div style={styles.stepWrap}>
            <div style={styles.bigEmoji}>🧠</div>
            <p style={styles.welcomeTo}>WELCOME TO</p>
            <h1 style={styles.appTitle}>FLASHYAF™</h1>
            <p style={styles.tagline}>Your hot flash. Your data. Your power.</p>
            <p style={styles.welcomeBody}>
              We're going to ask you a few quick questions to personalize your experience. Takes about 30 seconds.
            </p>
            <button style={styles.primaryBtn} onClick={() => fadeToStep(2)}>
              Let's Go →
            </button>
          </div>
        )}

        {/* ── Step 2: Duration ── */}
        {step === 2 && (
          <div style={styles.stepWrap}>
            <p style={styles.stepNum}>Step 1 of 3</p>
            <h2 style={styles.stepTitle}>How long have you been experiencing symptoms?</h2>
            <div style={styles.optionList}>
              {DURATIONS.map((d) => (
                <button
                  key={d.label}
                  style={{
                    ...styles.optionCard,
                    border: symptomDuration === d.label
                      ? "2px solid var(--color-primary)"
                      : "1px solid rgba(255,255,255,0.12)",
                    background: symptomDuration === d.label
                      ? "rgba(192,57,43,0.18)"
                      : "var(--color-card)",
                  }}
                  onClick={() => setSymptomDuration(d.label)}
                >
                  <span style={styles.optionIcon}>{d.icon}</span>
                  <div style={styles.optionText}>
                    <span style={styles.optionLabel}>{d.label}</span>
                    <span style={styles.optionSub}>{d.sub}</span>
                  </div>
                  <div style={{
                    ...styles.optionRadio,
                    background: symptomDuration === d.label ? "var(--color-primary)" : "transparent",
                    border: symptomDuration === d.label ? "2px solid var(--color-primary)" : "2px solid rgba(255,255,255,0.3)",
                  }}>
                    {symptomDuration === d.label && <span style={styles.radioDot} />}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 3: Symptoms ── */}
        {step === 3 && (
          <div style={styles.stepWrap}>
            <p style={styles.stepNum}>Step 2 of 3</p>
            <h2 style={styles.stepTitle}>What bothers you most?</h2>
            <p style={styles.stepSub}>Select all that apply.</p>
            <div style={styles.optionList}>
              {SYMPTOMS.map((s) => {
                const checked = mainSymptoms.includes(s.label);
                return (
                  <button
                    key={s.label}
                    style={{
                      ...styles.optionCard,
                      border: checked
                        ? "2px solid var(--color-primary)"
                        : "1px solid rgba(255,255,255,0.12)",
                      background: checked
                        ? "rgba(192,57,43,0.18)"
                        : "var(--color-card)",
                    }}
                    onClick={() => toggleSymptom(s.label)}
                  >
                    <span style={styles.optionIcon}>{s.icon}</span>
                    <div style={styles.optionText}>
                      <span style={styles.optionLabel}>{s.label}</span>
                    </div>
                    <div style={{
                      ...styles.optionCheckbox,
                      background: checked ? "var(--color-primary)" : "transparent",
                      border: checked ? "2px solid var(--color-primary)" : "2px solid rgba(255,255,255,0.3)",
                    }}>
                      {checked && <span style={styles.checkMark}>✓</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Step 4: Support style ── */}
        {step === 4 && (
          <div style={styles.stepWrap}>
            <p style={styles.stepNum}>Step 3 of 3</p>
            <h2 style={styles.stepTitle}>How do you like to be supported?</h2>
            <p style={styles.stepSub}>This shapes how we talk to you during a flash.</p>
            <div style={styles.optionList}>
              {SUPPORT_STYLES.map((s) => (
                <button
                  key={s.label}
                  style={{
                    ...styles.optionCard,
                    border: supportStyle === s.label
                      ? "2px solid var(--color-primary)"
                      : "1px solid rgba(255,255,255,0.12)",
                    background: supportStyle === s.label
                      ? "rgba(192,57,43,0.18)"
                      : "var(--color-card)",
                  }}
                  onClick={() => setSupportStyle(s.label)}
                >
                  <span style={styles.optionIcon}>{s.icon}</span>
                  <div style={styles.optionText}>
                    <span style={styles.optionLabel}>{s.label}</span>
                    <span style={styles.optionSub}>{s.desc}</span>
                  </div>
                  <div style={{
                    ...styles.optionRadio,
                    background: supportStyle === s.label ? "var(--color-primary)" : "transparent",
                    border: supportStyle === s.label ? "2px solid var(--color-primary)" : "2px solid rgba(255,255,255,0.3)",
                  }}>
                    {supportStyle === s.label && <span style={styles.radioDot} />}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 5: All set! ── */}
        {step === 5 && (
          <div style={styles.stepWrap}>
            <div style={styles.successCircle}>✓</div>
            <h2 style={styles.successTitle}>You're all set!</h2>
            <p style={styles.successSub}>We've got you covered. Let's track those flashes.</p>

            <div style={styles.summaryCard}>
              <SummaryRow icon="⏱️" label="Symptoms since" value={symptomDuration} />
              <SummaryRow
                icon="🔥"
                label="Main concerns"
                value={mainSymptoms.length === 0 ? "—" : mainSymptoms.join(", ")}
              />
              <SummaryRow icon="💬" label="Support style" value={supportStyle} />
            </div>

            <p style={styles.privacyNote}>
              Your answers are private and stored securely. You can update them anytime in Settings.
            </p>

            <button
              style={{ ...styles.primaryBtn, opacity: saving ? 0.6 : 1 }}
              onClick={handleFinish}
              disabled={saving}
            >
              {saving ? "Saving..." : "Start Tracking 🧠"}
            </button>
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <div style={styles.bottomNav}>
        {step > 1 && step < 5 && !saving && (
          <button style={styles.backBtn} onClick={() => fadeToStep(step - 1)}>
            ← Back
          </button>
        )}
        {step === 2 && (
          <button
            style={{ ...styles.nextBtn, opacity: canNext2 ? 1 : 0.35, marginLeft: "auto" }}
            onClick={() => canNext2 && fadeToStep(3)}
            disabled={!canNext2}
          >
            Next →
          </button>
        )}
        {step === 3 && (
          <button
            style={{ ...styles.nextBtn, opacity: canNext3 ? 1 : 0.35, marginLeft: "auto" }}
            onClick={() => canNext3 && fadeToStep(4)}
            disabled={!canNext3}
          >
            Next →
          </button>
        )}
        {step === 4 && (
          <button
            style={{ ...styles.nextBtn, opacity: canNext4 ? 1 : 0.35, marginLeft: "auto" }}
            onClick={() => canNext4 && fadeToStep(5)}
            disabled={!canNext4}
          >
            Review →
          </button>
        )}
      </div>
    </div>
  );
}

function SummaryRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={summaryRowStyle}>
      <span style={summaryIcon}>{icon}</span>
      <div style={summaryText}>
        <span style={summaryLabel}>{label}</span>
        <span style={summaryValue}>{value}</span>
      </div>
    </div>
  );
}

const summaryRowStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: "12px",
  padding: "11px 0", borderBottom: "1px solid rgba(255,255,255,0.06)",
};
const summaryIcon: React.CSSProperties = { fontSize: "18px", flexShrink: 0, width: "24px", textAlign: "center" };
const summaryText: React.CSSProperties = { display: "flex", flexDirection: "column", gap: "1px", flex: 1 };
const summaryLabel: React.CSSProperties = { color: "rgba(255,255,255,0.45)", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" };
const summaryValue: React.CSSProperties = { color: "var(--color-text)", fontSize: "13px", fontWeight: 700 };

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    maxWidth: "480px",
    margin: "0 auto",
    background: "var(--color-bg)",
    display: "flex",
    flexDirection: "column",
    fontFamily: "'Inter', sans-serif",
    position: "relative",
  },
  progressRow: {
    display: "flex",
    gap: "8px",
    justifyContent: "center",
    padding: "28px 24px 0",
    flexShrink: 0,
  },
  dot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    transition: "all 0.3s ease",
  },
  content: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflowY: "auto",
  },
  stepWrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "24px 20px 16px",
    flex: 1,
  },

  // Step 1 — Welcome
  bigEmoji: {
    fontSize: "72px",
    marginBottom: "16px",
    lineHeight: 1,
    animation: "pulse 2.5s infinite",
  },
  welcomeTo: {
    color: "rgba(255,255,255,0.45)",
    fontSize: "11px",
    fontWeight: 800,
    letterSpacing: "3px",
    margin: "0 0 4px",
    textTransform: "uppercase",
  },
  appTitle: {
    color: "var(--color-accent)",
    fontSize: "36px",
    fontWeight: 900,
    margin: "0 0 12px",
    letterSpacing: "2px",
  },
  tagline: {
    color: "var(--color-text)",
    fontSize: "15px",
    fontWeight: 600,
    textAlign: "center",
    margin: "0 0 20px",
    lineHeight: 1.5,
  },
  welcomeBody: {
    color: "var(--color-text-muted)",
    fontSize: "14px",
    textAlign: "center",
    lineHeight: 1.6,
    margin: "0 0 36px",
    maxWidth: "320px",
  },

  // Step headings
  stepNum: {
    color: "rgba(255,255,255,0.35)",
    fontSize: "11px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "1.5px",
    margin: "0 0 10px",
  },
  stepTitle: {
    color: "var(--color-text)",
    fontSize: "20px",
    fontWeight: 800,
    textAlign: "center",
    margin: "0 0 6px",
    lineHeight: 1.3,
  },
  stepSub: {
    color: "var(--color-text-muted)",
    fontSize: "13px",
    margin: "0 0 18px",
    textAlign: "center",
  },

  // Option cards
  optionList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    width: "100%",
    marginBottom: "8px",
  },
  optionCard: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    padding: "14px 16px",
    borderRadius: "16px",
    cursor: "pointer",
    textAlign: "left",
    transition: "all 0.15s ease",
    width: "100%",
    boxSizing: "border-box",
  },
  optionIcon: { fontSize: "22px", flexShrink: 0, width: "28px", textAlign: "center" },
  optionText: {
    display: "flex", flexDirection: "column", gap: "2px", flex: 1,
  },
  optionLabel: {
    color: "var(--color-text)", fontSize: "15px", fontWeight: 700,
  },
  optionSub: {
    color: "rgba(255,255,255,0.45)", fontSize: "12px", fontWeight: 500,
  },
  optionRadio: {
    width: "20px", height: "20px", borderRadius: "50%",
    flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
    transition: "all 0.15s ease",
  },
  radioDot: {
    width: "8px", height: "8px", borderRadius: "50%", background: "#fff",
  },
  optionCheckbox: {
    width: "20px", height: "20px", borderRadius: "5px",
    flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
    transition: "all 0.15s ease",
  },
  checkMark: {
    color: "#fff", fontSize: "13px", fontWeight: 900, lineHeight: 1,
  },

  // Step 5 — All set
  successCircle: {
    width: "72px", height: "72px", borderRadius: "50%",
    background: "linear-gradient(135deg, var(--color-primary), #FF6B35)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "32px", color: "#fff", fontWeight: 900,
    marginBottom: "20px",
    boxShadow: "0 0 40px rgba(192,57,43,0.5)",
  },
  successTitle: {
    color: "var(--color-text)", fontSize: "26px", fontWeight: 900, margin: "0 0 8px",
    textAlign: "center",
  },
  successSub: {
    color: "var(--color-text-muted)", fontSize: "15px", margin: "0 0 28px",
    textAlign: "center", lineHeight: 1.5,
  },
  summaryCard: {
    width: "100%", background: "var(--color-card)",
    border: "1px solid rgba(255,255,255,0.1)", borderRadius: "18px",
    padding: "4px 18px", marginBottom: "20px",
    boxSizing: "border-box",
  },
  privacyNote: {
    color: "rgba(255,255,255,0.3)", fontSize: "11px", textAlign: "center",
    lineHeight: 1.5, margin: "0 0 28px", padding: "0 16px",
  },

  // Skip button
  skipBtn: {
    position: "absolute" as const, top: "16px", right: "16px",
    background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: "50%", width: "36px", height: "36px",
    color: "rgba(255,255,255,0.45)", fontSize: "15px", fontWeight: 700,
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 10, fontFamily: "'Inter', sans-serif",
  },

  // Buttons
  primaryBtn: {
    background: "var(--color-primary)", border: "none", borderRadius: "100px",
    color: "#fff", fontSize: "17px", fontWeight: 800, padding: "18px 52px",
    cursor: "pointer", letterSpacing: "0.5px",
    boxShadow: "0 0 30px rgba(192,57,43,0.5), 0 8px 24px rgba(0,0,0,0.4)",
    transition: "opacity 0.2s ease",
    width: "100%",
    maxWidth: "340px",
  },

  // Bottom nav
  bottomNav: {
    display: "flex",
    alignItems: "center",
    padding: "14px 20px 28px",
    gap: "12px",
    minHeight: "72px",
    flexShrink: 0,
  },
  backBtn: {
    background: "transparent", border: "1px solid rgba(255,255,255,0.2)",
    borderRadius: "100px", color: "rgba(255,255,255,0.6)", fontSize: "14px",
    fontWeight: 600, padding: "12px 22px", cursor: "pointer",
  },
  nextBtn: {
    background: "var(--color-primary)", border: "none",
    borderRadius: "100px", color: "#fff", fontSize: "15px",
    fontWeight: 700, padding: "13px 28px", cursor: "pointer",
    transition: "opacity 0.2s ease",
  },
};
