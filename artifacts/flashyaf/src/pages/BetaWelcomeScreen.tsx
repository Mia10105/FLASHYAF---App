import { useState } from "react";
import { collection, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

interface Props {
  onDismiss: () => void;
}

const BETA_CUTOFF = new Date("2027-01-01").getTime();

export function shouldShowBetaWelcome(uid: string): boolean {
  if (Date.now() >= BETA_CUTOFF) return false;
  return !localStorage.getItem(`flashyaf_beta_seen_${uid}`);
}

export function markBetaWelcomeSeen(uid: string) {
  localStorage.setItem(`flashyaf_beta_seen_${uid}`, "1");
}

export default function BetaWelcomeScreen({ onDismiss }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState<"welcome" | "feedback" | "success">("welcome");
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [loves, setLoves] = useState("");
  const [improve, setImprove] = useState("");
  const [missing, setMissing] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleDismiss() {
    if (user) markBetaWelcomeSeen(user.uid);
    onDismiss();
  }

  async function handleSubmit() {
    if (!user) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, "feedback"), {
        userId: user.uid,
        userEmail: user.email || "",
        timestamp: Date.now(),
        loves: loves.trim(),
        needsImprovement: improve.trim(),
        missing: missing.trim(),
        rating,
        betaTester: true,
      });
      markBetaWelcomeSeen(user.uid);
      setStep("success");
      setTimeout(() => onDismiss(), 2500);
    } catch {
      setSubmitting(false);
    }
  }

  return (
    <div style={s.backdrop}>
      <div style={s.sheet}>

        {/* ── Welcome Step ─────────────────────────────────────────────── */}
        {step === "welcome" && (
          <>
            <div style={s.scroll}>
              <div style={s.badgeRow}>
                <div style={s.goldBadge}>
                  <span style={s.goldBadgeIcon}>👑</span>
                  <span style={s.goldBadgeText}>FOUNDING MEMBER</span>
                </div>
              </div>

              <p style={s.brand}>FLASHYAF™</p>
              <p style={s.headline}>Welcome, Beta Tester!</p>
              <p style={s.sub}>
                You are one of our founding members — your feedback shapes FLASHYAF™
              </p>

              <div style={s.messageCard}>
                <p style={s.messageText}>
                  You are one of our <strong>founding members</strong>. Your feedback directly shapes
                  FLASHYAF™ before we launch to the world. Every flash you track, every reaction
                  you share, every piece of feedback you give makes this product better for millions
                  of women.
                </p>
                <p style={s.messageText}>
                  Thank you for trusting us with your health journey. 💜
                </p>
              </div>

              <div style={s.perksGrid}>
                {[
                  { icon: "🏅", title: "Founding Member Status", desc: "Your profile is permanently marked as a founding member" },
                  { icon: "🗳️", title: "Shape the Product", desc: "Your feedback goes directly to the founding team" },
                  { icon: "🎁", title: "Early Access", desc: "First access to every new feature before public launch" },
                  { icon: "❤️", title: "Lifetime Gratitude", desc: "We'll never forget who showed up first" },
                ].map(({ icon, title, desc }) => (
                  <div key={title} style={s.perkCard}>
                    <span style={s.perkIcon}>{icon}</span>
                    <p style={s.perkTitle}>{title}</p>
                    <p style={s.perkDesc}>{desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div style={s.actionBar}>
              <button style={s.primaryBtn} onClick={() => setStep("feedback")}>
                📝 Share My Feedback
              </button>
              <button style={s.skipBtn} onClick={handleDismiss}>
                Skip for now
              </button>
            </div>
          </>
        )}

        {/* ── Feedback Step ────────────────────────────────────────────── */}
        {step === "feedback" && (
          <>
            <div style={s.feedbackHeader}>
              <button style={s.backBtn} onClick={() => setStep("welcome")}>← Back</button>
              <div style={s.feedbackHeaderCenter}>
                <p style={s.brand}>FLASHYAF™</p>
                <p style={s.feedbackTitle}>Your Feedback</p>
              </div>
              <div style={{ width: "48px" }} />
            </div>

            <div style={s.scroll}>
              <p style={s.feedbackIntro}>
                Your honest thoughts are the most valuable thing you can give us right now. No wrong answers.
              </p>

              {/* Star rating */}
              <div style={s.ratingCard}>
                <p style={s.fieldLabel}>Overall Rating</p>
                <div style={s.starsRow}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      style={s.starBtn}
                      onMouseEnter={() => setHoverRating(n)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setRating(n)}
                    >
                      <span style={{
                        fontSize: "36px",
                        color: n <= (hoverRating || rating) ? "#F5A623" : "rgba(255,255,255,0.15)",
                        transition: "color 0.15s ease",
                      }}>★</span>
                    </button>
                  ))}
                </div>
                {rating > 0 && (
                  <p style={s.ratingLabel}>
                    {["", "Needs a lot of work", "It's okay", "I like it", "I love it!", "It's perfect! 🔥"][rating]}
                  </p>
                )}
              </div>

              {[
                { label: "💜 What do you love about FLASHYAF™?", val: loves, set: setLoves, placeholder: "Tell us what's working…" },
                { label: "🔧 What needs improvement?", val: improve, set: setImprove, placeholder: "Be brutally honest — we can handle it…" },
                { label: "✨ What's missing that you'd love to see?", val: missing, set: setMissing, placeholder: "Dream big — what would make this perfect for you?" },
              ].map(({ label, val, set, placeholder }) => (
                <div key={label} style={s.fieldGroup}>
                  <p style={s.fieldLabel}>{label}</p>
                  <textarea
                    style={s.textarea}
                    placeholder={placeholder}
                    value={val}
                    onChange={(e) => set(e.target.value)}
                    rows={3}
                  />
                </div>
              ))}

              <p style={s.feedbackPrivacy}>
                🔒 Your feedback is saved privately and reviewed only by the FLASHYAF™ team.
              </p>
            </div>

            <div style={s.actionBar}>
              <button
                style={{ ...s.primaryBtn, opacity: submitting ? 0.6 : 1 }}
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? "Sending…" : "🚀 Submit Feedback"}
              </button>
              <button style={s.skipBtn} onClick={handleDismiss}>Maybe later</button>
            </div>
          </>
        )}

        {/* ── Success Step ─────────────────────────────────────────────── */}
        {step === "success" && (
          <div style={s.successBox}>
            <span style={s.successEmoji}>🎉</span>
            <p style={s.successTitle}>Thank You!</p>
            <p style={s.successSub}>
              Your feedback has been received. You're officially part of the FLASHYAF™ founding story.
            </p>
            <div style={s.goldBadge}>
              <span style={s.goldBadgeIcon}>👑</span>
              <span style={s.goldBadgeText}>FOUNDING MEMBER</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  backdrop: {
    position: "fixed", inset: 0, zIndex: 800,
    background: "rgba(0,0,0,0.88)", backdropFilter: "blur(10px)",
    display: "flex", alignItems: "flex-end", justifyContent: "center",
    fontFamily: "'Inter', sans-serif",
  },
  sheet: {
    width: "100%", maxWidth: "480px", height: "94vh",
    background: "linear-gradient(180deg, #0F0A1A 0%, #0A0A0A 60%)",
    border: "1px solid rgba(245,166,35,0.3)",
    borderRadius: "28px 28px 0 0",
    display: "flex", flexDirection: "column",
    overflow: "hidden",
    animation: "slideUp 0.4s ease",
    boxShadow: "0 -24px 80px rgba(245,166,35,0.12)",
  },
  scroll: {
    flex: 1, overflowY: "auto",
    padding: "20px 18px",
    display: "flex", flexDirection: "column", gap: "16px",
  },
  badgeRow: { display: "flex", justifyContent: "center" },
  goldBadge: {
    display: "inline-flex", alignItems: "center", gap: "8px",
    background: "linear-gradient(135deg, #B8860B 0%, #FFD700 50%, #B8860B 100%)",
    borderRadius: "100px", padding: "8px 20px",
    boxShadow: "0 0 24px rgba(255,215,0,0.4)",
  },
  goldBadgeIcon: { fontSize: "18px" },
  goldBadgeText: {
    color: "#1A1A1A", fontSize: "12px", fontWeight: 900,
    letterSpacing: "2px", textTransform: "uppercase",
  },
  brand: {
    color: "var(--color-accent)", fontSize: "11px", fontWeight: 900,
    letterSpacing: "3px", textAlign: "center", margin: 0,
  },
  headline: {
    color: "#fff", fontSize: "28px", fontWeight: 900,
    textAlign: "center", margin: 0, letterSpacing: "-0.5px",
  },
  sub: {
    color: "rgba(255,255,255,0.55)", fontSize: "15px", fontWeight: 500,
    textAlign: "center", lineHeight: 1.5, margin: 0,
  },
  messageCard: {
    background: "rgba(245,166,35,0.06)", border: "1px solid rgba(245,166,35,0.2)",
    borderRadius: "16px", padding: "16px 18px",
    display: "flex", flexDirection: "column", gap: "10px",
  },
  messageText: {
    color: "rgba(255,255,255,0.8)", fontSize: "14px", lineHeight: 1.65, margin: 0,
  },
  perksGrid: {
    display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px",
  },
  perkCard: {
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "14px", padding: "14px 12px",
    display: "flex", flexDirection: "column", gap: "6px",
  },
  perkIcon: { fontSize: "24px", lineHeight: 1 },
  perkTitle: { color: "#fff", fontSize: "12px", fontWeight: 800, margin: 0, lineHeight: 1.3 },
  perkDesc: { color: "rgba(255,255,255,0.4)", fontSize: "11px", lineHeight: 1.4, margin: 0 },
  actionBar: {
    padding: "12px 18px 28px",
    borderTop: "1px solid rgba(255,255,255,0.08)",
    display: "flex", flexDirection: "column", gap: "8px", flexShrink: 0,
  },
  primaryBtn: {
    width: "100%",
    background: "linear-gradient(135deg, #B8860B 0%, #FFD700 100%)",
    border: "none", borderRadius: "100px",
    color: "#1A1A1A", fontSize: "16px", fontWeight: 900,
    padding: "17px", cursor: "pointer",
    boxShadow: "0 4px 24px rgba(255,215,0,0.35)",
    fontFamily: "'Inter', sans-serif",
  },
  skipBtn: {
    background: "transparent", border: "none",
    color: "rgba(255,255,255,0.3)", fontSize: "14px", fontWeight: 600,
    padding: "10px", cursor: "pointer", fontFamily: "'Inter', sans-serif",
  },

  // Feedback step
  feedbackHeader: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "16px 16px 12px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    flexShrink: 0,
  },
  backBtn: {
    background: "rgba(255,255,255,0.07)", border: "none", borderRadius: "100px",
    color: "rgba(255,255,255,0.7)", fontSize: "13px", fontWeight: 700,
    padding: "8px 14px", cursor: "pointer", fontFamily: "'Inter', sans-serif",
  },
  feedbackHeaderCenter: { textAlign: "center" },
  feedbackTitle: { color: "#fff", fontSize: "16px", fontWeight: 800, margin: 0 },
  feedbackIntro: {
    color: "rgba(255,255,255,0.55)", fontSize: "14px", lineHeight: 1.55, margin: 0,
    textAlign: "center",
  },
  ratingCard: {
    background: "rgba(245,166,35,0.06)", border: "1px solid rgba(245,166,35,0.2)",
    borderRadius: "16px", padding: "16px",
    display: "flex", flexDirection: "column", alignItems: "center", gap: "10px",
  },
  fieldLabel: {
    color: "rgba(255,255,255,0.7)", fontSize: "13px", fontWeight: 700, margin: 0,
  },
  starsRow: { display: "flex", gap: "4px" },
  starBtn: { background: "transparent", border: "none", cursor: "pointer", padding: "2px", lineHeight: 1 },
  ratingLabel: {
    color: "#F5A623", fontSize: "13px", fontWeight: 700, margin: 0,
  },
  fieldGroup: { display: "flex", flexDirection: "column", gap: "8px" },
  textarea: {
    width: "100%", boxSizing: "border-box",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "12px", color: "#fff",
    fontSize: "14px", fontWeight: 500, fontFamily: "'Inter', sans-serif",
    padding: "12px 14px", resize: "none", outline: "none", lineHeight: 1.5,
  },
  feedbackPrivacy: {
    color: "rgba(255,255,255,0.22)", fontSize: "11px",
    textAlign: "center", lineHeight: 1.5,
  },

  // Success
  successBox: {
    flex: 1, display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    gap: "16px", padding: "40px 24px",
  },
  successEmoji: { fontSize: "64px" },
  successTitle: { color: "#FFD700", fontSize: "26px", fontWeight: 900, margin: 0 },
  successSub: {
    color: "rgba(255,255,255,0.55)", fontSize: "14px", textAlign: "center",
    lineHeight: 1.6, margin: 0,
  },
};
