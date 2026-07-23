import { useState, useEffect } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

const ACCENT_GOLD = "#F5A623";
const GOLD_DIM = "rgba(245,166,35,0.15)";
const GOLD_BORDER = "rgba(245,166,35,0.35)";

interface UserProfile {
  displayName: string;
  createdAt: number;
  flashCount: number;
  profileQuote: string;
  username: string;
  uid: string;
}

interface Badge {
  icon: string;
  label: string;
  color: string;
  glow: string;
}

function computeBadges(flashCount: number, daysTracking: number): Badge[] {
  const badges: Badge[] = [];
  if (flashCount >= 1)   badges.push({ icon: "🔥", label: "First Flame",       color: "#FF4500", glow: "rgba(255,69,0,0.4)" });
  if (flashCount >= 10)  badges.push({ icon: "⚡", label: "Spark Tracker",     color: "#F5A623", glow: "rgba(245,166,35,0.4)" });
  if (flashCount >= 25)  badges.push({ icon: "💪", label: "Flash Fighter",      color: "#E67E22", glow: "rgba(230,126,34,0.4)" });
  if (flashCount >= 50)  badges.push({ icon: "🌟", label: "Menopause Warrior",  color: "#FFD700", glow: "rgba(255,215,0,0.45)" });
  if (flashCount >= 100) badges.push({ icon: "🏆", label: "Flash Legend",       color: "#FFD700", glow: "rgba(255,215,0,0.5)" });
  if (flashCount >= 250) badges.push({ icon: "👑", label: "Founding Legend",    color: "#FFD700", glow: "rgba(255,215,0,0.6)" });
  if (daysTracking >= 7)   badges.push({ icon: "📅", label: "One Week Strong",  color: "#1ABC9C", glow: "rgba(26,188,156,0.4)" });
  if (daysTracking >= 30)  badges.push({ icon: "🗓️", label: "30-Day Survivor",  color: "#16A085", glow: "rgba(22,160,133,0.4)" });
  if (daysTracking >= 90)  badges.push({ icon: "📆", label: "3-Month Warrior",  color: "#8E44AD", glow: "rgba(142,68,173,0.4)" });
  if (daysTracking >= 365) badges.push({ icon: "💜", label: "Community Pillar", color: "#9B59B6", glow: "rgba(155,89,182,0.45)" });
  return badges;
}

function pluralDays(n: number) {
  if (n < 1) return "today";
  if (n === 1) return "1 day";
  if (n < 30) return `${n} days`;
  const months = Math.floor(n / 30);
  if (months < 12) return months === 1 ? "1 month" : `${months} months`;
  const years = Math.floor(n / 365);
  return years === 1 ? "1 year" : `${years} years`;
}

