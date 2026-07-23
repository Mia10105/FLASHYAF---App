import { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { trackEvent } from "@/lib/analytics";

interface Props {
  onNavigate: (screen: string) => void;
}

type SubmitState = "idle" | "submitting" | "success" | "error";

export default function FeedbackScreen({ onNavigate }: Props) {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState("");
  const [experience, setExperience] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit() {
    if (!user) return;
    if (!suggestions.trim() && !experience.trim()) {
      setErrorMsg("Please fill in at least one field before submitting.");
      return;
    }
    setErrorMsg("");
    setSubmitState("submitting");
    try {
      await addDoc(collection(db, "user_feedback"), {
        userId: user.uid,
        userEmail: user.email ?? null,
        suggestions: suggestions.trim(),
        experience: experience.trim(),
        createdAt: serverTimestamp(),
      });
      trackEvent("feedback_submitted");
      setSubmitState("success");
      setSuggestions("");
      setExperience("");
    } catch {
      setSubmitState("error");
      setErrorMsg("Something went wrong. Please try again.");
    }
  }

  function resetForm() {
    setSubmitState("idle");
    setErrorMsg("");
  }

  const navItems: { label: string; icon: string; screen: string }[] = [
    { label: "Home", icon: "🏠", screen: "home" },
    { label: "History", icon: "📋", screen: "history" },
    { label: "Community", icon: "💬", screen: "community" },
    { label: "Learn", icon: "📚", screen: "learn" },
    { label: "Shop", icon: "🛍️", screen: "shop" },
    { label: "Settings", icon: "⚙️", screen: "settings" },
  ];

  return (
    <div style={s.root}>
      {/* Header */}
      <div style={s.header}>
        <p style={s.brand}>FLASHYAF™</p>
        <h1 style={s.title}>Community Impact</h1>
        <p style={s.subtitle}>
          Your voice shapes this app. Every message is read by our team at BROWNWORKS4U2 LLC.
        </p>
      </div>

      <div style={s.body}>
        {submitState === "success" ? (
          <div style={s.successCard}>
            <p style={s.successEmoji}>💜</p>
            <p style={s.successTitle}>Thank you so much.</p>
            <p style={s.successText}>
              Your message has been sent. We read every single one, and your
              experience helps us build something that truly works for you.
            </p>
            <button style={s.successBtn} onClick={resetForm}>
              Send Another
            </button>
          </div>
        ) : (
          <>
            {/* Feature Suggestions */}
            <div style={s.field}>
              <label style={s.label}>💡 Feature Suggestions</label>
              <p style={s.hint}>What would make FLASHYAF™ work better for you?</p>
              <textarea
                style={s.textarea}
                value={suggestions}
                onChange={(e) => setSuggestions(e.target.value)}
                placeholder="e.g. I'd love a weekly summary email, a sleep tracker integration, or a way to export my data to a spreadsheet..."
                rows={5}
                maxLength={1000}
                disabled={submitState === "submitting"}
              />
              <span style={s.charCount}>{suggestions.length}/1000</span>
            </div>

            {/* Impact / Experience */}
            <div style={s.field}>
              <label style={s.label}>🌟 My Experience &amp; Impact</label>
              <p style={s.hint}>
                How has tracking your flashes changed things for you? Share as much or as little as you like.
              </p>
              <textarea
                style={s.textarea}
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
                placeholder="e.g. I finally feel in control of my body. Showing my doctor the data changed everything. I stopped feeling alone..."
                rows={6}
                maxLength={2000}
                disabled={submitState === "submitting"}
              />
              <span style={s.charCount}>{experience.length}/2000</span>
            </div>

            {errorMsg && <p style={s.errorMsg}>{errorMsg}</p>}

            <button
              style={{
                ...s.submitBtn,
                opacity: submitState === "submitting" ? 0.6 : 1,
                cursor: submitState === "submitting" ? "not-allowed" : "pointer",
              }}
              onClick={handleSubmit}
              disabled={submitState === "submitting"}
            >
              {submitState === "submitting" ? "Sending..." : "Send to Our Team 💜"}
            </button>

            <p style={s.privacyNote}>
              Your feedback is tied to your account so we can follow up if needed.
              We never share individual responses.
            </p>
          </>
        )}
      </div>

      {/* Bottom nav */}
      <nav style={s.nav}>
        {navItems.map((item) => (
          <button
            key={item.screen}
            style={{
              ...s.navBtn,
              color: "community" === item.screen ? "#C0392B" : "rgba(255,255,255,0.45)",
            }}
            onClick={() => onNavigate(item.screen)}
          >
            <span style={s.navIcon}>{item.icon}</span>
            <span style={s.navLabel}>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh",
    background: "#0A0A0A",
    display: "flex",
    flexDirection: "column",
    fontFamily: "'Inter', sans-serif",
    paddingBottom: "80px",
  },
  header: {
    padding: "28px 22px 20px",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
  },
  brand: {
    color: "#C0392B",
    fontSize: "11px",
    fontWeight: 900,
    letterSpacing: "3px",
    margin: "0 0 10px",
    textTransform: "uppercase",
  },
  title: {
    color: "#fff",
    fontSize: "28px",
    fontWeight: 900,
    margin: "0 0 8px",
    letterSpacing: "-0.5px",
  },
  subtitle: {
    color: "rgba(255,255,255,0.5)",
    fontSize: "13px",
    lineHeight: 1.6,
    margin: 0,
  },
  body: {
    flex: 1,
    padding: "22px",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    position: "relative",
  },
  label: {
    color: "#fff",
    fontSize: "14px",
    fontWeight: 700,
    letterSpacing: "0.3px",
  },
  hint: {
    color: "rgba(255,255,255,0.45)",
    fontSize: "12px",
    margin: 0,
    lineHeight: 1.5,
  },
  textarea: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "14px",
    color: "#fff",
    fontSize: "14px",
    fontFamily: "'Inter', sans-serif",
    lineHeight: 1.6,
    padding: "14px 16px",
    resize: "vertical",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    marginTop: "2px",
  },
  charCount: {
    alignSelf: "flex-end",
    color: "rgba(255,255,255,0.25)",
    fontSize: "10px",
    fontWeight: 600,
    marginTop: "2px",
  },
  errorMsg: {
    color: "#FF6B6B",
    fontSize: "13px",
    fontWeight: 600,
    margin: 0,
    padding: "10px 14px",
    background: "rgba(255,107,107,0.1)",
    borderRadius: "10px",
    border: "1px solid rgba(255,107,107,0.25)",
  },
  submitBtn: {
    background: "linear-gradient(135deg, #C0392B 0%, #FF4500 100%)",
    border: "none",
    borderRadius: "100px",
    color: "#fff",
    fontSize: "16px",
    fontWeight: 800,
    padding: "16px 28px",
    width: "100%",
    letterSpacing: "0.3px",
    boxShadow: "0 4px 20px rgba(192,57,43,0.4)",
    transition: "opacity 0.2s ease",
  },
  privacyNote: {
    color: "rgba(255,255,255,0.25)",
    fontSize: "11px",
    textAlign: "center",
    lineHeight: 1.5,
    margin: 0,
    fontStyle: "italic",
  },
  successCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "14px",
    padding: "40px 20px",
    background: "rgba(255,255,255,0.04)",
    borderRadius: "24px",
    border: "1px solid rgba(255,255,255,0.1)",
    textAlign: "center",
    marginTop: "20px",
  },
  successEmoji: {
    fontSize: "56px",
    margin: 0,
    lineHeight: 1,
  },
  successTitle: {
    color: "#fff",
    fontSize: "22px",
    fontWeight: 900,
    margin: 0,
  },
  successText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: "14px",
    lineHeight: 1.7,
    margin: 0,
    maxWidth: "320px",
  },
  successBtn: {
    background: "rgba(255,255,255,0.1)",
    border: "1px solid rgba(255,255,255,0.2)",
    borderRadius: "100px",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 600,
    padding: "12px 28px",
    cursor: "pointer",
    marginTop: "8px",
  },
  nav: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    background: "rgba(10,10,10,0.95)",
    backdropFilter: "blur(12px)",
    borderTop: "1px solid rgba(255,255,255,0.06)",
    display: "flex",
    justifyContent: "space-around",
    padding: "8px 4px 10px",
    zIndex: 50,
  },
  navBtn: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "2px",
    padding: "4px 8px",
    borderRadius: "8px",
    minWidth: "44px",
    transition: "color 0.15s ease",
  },
  navIcon: { fontSize: "18px" },
  navLabel: { fontSize: "9px", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase" },
};
