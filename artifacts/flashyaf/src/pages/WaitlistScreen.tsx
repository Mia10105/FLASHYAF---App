import { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  getCountFromServer,
  doc,
  setDoc,
  increment,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

const COMMISSION_PER_SIGNUP = 2.00;

export default function WaitlistScreen() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  // Newsletter
  const [nlName, setNlName] = useState("");
  const [nlSubbed, setNlSubbed] = useState(false);
  const [nlSubbing, setNlSubbing] = useState(false);
  const [nlError, setNlError] = useState("");

  const waitlistUrl = window.location.origin + "/waitlist";
  const refCode = new URLSearchParams(window.location.search).get("ref") || "";

  useEffect(() => {
    getCountFromServer(collection(db, "waitlist"))
      .then((snap) => setCount(snap.data().count))
      .catch(() => {});
  }, []);

  // Track affiliate click (once per session per code)
  useEffect(() => {
    if (!refCode) return;
    const key = `flashyaf_aff_click_${refCode}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    setDoc(doc(db, "affiliates", refCode), { clicks: increment(1) }, { merge: true }).catch(() => {});
  }, [refCode]);

  async function handleJoin() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@") || !trimmed.includes(".")) {
      setError("Please enter a valid email address.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const existing = await getDocs(
        query(collection(db, "waitlist"), where("email", "==", trimmed))
      );
      if (!existing.empty) {
        setError("You're already on the list! We'll be in touch soon. 💜");
        setSubmitting(false);
        return;
      }
      await addDoc(collection(db, "waitlist"), {
        email: trimmed,
        timestamp: Date.now(),
        source: "waitlist-page",
        ref: refCode || null,
      });
      // Credit affiliate if referred
      if (refCode) {
        setDoc(doc(db, "affiliates", refCode), {
          signups: increment(1),
          earningsPending: increment(COMMISSION_PER_SIGNUP),
        }, { merge: true }).catch(() => {});
      }
      setDone(true);
      if (count !== null) setCount(count + 1);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleNlSubscribe() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    setNlSubbing(true);
    setNlError("");
    try {
      const existing = await getDocs(query(collection(db, "newsletter"), where("email", "==", trimmed)));
      if (!existing.empty) { setNlSubbed(true); setNlSubbing(false); return; }
      await addDoc(collection(db, "newsletter"), {
        email: trimmed,
        name: nlName.trim() || "",
        signupDate: Date.now(),
        isAppUser: false,
        source: "waitlist",
      });
      setNlSubbed(true);
    } catch {
      setNlError("Couldn't subscribe. Please try again.");
    } finally {
      setNlSubbing(false);
    }
  }

  async function handleShare() {
    try {
      await navigator.clipboard.writeText(waitlistUrl);
    } catch {
      const el = document.createElement("textarea");
      el.value = waitlistUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div style={s.page}>
      <div style={s.inner}>

        {/* Logo */}
        <div style={s.logoWrap}>
          <div style={s.flameRing}>
            <span style={s.flameEmoji}>🔥</span>
          </div>
          <p style={s.brand}>FLASHYAF™</p>
          <div style={s.taglinePill}>
            <span style={s.tagline}>Real-Time Relief · Real-Life Support</span>
          </div>
        </div>

        {/* Hero copy */}
        <div style={s.heroBlock}>
          <p style={s.heroTitle}>Your hot flash, finally understood.</p>
          <p style={s.heroSub}>
            FLASHYAF™ is the first app built by women, for women navigating
            menopause — with voice-activated flash logging, pattern intelligence,
            and a community that truly gets it.
          </p>
        </div>

        {/* Count badge */}
        {count !== null && count > 0 && (
          <div style={s.countBadge}>
            <span style={s.countFlame}>🔥</span>
            <span style={s.countText}>
              <strong style={s.countNum}>{count.toLocaleString()}</strong> women already on the waitlist
            </span>
          </div>
        )}

        {/* Feature pills */}
        <div style={s.featureRow}>
          {[
            { icon: "🎙️", label: "Voice logging" },
            { icon: "📊", label: "Pattern insights" },
            { icon: "💜", label: "Community" },
            { icon: "🧠", label: "AI relief tips" },
          ].map(({ icon, label }) => (
            <div key={label} style={s.featurePill}>
              <span style={{ fontSize: "14px" }}>{icon}</span>
              <span style={s.featurePillLabel}>{label}</span>
            </div>
          ))}
        </div>

        {/* Form / Success */}
        <div style={s.card}>
          {done ? (
            <div style={s.successBlock}>
              <span style={s.successEmoji}>💜</span>
              <p style={s.successTitle}>You're in!</p>
              <p style={s.successSub}>
                We'll reach out when we launch premium features. Thank you for
                joining the FLASHYAF™ community.
              </p>
              <button style={s.shareBtn} onClick={handleShare}>
                {copied ? "✓ Link copied!" : "📋 Share with a friend"}
              </button>
              <p style={s.shareUrl}>{waitlistUrl}</p>

              {/* Newsletter signup */}
              <div style={{
                width: "100%", marginTop: "8px",
                background: nlSubbed ? "rgba(26,188,156,0.08)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${nlSubbed ? "rgba(26,188,156,0.35)" : "rgba(255,255,255,0.1)"}`,
                borderRadius: "16px", padding: "18px 16px",
                display: "flex", flexDirection: "column", gap: "10px",
              }}>
                {nlSubbed ? (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "20px" }}>✅</span>
                      <p style={{ color: "#1ABC9C", fontSize: "14px", fontWeight: 800, margin: 0 }}>
                        You are subscribed to the FLASHYAF™ newsletter.
                      </p>
                    </div>
                    <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "11px", fontWeight: 700, margin: "2px 0 2px", letterSpacing: "0.5px", textTransform: "uppercase" as const }}>
                      You will get:
                    </p>
                    {[
                      { icon: "💡", text: "Weekly menopause tips" },
                      { icon: "🌟", text: "Community spotlight highlights" },
                      { icon: "🚀", text: "New feature announcements" },
                      { icon: "🎁", text: "Exclusive beta offers" },
                    ].map((item) => (
                      <div key={item.text} style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                        <span style={{ fontSize: "14px", flexShrink: 0 }}>{item.icon}</span>
                        <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "13px", fontWeight: 600, margin: 0 }}>{item.text}</p>
                      </div>
                    ))}
                  </>
                ) : (
                  <>
                    <p style={{ color: "#fff", fontSize: "14px", fontWeight: 800, margin: 0 }}>
                      📬 Get the FLASHYAF™ Newsletter
                    </p>
                    <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px", lineHeight: 1.5, margin: 0 }}>
                      Weekly tips, community highlights, new features, and exclusive beta offers.
                    </p>
                    <input
                      style={{ ...s.emailInput, fontSize: "14px", padding: "12px 14px" }}
                      type="text"
                      placeholder="Your first name (optional)"
                      value={nlName}
                      onChange={(e) => setNlName(e.target.value)}
                    />
                    {nlError && <p style={{ color: "#FF6B6B", fontSize: "12px", fontWeight: 600, margin: 0 }}>{nlError}</p>}
                    <button
                      style={{
                        width: "100%",
                        background: "linear-gradient(135deg, rgba(26,188,156,0.9), rgba(22,160,133,0.9))",
                        border: "none", borderRadius: "12px",
                        color: "#fff", fontSize: "14px", fontWeight: 800,
                        padding: "13px", cursor: nlSubbing ? "not-allowed" : "pointer",
                        opacity: nlSubbing ? 0.6 : 1,
                        fontFamily: "'Inter', sans-serif",
                      }}
                      onClick={handleNlSubscribe}
                      disabled={nlSubbing}
                    >
                      {nlSubbing ? "Subscribing…" : "Subscribe — it's free"}
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <>
              <p style={s.cardTitle}>Join the Waitlist</p>
              <p style={s.cardSub}>
                Be first to access premium features when they launch.
              </p>
              <input
                style={s.emailInput}
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleJoin(); }}
                autoComplete="email"
                inputMode="email"
              />
              {error && <p style={s.errorText}>{error}</p>}
              <button
                style={{ ...s.joinBtn, opacity: submitting ? 0.6 : 1 }}
                onClick={handleJoin}
                disabled={submitting}
              >
                {submitting ? "Saving…" : "Join the Waitlist 🔥"}
              </button>
              <p style={s.privacyNote}>
                No spam, ever. Unsubscribe anytime.
              </p>
            </>
          )}
        </div>

        {/* Already have an account */}
        <a href="/" style={s.appLink}>
          Already have an account? Open the app →
        </a>

        {/* Footer */}
        <div style={s.footer}>
          <p style={s.footerText}>
            © 2026 BROWNWORKS4U2 LLC · FLASHYAF™
          </p>
          <p style={s.footerText}>
            <a href="mailto:contact@flashyafapp.com" style={s.footerLink}>
              contact@flashyafapp.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100dvh",
    background: "var(--color-bg)",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    fontFamily: "'Inter', sans-serif",
    padding: "0 0 40px",
  },
  inner: {
    width: "100%",
    maxWidth: "480px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "20px",
    padding: "40px 20px 0",
  },

  // Logo
  logoWrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "10px",
  },
  flameRing: {
    width: "88px",
    height: "88px",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(255,69,0,0.18) 0%, rgba(192,57,43,0.08) 60%, transparent 80%)",
    border: "1.5px solid rgba(255,69,0,0.3)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 0 40px rgba(255,69,0,0.15)",
  },
  flameEmoji: { fontSize: "44px", lineHeight: 1 },
  brand: {
    color: "var(--color-accent)",
    fontSize: "28px",
    fontWeight: 900,
    letterSpacing: "4px",
    margin: 0,
  },
  taglinePill: {
    background: "rgba(255,69,0,0.08)",
    border: "1px solid rgba(255,69,0,0.2)",
    borderRadius: "100px",
    padding: "6px 16px",
  },
  tagline: {
    color: "rgba(255,255,255,0.55)",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.5px",
  },

  // Hero
  heroBlock: {
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  heroTitle: {
    color: "#fff",
    fontSize: "24px",
    fontWeight: 900,
    margin: 0,
    lineHeight: 1.2,
  },
  heroSub: {
    color: "rgba(255,255,255,0.5)",
    fontSize: "14px",
    lineHeight: 1.65,
    margin: 0,
  },

  // Count badge
  countBadge: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    background: "rgba(255,69,0,0.08)",
    border: "1px solid rgba(255,69,0,0.2)",
    borderRadius: "100px",
    padding: "8px 18px",
  },
  countFlame: { fontSize: "16px" },
  countText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: "13px",
    fontWeight: 600,
  },
  countNum: {
    color: "var(--color-accent)",
    fontWeight: 900,
  },

  // Feature pills
  featureRow: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap" as const,
    justifyContent: "center",
  },
  featurePill: {
    display: "flex",
    alignItems: "center",
    gap: "5px",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "100px",
    padding: "6px 12px",
  },
  featurePillLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: "12px",
    fontWeight: 700,
  },

  // Card
  card: {
    width: "100%",
    background: "#141414",
    border: "1px solid rgba(255,69,0,0.2)",
    borderRadius: "24px",
    padding: "28px 24px",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    boxShadow: "0 8px 40px rgba(255,69,0,0.07)",
  },
  cardTitle: {
    color: "#fff",
    fontSize: "20px",
    fontWeight: 900,
    margin: 0,
  },
  cardSub: {
    color: "rgba(255,255,255,0.45)",
    fontSize: "13px",
    lineHeight: 1.5,
    margin: 0,
  },
  emailInput: {
    width: "100%",
    boxSizing: "border-box" as const,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: "14px",
    color: "#fff",
    fontSize: "16px",
    fontFamily: "'Inter', sans-serif",
    padding: "16px 18px",
    outline: "none",
  },
  errorText: {
    color: "#FF6B6B",
    fontSize: "13px",
    fontWeight: 600,
    margin: 0,
  },
  joinBtn: {
    width: "100%",
    background: "linear-gradient(135deg, #C0392B 0%, #FF4500 100%)",
    border: "none",
    borderRadius: "14px",
    color: "#fff",
    fontSize: "16px",
    fontWeight: 900,
    padding: "18px",
    cursor: "pointer",
    fontFamily: "'Inter', sans-serif",
    letterSpacing: "0.3px",
    boxShadow: "0 4px 24px rgba(255,69,0,0.35)",
  },
  privacyNote: {
    color: "rgba(255,255,255,0.25)",
    fontSize: "12px",
    textAlign: "center" as const,
    margin: 0,
  },

  // Success
  successBlock: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "12px",
    textAlign: "center" as const,
  },
  successEmoji: { fontSize: "48px", lineHeight: 1 },
  successTitle: {
    color: "#fff",
    fontSize: "24px",
    fontWeight: 900,
    margin: 0,
  },
  successSub: {
    color: "rgba(255,255,255,0.55)",
    fontSize: "14px",
    lineHeight: 1.6,
    margin: 0,
  },
  shareBtn: {
    width: "100%",
    background: "rgba(142,68,173,0.2)",
    border: "1px solid rgba(142,68,173,0.4)",
    borderRadius: "14px",
    color: "#C39BD3",
    fontSize: "15px",
    fontWeight: 800,
    padding: "16px",
    cursor: "pointer",
    fontFamily: "'Inter', sans-serif",
    marginTop: "4px",
  },
  shareUrl: {
    color: "rgba(255,255,255,0.25)",
    fontSize: "12px",
    wordBreak: "break-all" as const,
    margin: 0,
  },

  // Bottom
  appLink: {
    color: "rgba(255,255,255,0.3)",
    fontSize: "13px",
    fontWeight: 600,
    textDecoration: "none",
  },
  footer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
    paddingTop: "8px",
  },
  footerText: {
    color: "rgba(255,255,255,0.18)",
    fontSize: "11px",
    margin: 0,
    textAlign: "center" as const,
  },
  footerLink: {
    color: "rgba(255,255,255,0.25)",
    textDecoration: "none",
  },
};