export default function PublicProfileScreen({ username }: { username: string }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDocs(
          query(collection(db, "users"), where("username", "==", username.toLowerCase()))
        );
        if (snap.empty) { setNotFound(true); setLoading(false); return; }
        const d = snap.docs[0].data();
        setProfile({
          displayName: d.displayName || d.username || "A FLASHYAF Member",
          createdAt: d.createdAt || Date.now(),
          flashCount: d.flashCount || 0,
          profileQuote: d.profileQuote || "",
          username: d.username || username,
          uid: snap.docs[0].id,
        });
      } catch { setNotFound(true); }
      setLoading(false);
    }
    load();
  }, [username]);

  async function handleShare() {
    const url = window.location.href;
    try { await navigator.clipboard.writeText(url); } catch {
      const el = document.createElement("textarea");
      el.value = url; document.body.appendChild(el);
      el.select(); document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  const daysTracking = profile
    ? Math.floor((Date.now() - profile.createdAt) / (1000 * 60 * 60 * 24))
    : 0;
  const badges = profile ? computeBadges(profile.flashCount, daysTracking) : [];

  if (loading) return (
    <div style={s.page}>
      <div style={s.loadingWrap}>
        <span style={{ fontSize: "56px", animation: "flameSpin 1.1s ease-in-out infinite" }}>🔥</span>
        <p style={{ color: ACCENT_GOLD, fontSize: "16px", fontWeight: 700, margin: "20px 0 0" }}>Loading profile…</p>
      </div>
    </div>
  );

  if (notFound) return (
    <div style={s.page}>
      <div style={s.loadingWrap}>
        <span style={{ fontSize: "56px" }}>😔</span>
        <p style={{ color: "#fff", fontSize: "20px", fontWeight: 800, margin: "20px 0 8px" }}>Profile not found</p>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px", margin: "0 0 32px" }}>
          This profile doesn't exist or may have been removed.
        </p>
        <a href="/" style={s.joinBtn}>Start Your FLASHYAF™ Journey →</a>
      </div>
    </div>
  );

  return (
    <div style={s.page}>
      <div style={s.inner}>

        {/* ── Brand Header ──────────────────────────────────── */}
        <div style={s.brandHeader}>
          <p style={s.brandWordmark}>🔥 FLASHYAF™</p>
          <p style={s.brandSub}>Your hot flash. Your data. Your power.</p>
        </div>

        {/* ── Profile Hero ──────────────────────────────────── */}
        <div style={s.heroCard}>
          <div style={s.avatarRing}>
            <div style={s.avatarInner}>
              <span style={{ fontSize: "44px", lineHeight: 1 }}>🌸</span>
            </div>
          </div>

          <p style={s.heroName}>{profile!.displayName}</p>
          <p style={s.heroHandle}>@{profile!.username}</p>

          {profile!.profileQuote ? (
            <div style={s.quoteBlock}>
              <span style={s.quoteMarks}>"</span>
              <p style={s.quoteText}>{profile!.profileQuote}</p>
              <span style={{ ...s.quoteMarks, alignSelf: "flex-end" }}>"</span>
            </div>
          ) : null}
        </div>

        {/* ── Stats Grid ────────────────────────────────────── */}
        <div style={s.statsGrid}>
          <div style={s.statCard}>
            <span style={s.statIcon}>🔥</span>
            <p style={s.statValue}>{profile!.flashCount.toLocaleString()}</p>
            <p style={s.statLabel}>Flashes Logged</p>
          </div>
          <div style={s.statCard}>
            <span style={s.statIcon}>⏱️</span>
            <p style={s.statValue}>{pluralDays(daysTracking)}</p>
            <p style={s.statLabel}>Tracking Journey</p>
          </div>
        </div>

        {/* ── Badges ────────────────────────────────────────── */}
        {badges.length > 0 && (
          <div style={s.badgesSection}>
            <p style={s.sectionTitle}>🏅 Badges Earned</p>
            <div style={s.badgeGrid}>
              {badges.map((b) => (
                <div key={b.label} style={{ ...s.badgeCard, boxShadow: `0 0 18px ${b.glow}` }}>
                  <span style={{ fontSize: "28px", lineHeight: 1 }}>{b.icon}</span>
                  <p style={{ ...s.badgeLabel, color: b.color }}>{b.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Share button ──────────────────────────────────── */}
        <button style={s.shareBtn} onClick={handleShare}>
          {copied ? "✓ Link Copied!" : "🔗 Share This Journey"}
        </button>

        {/* ── Join CTA ──────────────────────────────────────── */}
        <div style={s.joinSection}>
          <div style={s.joinDivider} />
          <p style={s.joinTitle}>Ready to own your menopause journey?</p>
          <p style={s.joinSub}>
            Join thousands of women tracking their hot flashes, finding patterns,
            and taking back control — with FLASHYAF™.
          </p>
          <a href="/" style={s.joinBtn}>
            Join FLASHYAF™ — It's Free 🔥
          </a>
          <p style={s.joinDisclaimer}>No ads. No algorithms. Just your data.</p>
        </div>

        {/* ── Footer ────────────────────────────────────────── */}
        <p style={s.footer}>
          © {new Date().getFullYear()} BROWNWORKS4U2 LLC · FLASHYAF™ · All rights reserved
        </p>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "radial-gradient(ellipse at top, #1A0E00 0%, #0A0A0A 60%)",
    fontFamily: "'Inter', sans-serif",
    display: "flex", flexDirection: "column", alignItems: "center",
    padding: "0 0 40px",
  },
  inner: {
    width: "100%", maxWidth: "480px",
    padding: "0 16px",
    display: "flex", flexDirection: "column", gap: "16px",
  },
  loadingWrap: {
    flex: 1, display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    minHeight: "100vh", padding: "40px 24px",
    textAlign: "center",
  },

  // Brand
  brandHeader: {
    textAlign: "center", padding: "32px 0 8px",
  },
  brandWordmark: {
    color: ACCENT_GOLD,
    fontSize: "14px", fontWeight: 900,
    letterSpacing: "2.5px", margin: "0 0 4px",
    textTransform: "uppercase",
  },
  brandSub: {
    color: "rgba(255,255,255,0.3)", fontSize: "11px",
    fontWeight: 600, margin: 0, letterSpacing: "0.3px",
  },

  // Hero card
  heroCard: {
    background: "rgba(255,255,255,0.03)",
    border: `1px solid ${GOLD_BORDER}`,
    borderRadius: "24px",
    padding: "28px 20px 24px",
    display: "flex", flexDirection: "column", alignItems: "center", gap: "8px",
    boxShadow: "0 0 60px rgba(245,166,35,0.08)",
  },
  avatarRing: {
    width: "96px", height: "96px",
    borderRadius: "50%",
    background: `conic-gradient(${ACCENT_GOLD}, #FF4500, ${ACCENT_GOLD})`,
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: "3px",
    marginBottom: "8px",
    boxShadow: `0 0 32px rgba(245,166,35,0.45)`,
  },
  avatarInner: {
    width: "100%", height: "100%", borderRadius: "50%",
    background: "#1A0E00",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  heroName: {
    color: "#fff", fontSize: "26px", fontWeight: 900,
    margin: "4px 0 0", textAlign: "center", letterSpacing: "-0.3px",
  },
  heroHandle: {
    color: ACCENT_GOLD, fontSize: "13px", fontWeight: 700,
    margin: 0, letterSpacing: "0.5px",
  },
  quoteBlock: {
    display: "flex", gap: "6px", alignItems: "flex-start",
    marginTop: "12px",
    background: GOLD_DIM,
    border: `1px solid ${GOLD_BORDER}`,
    borderRadius: "14px", padding: "14px 16px",
    width: "100%", boxSizing: "border-box",
  },
  quoteMarks: {
    color: ACCENT_GOLD, fontSize: "28px", lineHeight: 0.8,
    fontFamily: "Georgia, serif", fontWeight: 900,
    flexShrink: 0,
  },
  quoteText: {
    color: "rgba(255,255,255,0.85)", fontSize: "14px",
    lineHeight: 1.65, margin: 0, fontStyle: "italic",
    flex: 1, textAlign: "center",
  },

  // Stats
  statsGrid: {
    display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px",
  },
  statCard: {
    background: GOLD_DIM,
    border: `1px solid ${GOLD_BORDER}`,
    borderRadius: "18px", padding: "20px 14px",
    display: "flex", flexDirection: "column", alignItems: "center", gap: "6px",
    boxShadow: "0 0 24px rgba(245,166,35,0.06)",
  },
  statIcon: { fontSize: "28px", lineHeight: 1 },
  statValue: {
    color: ACCENT_GOLD, fontSize: "24px", fontWeight: 900,
    margin: 0, letterSpacing: "-0.5px", textAlign: "center",
  },
  statLabel: {
    color: "rgba(255,255,255,0.45)", fontSize: "11px",
    fontWeight: 700, margin: 0, textTransform: "uppercase",
    letterSpacing: "0.8px", textAlign: "center",
  },

  // Badges
  badgesSection: {
    display: "flex", flexDirection: "column", gap: "12px",
  },
  sectionTitle: {
    color: "#fff", fontSize: "15px", fontWeight: 800,
    margin: 0, letterSpacing: "0.2px",
  },
  badgeGrid: {
    display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px",
  },
  badgeCard: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "16px", padding: "14px 8px",
    display: "flex", flexDirection: "column", alignItems: "center", gap: "7px",
  },
  badgeLabel: {
    fontSize: "10px", fontWeight: 800,
    margin: 0, textAlign: "center",
    letterSpacing: "0.2px", lineHeight: 1.3,
  },

  // Share button
  shareBtn: {
    width: "100%",
    background: `linear-gradient(135deg, rgba(245,166,35,0.9), rgba(255,140,0,0.9))`,
    border: "none", borderRadius: "100px",
    color: "#000", fontSize: "15px", fontWeight: 900,
    padding: "17px 24px", cursor: "pointer",
    letterSpacing: "0.2px",
    boxShadow: "0 4px 28px rgba(245,166,35,0.45)",
    fontFamily: "'Inter', sans-serif",
  },

  // Join CTA
  joinSection: {
    display: "flex", flexDirection: "column", alignItems: "center", gap: "14px",
    padding: "8px 0 0",
  },
  joinDivider: {
    width: "100%", height: "1px",
    background: "linear-gradient(to right, transparent, rgba(245,166,35,0.3), transparent)",
    margin: "4px 0",
  },
  joinTitle: {
    color: "#fff", fontSize: "18px", fontWeight: 900,
    margin: 0, textAlign: "center", lineHeight: 1.3,
  },
  joinSub: {
    color: "rgba(255,255,255,0.45)", fontSize: "13px",
    lineHeight: 1.65, margin: 0, textAlign: "center",
    padding: "0 12px",
  },
  joinBtn: {
    display: "block", width: "100%", boxSizing: "border-box",
    background: "var(--color-primary)",
    borderRadius: "100px", color: "#fff",
    fontSize: "16px", fontWeight: 900,
    padding: "18px 24px", textAlign: "center",
    textDecoration: "none", letterSpacing: "0.2px",
    boxShadow: "0 0 36px rgba(192,57,43,0.5)",
  },
  joinDisclaimer: {
    color: "rgba(255,255,255,0.2)", fontSize: "11px",
    fontWeight: 600, margin: 0, textAlign: "center",
  },

  footer: {
    color: "rgba(255,255,255,0.15)", fontSize: "10px",
    textAlign: "center", margin: "8px 0 0", lineHeight: 1.6,
  },
};
