import { useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

interface Props {
  onComplete: () => void;
}

const CONSENT_VERSION = "1.0";

const DATA_SECTIONS = [
  {
    icon: "📊",
    title: "What we collect",
    items: [
      "Hot flash events — start time, duration, intensity, and stage progression",
      "Daily check-in responses — mood, energy, sleep quality, brain fog, and symptom severity",
      "Account information — email address and display name only",
      "App usage patterns — which features you use (no browsing history or device data)",
    ],
  },
  {
    icon: "🔒",
    title: "How we use it",
    items: [
      "To generate your personalized AI insights, pattern analysis, and weekly summaries",
      "To power streak tracking, milestone badges, and community features",
      "To improve the app experience over time — bugs, performance, feature prioritization",
      "We never sell your data to advertisers, data brokers, or third parties. Ever.",
    ],
  },
  {
    icon: "🔬",
    title: "Anonymized research",
    items: [
      "Aggregated, de-identified data may contribute to menopause and women's health research",
      "Your name, email, and any personally identifying information are never included",
      "You cannot be re-identified from data used in research",
      "Research participation helps advance care for millions of women worldwide",
    ],
  },
  {
    icon: "⚖️",
    title: "Your rights",
    items: [
      "Delete your data at any time — Settings → Delete My Account removes everything",
      "Export your flash history at any time from History → Monthly Report",
      "Withdraw from the app at any time with no penalty",
      "Contact us at privacy@flashyafapp.com for any data-related request",
    ],
  },
];

export default function ConsentScreen({ onComplete }: Props) {
  const { user } = useAuth();
  const [agreeChecked, setAgreeChecked] = useState(false);
  const [understandChecked, setUnderstandChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canProceed = agreeChecked && understandChecked;

  async function handleConsent() {
    if (!user || !canProceed) return;
    setSaving(true);
    setError("");
    try {
      await setDoc(doc(db, "users", user.uid), {
        consentGiven: true,
        consentTimestamp: Date.now(),
        consentVersion: CONSENT_VERSION,
        consentEmail: user.email,
      }, { merge: true });
      onComplete();
    } catch {
      setError("Unable to save consent. Please check your connection and try again.");
      setSaving(false);
    }
  }

  return (
    <div style={s.container}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.shieldWrap}>
          <span style={s.shieldIcon}>🛡️</span>
        </div>
        <p style={s.appName}>FLASHYAF™</p>
        <h1 style={s.title}>Privacy & Data Consent</h1>
        <p style={s.subtitle}>
          Before you begin, please review how we handle your health data.
          This takes about 60 seconds and is required to use the app.
        </p>
      </div>

      {/* Scrollable content */}
      <div style={s.scroll}>
        {DATA_SECTIONS.map((section) => (
          <div key={section.title} style={s.section}>
            <div style={s.sectionHeader}>
              <span style={s.sectionIcon}>{section.icon}</span>
              <p style={s.sectionTitle}>{section.title}</p>
            </div>
            <ul style={s.list}>
              {section.items.map((item, i) => (
                <li key={i} style={s.listItem}>
                  <span style={s.bullet}>·</span>
                  <span style={s.listText}>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/* HIPAA note */}
        <div style={s.hipaaCard}>
          <p style={s.hipaaTitle}>⚕️ HIPAA Alignment</p>
          <p style={s.hipaaText}>
            FLASHYAF™ is designed with HIPAA-aligned privacy principles. Your health
            information is encrypted in transit and at rest, access-controlled, and
            never shared without your explicit consent. We are not a covered entity
            under HIPAA but we hold ourselves to that standard.
          </p>
        </div>

        {/* Checkboxes */}
        <div style={s.checkboxSection}>
          <button
            style={{ ...s.checkRow, ...(agreeChecked ? s.checkRowActive : {}) }}
            onClick={() => setAgreeChecked((v) => !v)}
          >
            <div style={{ ...s.checkbox, ...(agreeChecked ? s.checkboxChecked : {}) }}>
              {agreeChecked && <span style={s.checkmark}>✓</span>}
            </div>
            <p style={s.checkLabel}>
              I agree to the{" "}
              <span style={s.checkLink}>Privacy Policy</span>
              {" "}and{" "}
              <span style={s.checkLink}>Terms of Service</span>
              {" "}as described above
            </p>
          </button>

          <button
            style={{ ...s.checkRow, ...(understandChecked ? s.checkRowActive : {}) }}
            onClick={() => setUnderstandChecked((v) => !v)}
          >
            <div style={{ ...s.checkbox, ...(understandChecked ? s.checkboxChecked : {}) }}>
              {understandChecked && <span style={s.checkmark}>✓</span>}
            </div>
            <p style={s.checkLabel}>
              I understand my anonymized data may be used to advance menopause research,
              and I can withdraw at any time
            </p>
          </button>
        </div>

        {error && <p style={s.error}>{error}</p>}

        {/* CTA */}
        <button
          style={{
            ...s.ctaBtn,
            background: canProceed
              ? "linear-gradient(135deg, #C0392B 0%, #E74C3C 100%)"
              : "rgba(255,255,255,0.08)",
            color: canProceed ? "#fff" : "rgba(255,255,255,0.25)",
            cursor: canProceed ? "pointer" : "default",
            boxShadow: canProceed ? "0 0 32px rgba(192,57,43,0.5)" : "none",
          }}
          onClick={handleConsent}
          disabled={!canProceed || saving}
        >
          {saving ? "Saving…" : canProceed ? "I Agree & Continue →" : "Check both boxes above to continue"}
        </button>

        <p style={s.footer}>
          Consent recorded with timestamp · Version {CONSENT_VERSION} · {new Date().toLocaleDateString()}
        </p>

        <div style={{ height: "32px" }} />
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh", background: "var(--color-bg)",
    display: "flex", flexDirection: "column",
    maxWidth: "480px", margin: "0 auto",
    fontFamily: "'Inter', sans-serif",
    overflowX: "hidden",
  },
  header: {
    padding: "40px 24px 24px",
    display: "flex", flexDirection: "column", alignItems: "center",
    gap: "8px", textAlign: "center",
    background: "linear-gradient(180deg, rgba(192,57,43,0.08) 0%, transparent 100%)",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
  },
  shieldWrap: {
    width: "64px", height: "64px", borderRadius: "20px",
    background: "rgba(192,57,43,0.12)", border: "1.5px solid rgba(192,57,43,0.3)",
    display: "flex", alignItems: "center", justifyContent: "center",
    marginBottom: "4px",
    boxShadow: "0 0 24px rgba(192,57,43,0.2)",
  },
  shieldIcon: { fontSize: "32px", lineHeight: 1 },
  appName: {
    color: "var(--color-accent)", fontSize: "13px", fontWeight: 900,
    letterSpacing: "3px", margin: 0, textTransform: "uppercase",
  },
  title: {
    color: "#fff", fontSize: "24px", fontWeight: 900,
    margin: "4px 0 0", letterSpacing: "-0.3px",
  },
  subtitle: {
    color: "rgba(255,255,255,0.45)", fontSize: "13px", lineHeight: 1.6,
    margin: "4px 0 0", maxWidth: "340px",
  },

  scroll: {
    flex: 1, overflowY: "auto", padding: "20px 20px 0",
    display: "flex", flexDirection: "column", gap: "14px",
  },

  section: {
    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "18px", padding: "16px 18px",
  },
  sectionHeader: {
    display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px",
  },
  sectionIcon: { fontSize: "20px", lineHeight: 1, flexShrink: 0 },
  sectionTitle: {
    color: "#fff", fontSize: "15px", fontWeight: 800, margin: 0,
  },
  list: { margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "8px" },
  listItem: { display: "flex", gap: "8px", alignItems: "flex-start" },
  bullet: { color: "var(--color-accent)", fontSize: "16px", flexShrink: 0, lineHeight: 1.4, fontWeight: 900 },
  listText: { color: "rgba(255,255,255,0.6)", fontSize: "13px", lineHeight: 1.55 },

  hipaaCard: {
    background: "rgba(46,134,171,0.08)", border: "1px solid rgba(46,134,171,0.25)",
    borderRadius: "18px", padding: "16px 18px",
  },
  hipaaTitle: {
    color: "#2E86AB", fontSize: "13px", fontWeight: 800,
    letterSpacing: "0.5px", margin: "0 0 8px",
  },
  hipaaText: {
    color: "rgba(255,255,255,0.5)", fontSize: "12px", lineHeight: 1.6, margin: 0,
  },

  checkboxSection: { display: "flex", flexDirection: "column", gap: "10px" },
  checkRow: {
    display: "flex", alignItems: "flex-start", gap: "14px",
    background: "rgba(255,255,255,0.04)", border: "1.5px solid rgba(255,255,255,0.1)",
    borderRadius: "16px", padding: "16px", cursor: "pointer",
    textAlign: "left", width: "100%", transition: "all 0.2s ease",
  },
  checkRowActive: {
    background: "rgba(26,188,156,0.07)",
    border: "1.5px solid rgba(26,188,156,0.35)",
  },
  checkbox: {
    width: "22px", height: "22px", borderRadius: "7px", flexShrink: 0, marginTop: "1px",
    border: "2px solid rgba(255,255,255,0.2)",
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "all 0.2s ease",
  },
  checkboxChecked: {
    background: "#1ABC9C", border: "2px solid #1ABC9C",
  },
  checkmark: {
    color: "#fff", fontSize: "13px", fontWeight: 900, lineHeight: 1,
  },
  checkLabel: {
    color: "rgba(255,255,255,0.7)", fontSize: "13px", lineHeight: 1.55, margin: 0, flex: 1,
  },
  checkLink: { color: "#FF4500", fontWeight: 700 },

  error: {
    color: "#FF6B6B", fontSize: "13px", fontWeight: 600,
    textAlign: "center", margin: "0",
    background: "rgba(255,107,107,0.1)", border: "1px solid rgba(255,107,107,0.25)",
    borderRadius: "10px", padding: "10px 14px",
  },

  ctaBtn: {
    width: "100%", border: "none", borderRadius: "100px",
    fontSize: "16px", fontWeight: 800, padding: "19px 24px",
    letterSpacing: "0.3px", transition: "all 0.25s ease",
    fontFamily: "'Inter', sans-serif",
  },
  footer: {
    color: "rgba(255,255,255,0.18)", fontSize: "11px",
    textAlign: "center", margin: "4px 0 0",
    fontWeight: 500,
  },
};
