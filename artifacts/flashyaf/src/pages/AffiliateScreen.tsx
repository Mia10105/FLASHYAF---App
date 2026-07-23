import { useState, useEffect } from "react";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { trackEvent } from "@/lib/analytics";

const PREMIUM_PRICE = 9.99;
const COMMISSION_RATE = 0.20;
const COMMISSION_PER_SIGNUP = parseFloat((PREMIUM_PRICE * COMMISSION_RATE).toFixed(2));

interface Props {
  onBack: () => void;
}

export default function AffiliateScreen({ onBack }: Props) {
  const { user } = useAuth();
  const [affiliateCode, setAffiliateCode] = useState("");
  const [clicks, setClicks] = useState(0);
  const [signups, setSignups] = useState(0);
  const [earningsPending, setEarningsPending] = useState(0);
  const [paypalEmail, setPaypalEmail] = useState("");
  const [paypalInput, setPaypalInput] = useState("");
  const [savingPaypal, setSavingPaypal] = useState(false);
  const [paypalSaved, setPaypalSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const affiliateLink = affiliateCode
    ? `${window.location.origin}/waitlist?ref=${affiliateCode}`
    : "";

  useEffect(() => {
    if (!user) return;
    async function load() {
      try {
        const userSnap = await getDoc(doc(db, "users", user!.uid));
        const code = userSnap.data()?.referralCode as string | undefined;
        if (!code) { setLoading(false); return; }
        setAffiliateCode(code);

        const affSnap = await getDoc(doc(db, "affiliates", code));
        if (affSnap.exists()) {
          const d = affSnap.data();
          setClicks(d.clicks || 0);
          setSignups(d.signups || 0);
          setEarningsPending(d.earningsPending || 0);
          const pp = d.paypalEmail || "";
          setPaypalEmail(pp);
          setPaypalInput(pp);
        } else {
          await setDoc(doc(db, "affiliates", code), {
            userId: user!.uid,
            code,
            clicks: 0,
            signups: 0,
            earningsPending: 0,
            paypalEmail: "",
            createdAt: Date.now(),
          });
        }
      } catch { /* silent */ }
      setLoading(false);
    }
    load();
  }, [user]);

  async function handleCopyLink() {
    trackEvent("referral_link_copied");
    try { await navigator.clipboard.writeText(affiliateLink); }
    catch {
      const el = document.createElement("textarea");
      el.value = affiliateLink;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  async function handleSavePaypal() {
    const trimmed = paypalInput.trim();
    if (!trimmed || !affiliateCode) return;
    setSavingPaypal(true);
    try {
      await updateDoc(doc(db, "affiliates", affiliateCode), { paypalEmail: trimmed });
      setPaypalEmail(trimmed);
      setPaypalSaved(true);
      setTimeout(() => setPaypalSaved(false), 3000);
    } catch { /* silent */ }
    setSavingPaypal(false);
  }

  return (
    <div style={s.container}>

      {/* Header */}
      <div style={s.header}>
        <button style={s.backBtn} onClick={onBack}>← Back</button>
        <p style={s.headerTitle}>Affiliate Program</p>
        <div style={{ width: "60px" }} />
      </div>

      <div style={s.scroll}>

        {/* Hero */}
        <div style={s.heroCard}>
          <div style={s.heroBadge}>💰 EARN WITH FLASHYAF™</div>
          <p style={s.heroTitle}>
            Earn <span style={s.heroAccent}>20%</span> on every Premium signup
          </p>
          <p style={s.heroSub}>
            Share your unique link. When someone upgrades to Premium through your
            link, you earn ${COMMISSION_PER_SIGNUP.toFixed(2)} — paid monthly via PayPal.
          </p>
        </div>

        {/* Affiliate Link */}
        <div style={s.card}>
          <p style={s.cardLabel}>Your Affiliate Link</p>
          {loading ? (
            <p style={s.loadingText}>Loading your link…</p>
          ) : affiliateLink ? (
            <>
              <div style={s.linkBox}>
                <p style={s.linkText}>{affiliateLink}</p>
              </div>
              <button
                style={{ ...s.copyBtn, ...(copied ? s.copyBtnSuccess : {}) }}
                onClick={handleCopyLink}
              >
                {copied ? "✓ Copied!" : "📋 Copy Link"}
              </button>
              <p style={s.linkNote}>
                Share this link anywhere — social media, email, your blog, or DMs.
              </p>
            </>
          ) : (
            <p style={s.linkNote}>
              Visit Settings to generate your referral code first.
            </p>
          )}
        </div>

        {/* Stats */}
        <div style={s.card}>
          <p style={s.cardLabel}>Your Stats</p>
          {loading ? (
            <p style={s.loadingText}>Loading stats…</p>
          ) : (
            <div style={s.statsRow}>
              <div style={s.statBox}>
                <p style={s.statNum}>{clicks.toLocaleString()}</p>
                <p style={s.statLabel}>Total Clicks</p>
              </div>
              <div style={s.statDivider} />
              <div style={s.statBox}>
                <p style={s.statNum}>{signups.toLocaleString()}</p>
                <p style={s.statLabel}>Total Signups</p>
              </div>
              <div style={s.statDivider} />
              <div style={s.statBox}>
                <p style={{ ...s.statNum, color: "#1ABC9C" }}>
                  ${earningsPending.toFixed(2)}
                </p>
                <p style={s.statLabel}>Pending Earnings</p>
              </div>
            </div>
          )}
          <div style={s.statsNote}>
            <span style={s.statsNoteIcon}>ℹ️</span>
            <span style={s.statsNoteText}>
              Stats update as your link is clicked and signups are confirmed. Earnings
              are paid out monthly once you have a verified PayPal email on file.
            </span>
          </div>
        </div>

        {/* How It Works */}
        <div style={s.card}>
          <p style={s.cardLabel}>How It Works</p>
          <div style={s.stepsWrap}>
            {[
              {
                num: "1",
                icon: "📤",
                title: "Share",
                desc: "Copy your unique link and share it on social media, in your blog, or with friends navigating menopause.",
              },
              {
                num: "2",
                icon: "👩‍💻",
                title: "They Sign Up",
                desc: "When someone clicks your link and signs up for a FLASHYAF™ Premium subscription, it's tracked automatically.",
              },
              {
                num: "3",
                icon: "💸",
                title: "You Earn",
                desc: `You earn ${(COMMISSION_RATE * 100).toFixed(0)}% of every Premium subscription — that's $${COMMISSION_PER_SIGNUP.toFixed(2)}/signup — deposited to your PayPal every month.`,
              },
            ].map((step, i, arr) => (
              <div key={step.num} style={s.stepWrap}>
                <div style={s.stepLeft}>
                  <div style={s.stepCircle}>
                    <span style={s.stepIcon}>{step.icon}</span>
                  </div>
                  {i < arr.length - 1 && <div style={s.stepConnector} />}
                </div>
                <div style={s.stepContent}>
                  <div style={s.stepHeader}>
                    <span style={s.stepNum}>Step {step.num}</span>
                    <span style={s.stepTitle}>{step.title}</span>
                  </div>
                  <p style={s.stepDesc}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* PayPal Payout */}
        <div style={s.card}>
          <p style={s.cardLabel}>Payout Method</p>
          <div style={s.paypalRow}>
            <span style={s.paypalIcon}>𝙋</span>
            <div>
              <p style={s.paypalTitle}>PayPal Email</p>
              <p style={s.paypalSub}>We send monthly payouts to your PayPal address.</p>
            </div>
          </div>
          <input
            style={s.paypalInput}
            type="email"
            placeholder="your-paypal@email.com"
            value={paypalInput}
            onChange={(e) => { setPaypalInput(e.target.value); setPaypalSaved(false); }}
            inputMode="email"
            autoComplete="email"
          />
          <button
            style={{
              ...s.paypalSaveBtn,
              opacity: savingPaypal || !paypalInput.trim() || paypalInput.trim() === paypalEmail ? 0.45 : 1,
            }}
            onClick={handleSavePaypal}
            disabled={savingPaypal || !paypalInput.trim() || paypalInput.trim() === paypalEmail}
          >
            {paypalSaved ? "✓ Saved!" : savingPaypal ? "Saving…" : "Save PayPal Email"}
          </button>
          {paypalEmail && (
            <p style={s.paypalConfirmed}>
              ✓ Payout email on file: <strong>{paypalEmail}</strong>
            </p>
          )}
        </div>

        {/* Terms */}
        <div style={s.termsCard}>
          <p style={s.termsTitle}>📋 Program Terms</p>
          <div style={s.termsList}>
            {[
              `Commission rate: ${(COMMISSION_RATE * 100).toFixed(0)}% of the subscriber's first month ($${COMMISSION_PER_SIGNUP.toFixed(2)} per signup)`,
              "Payouts processed on the 1st of each month for the prior month's earnings",
              "Minimum payout threshold: $10.00",
              "A verified PayPal email is required to receive payment",
              "Self-referrals are not eligible for commission",
              "BROWNWORKS4U2 LLC reserves the right to modify or cancel the program with 30 days notice",
              "Questions? Contact us at contact@flashyafapp.com",
            ].map((term, i) => (
              <div key={i} style={s.termRow}>
                <span style={s.termBullet}>·</span>
                <p style={s.termText}>{term}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={{ height: "20px" }} />
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    background: "var(--color-bg)",
    display: "flex",
    flexDirection: "column",
    maxWidth: "480px",
    margin: "0 auto",
    fontFamily: "'Inter', sans-serif",
  },

  // Header
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "18px 16px 14px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    flexShrink: 0,
  },
  backBtn: {
    background: "transparent",
    border: "none",
    color: "rgba(255,255,255,0.5)",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "'Inter', sans-serif",
    padding: "4px 0",
    width: "60px",
    textAlign: "left" as const,
  },
  headerTitle: {
    color: "#fff",
    fontSize: "17px",
    fontWeight: 900,
    margin: 0,
    letterSpacing: "0.2px",
  },

  scroll: {
    flex: 1,
    overflowY: "auto",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },

  // Hero
  heroCard: {
    background: "linear-gradient(135deg, rgba(26,188,156,0.1) 0%, rgba(255,69,0,0.08) 100%)",
    border: "1px solid rgba(26,188,156,0.25)",
    borderRadius: "20px",
    padding: "22px 20px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  heroBadge: {
    display: "inline-block",
    background: "rgba(26,188,156,0.12)",
    border: "1px solid rgba(26,188,156,0.3)",
    borderRadius: "100px",
    color: "#1ABC9C",
    fontSize: "11px",
    fontWeight: 900,
    letterSpacing: "1px",
    padding: "5px 14px",
    alignSelf: "flex-start",
  },
  heroTitle: {
    color: "#fff",
    fontSize: "22px",
    fontWeight: 900,
    margin: 0,
    lineHeight: 1.25,
  },
  heroAccent: {
    color: "#1ABC9C",
  },
  heroSub: {
    color: "rgba(255,255,255,0.5)",
    fontSize: "13px",
    lineHeight: 1.65,
    margin: 0,
  },

  // Card
  card: {
    background: "#141414",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "18px",
    padding: "18px 16px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  cardLabel: {
    color: "rgba(255,255,255,0.35)",
    fontSize: "11px",
    fontWeight: 800,
    letterSpacing: "1.5px",
    textTransform: "uppercase" as const,
    margin: 0,
  },
  loadingText: {
    color: "rgba(255,255,255,0.3)",
    fontSize: "13px",
    margin: 0,
  },

  // Link
  linkBox: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "12px",
    padding: "12px 14px",
  },
  linkText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: "12px",
    fontFamily: "monospace",
    wordBreak: "break-all" as const,
    lineHeight: 1.5,
    margin: 0,
  },
  copyBtn: {
    background: "linear-gradient(135deg, #C0392B, #FF4500)",
    border: "none",
    borderRadius: "12px",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 800,
    padding: "14px",
    cursor: "pointer",
    fontFamily: "'Inter', sans-serif",
    transition: "background 0.2s",
  },
  copyBtnSuccess: {
    background: "rgba(26,188,156,0.2)",
    border: "1px solid rgba(26,188,156,0.4)",
    color: "#1ABC9C",
  },
  linkNote: {
    color: "rgba(255,255,255,0.3)",
    fontSize: "12px",
    lineHeight: 1.5,
    margin: 0,
  },

  // Stats
  statsRow: {
    display: "flex",
    alignItems: "center",
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: "14px",
    padding: "16px 12px",
  },
  statBox: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
  },
  statDivider: {
    width: "1px",
    height: "36px",
    background: "rgba(255,255,255,0.08)",
    flexShrink: 0,
  },
  statNum: {
    color: "#fff",
    fontSize: "26px",
    fontWeight: 900,
    margin: 0,
    lineHeight: 1,
  },
  statLabel: {
    color: "rgba(255,255,255,0.35)",
    fontSize: "11px",
    fontWeight: 600,
    margin: 0,
    textAlign: "center" as const,
  },
  statsNote: {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    background: "rgba(255,255,255,0.03)",
    borderRadius: "10px",
    padding: "10px 12px",
  },
  statsNoteIcon: { fontSize: "13px", flexShrink: 0, lineHeight: 1.5 },
  statsNoteText: {
    color: "rgba(255,255,255,0.35)",
    fontSize: "11px",
    lineHeight: 1.55,
  },

  // Steps
  stepsWrap: { display: "flex", flexDirection: "column", gap: "0" },
  stepWrap: { display: "flex", gap: "14px", minHeight: "72px" },
  stepLeft: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    flexShrink: 0,
    width: "44px",
  },
  stepCircle: {
    width: "44px",
    height: "44px",
    borderRadius: "50%",
    background: "rgba(26,188,156,0.1)",
    border: "1.5px solid rgba(26,188,156,0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  stepIcon: { fontSize: "20px", lineHeight: 1 },
  stepConnector: {
    flex: 1,
    width: "1.5px",
    background: "rgba(26,188,156,0.2)",
    margin: "4px 0",
    minHeight: "20px",
  },
  stepContent: {
    paddingTop: "10px",
    paddingBottom: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "5px",
    flex: 1,
  },
  stepHeader: { display: "flex", alignItems: "center", gap: "8px" },
  stepNum: {
    color: "#1ABC9C",
    fontSize: "10px",
    fontWeight: 900,
    letterSpacing: "1px",
    textTransform: "uppercase" as const,
  },
  stepTitle: {
    color: "#fff",
    fontSize: "14px",
    fontWeight: 800,
  },
  stepDesc: {
    color: "rgba(255,255,255,0.5)",
    fontSize: "13px",
    lineHeight: 1.6,
    margin: 0,
  },

  // PayPal
  paypalRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  paypalIcon: {
    width: "40px",
    height: "40px",
    borderRadius: "10px",
    background: "#003087",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "22px",
    fontWeight: 900,
    color: "#fff",
    flexShrink: 0,
    fontStyle: "italic",
  },
  paypalTitle: {
    color: "#fff",
    fontSize: "14px",
    fontWeight: 800,
    margin: 0,
  },
  paypalSub: {
    color: "rgba(255,255,255,0.4)",
    fontSize: "12px",
    margin: 0,
  },
  paypalInput: {
    width: "100%",
    boxSizing: "border-box" as const,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "12px",
    color: "#fff",
    fontSize: "15px",
    fontFamily: "'Inter', sans-serif",
    padding: "14px 16px",
    outline: "none",
  },
  paypalSaveBtn: {
    width: "100%",
    background: "#003087",
    border: "none",
    borderRadius: "12px",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 800,
    padding: "14px",
    cursor: "pointer",
    fontFamily: "'Inter', sans-serif",
  },
  paypalConfirmed: {
    color: "#1ABC9C",
    fontSize: "12px",
    margin: 0,
    fontWeight: 600,
  },

  // Terms
  termsCard: {
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: "16px",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  termsTitle: {
    color: "rgba(255,255,255,0.4)",
    fontSize: "11px",
    fontWeight: 800,
    letterSpacing: "1.5px",
    textTransform: "uppercase" as const,
    margin: 0,
  },
  termsList: { display: "flex", flexDirection: "column", gap: "8px" },
  termRow: { display: "flex", alignItems: "flex-start", gap: "8px" },
  termBullet: { color: "rgba(255,255,255,0.2)", fontSize: "16px", lineHeight: 1.4, flexShrink: 0 },
  termText: {
    color: "rgba(255,255,255,0.35)",
    fontSize: "12px",
    lineHeight: 1.55,
    margin: 0,
  },
};
