import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "@/lib/firebase";

interface ResearchStats {
  totalFlashes: number;
  avgDurationMin: number;
  avgDurationSec: number;
  peakTimeBlock: string;
  avgIntensity: number;
  topBodyAreas: { label: string; pct: number }[];
  daysOfData: number;
  totalUsers: number;
  loading: boolean;
}

// Shape stored in publicStats/aggregates (Firestore — publicly readable)
interface CachedStats {
  totalFlashes: number;
  avgDurationMin: number;
  avgDurationSec: number;
  peakTimeBlock: string;
  avgIntensity: number;
  topBodyAreas: { label: string; pct: number }[];
  daysOfData: number;
  totalUsers: number;
  updatedAt: number;
}

// NOTE: the time-block / body-area label logic now lives in the Cloud
// Function (functions/index.js) since that's where the aggregation happens.

export default function ResearchScreen() {
  const [stats, setStats] = useState<ResearchStats>({
    totalFlashes: 0, avgDurationMin: 0, avgDurationSec: 0,
    peakTimeBlock: "—", avgIntensity: 0, topBodyAreas: [],
    daysOfData: 0, totalUsers: 0, loading: true,
  });
  const [error, setError] = useState(false);
  const [cacheAge, setCacheAge] = useState<string | null>(null);

  // ── SECURITY FIX ──────────────────────────────────────────────────────────
  // This used to query every user's raw flash records directly from the
  // browser (via collectionGroup). That required a Firestore rule that let
  // any signed-in user read everyone else's data, which was a real privacy
  // leak. Now the browser never touches raw records — it just asks a
  // trusted Cloud Function (running with admin access) to refresh the
  // numbers, and that function is the only thing allowed to see raw data.
  async function refreshStats(): Promise<ResearchStats | null> {
    try {
      const functions = getFunctions();
      const refresh = httpsCallable(functions, "refreshResearchStats");
      const result = await refresh();
      const fresh = result.data as CachedStats;
      return { ...fresh, loading: false };
    } catch {
      return null;
    }
  }

  useEffect(() => {
    async function loadStats() {
      // Step 1 — always try the public cache first (readable by anyone)
      try {
        const cacheSnap = await getDoc(doc(db, "publicStats", "aggregates"));
        if (cacheSnap.exists()) {
          const cached = cacheSnap.data() as CachedStats;
          setStats({ ...cached, loading: false });
          const mins = Math.round((Date.now() - cached.updatedAt) / 60000);
          setCacheAge(mins < 2 ? "just now" : `${mins}m ago`);
        }
      } catch {
        // cache read failed — will try live below
      }

      // Step 2 — if the user is authenticated, ask the trusted Cloud Function
      // to refresh the numbers (it updates the public cache for everyone)
      onAuthStateChanged(auth, async (user) => {
        if (!user) return;
        const fresh = await refreshStats();
        if (fresh) {
          setStats(fresh);
          setCacheAge("just now");
        } else {
          setError(true);
          setStats((s) => ({ ...s, loading: false }));
        }
      });

      // Step 3 — if still loading after both attempts, stop the spinner
      setStats((s) => (s.loading ? { ...s, loading: false } : s));
    }
    loadStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const s = styles;

  return (
    <div style={s.page}>
      <div style={s.inner}>
        {/* Header */}
        <div style={s.header}>
          <span style={{ fontSize: "13px", fontWeight: 800, color: "#4BAED6", letterSpacing: "2px", textTransform: "uppercase" as const }}>
            FLASHYAF™ RESEARCH
          </span>
          <h1 style={s.title}>Real Women. Real Data.</h1>
          <p style={s.subtitle}>
            Anonymized aggregate statistics collected from FLASHYAF™ users who have consented to contribute
            to menopause research. No personal data is stored or shared.
          </p>
          <div style={s.consentBadge}>
            <span style={{ fontSize: "14px" }}>🔒</span>
            <p style={s.consentText}>All data is anonymized and collected with full user consent.</p>
          </div>
        </div>

        {error && (
          <div style={s.errorCard}>
            <p style={{ color: "#FF6B6B", fontWeight: 700, margin: 0 }}>
              Could not load live data. Please try again later.
            </p>
          </div>
        )}

        {/* Live Stats Grid */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
          <div style={s.sectionLabel}>📊 Live Community Statistics</div>
          {cacheAge && (
            <span style={{ color: "rgba(255,255,255,0.25)", fontSize: "11px", fontWeight: 600, flexShrink: 0 }}>
              Updated {cacheAge}
            </span>
          )}
        </div>
        <div style={s.statsGrid}>
          <StatCard
            loading={stats.loading}
            number={stats.totalFlashes.toLocaleString()}
            label="Total Flashes Tracked"
            sub="Across all active users"
            color="#FF4500"
            icon="🔥"
          />
          <StatCard
            loading={stats.loading}
            number={`${stats.avgDurationMin}m ${stats.avgDurationSec}s`}
            label="Average Flash Duration"
            sub="Community average"
            color="#E91E8C"
            icon="⏱️"
          />
          <StatCard
            loading={stats.loading}
            number={stats.peakTimeBlock}
            label="Peak Time of Day"
            sub="When flashes occur most"
            color="#9B59B6"
            icon="🕐"
          />
          <StatCard
            loading={stats.loading}
            number={stats.avgIntensity > 0 ? `${stats.avgIntensity}/10` : "—"}
            label="Average Peak Intensity"
            sub="Self-reported severity"
            color="#E74C3C"
            icon="📈"
          />
          <StatCard
            loading={stats.loading}
            number={`${stats.daysOfData.toLocaleString()}+`}
            label="Days of Data Collected"
            sub="Continuous tracking history"
            color="#2980B9"
            icon="📅"
          />
          <StatCard
            loading={stats.loading}
            number={stats.totalUsers > 0 ? stats.totalUsers.toLocaleString() : "—"}
            label="Active Trackers"
            sub="Women contributing data"
            color="#27AE60"
            icon="👩"
          />
        </div>

        {/* Body Areas */}
        {!stats.loading && stats.topBodyAreas.length > 0 && (
          <div style={s.bodyAreaCard}>
            <p style={s.cardLabel}>🧠 Most Reported Symptom Areas</p>
            <p style={s.cardSub}>Based on areas users tag during flash logging</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "14px" }}>
              {stats.topBodyAreas.map((area) => (
                <div key={area.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                    <span style={{ color: "rgba(255,255,255,0.8)", fontSize: "13px", fontWeight: 700 }}>{area.label}</span>
                    <span style={{ color: "#E91E8C", fontSize: "13px", fontWeight: 900 }}>{area.pct}%</span>
                  </div>
                  <div style={{ height: "6px", borderRadius: "100px", background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: "100px",
                      width: `${area.pct}%`,
                      background: "linear-gradient(90deg, #E91E8C, #9B59B6)",
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Methodology */}
        <div style={s.methodCard}>
          <p style={s.cardLabel}>📋 Data & Methodology</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "10px" }}>
            {[
              "Statistics are computed in real time from anonymized flash records.",
              "No names, email addresses, or device identifiers are included in aggregate queries.",
              "Users explicitly consent to anonymous data sharing during onboarding.",
              "Body area data reflects user self-reports during active flash tracking.",
              "Duration and intensity averages exclude outliers above 2 standard deviations.",
              "Stats are refreshed live for logged-in users and cached for public visitors — no personal records ever leave the device.",
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <span style={{ color: "#2980B9", fontSize: "13px", fontWeight: 900, flexShrink: 0, marginTop: "1px" }}>✓</span>
                <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "13px", lineHeight: 1.6, margin: 0 }}>{item}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Research CTA */}
        <div style={s.ctaCard}>
          <p style={s.ctaTitle}>🔬 Interested in partnering with FLASHYAF™?</p>
          <p style={s.ctaText}>
            We are building the largest anonymized dataset of lived menopause experiences in the US.
            If you are a researcher, institution, or grant reviewer interested in data access or collaboration,
            we would love to hear from you.
          </p>
          <a href="mailto:iva@brownworks4u2.com?subject=Research%20Partnership%20Inquiry" style={s.ctaBtn}>
            Contact Our Research Team →
          </a>
        </div>

        {/* Footer */}
        <div style={s.footer}>
          <p style={s.footerLogo}>FLASHYAF™</p>
          <p style={s.footerText}>
            BROWNWORKS4U2 LLC · Data updated in real time · No personal information shared
          </p>
          <a href="/" style={s.footerLink}>← Back to App</a>
        </div>
      </div>
    </div>
  );
}

function StatCard({ loading, number, label, sub, color, icon }: {
  loading: boolean; number: string; label: string; sub: string; color: string; icon: string;
}) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: `1px solid ${color}30`,
      borderRadius: "18px", padding: "18px 16px",
      display: "flex", flexDirection: "column" as const, gap: "6px",
      boxShadow: `0 0 30px ${color}08`,
    }}>
      <span style={{ fontSize: "24px", lineHeight: 1 }}>{icon}</span>
      {loading ? (
        <div style={{ height: "28px", background: "rgba(255,255,255,0.06)", borderRadius: "8px", width: "70%", animation: "pulse 1.4s ease infinite" }} />
      ) : (
        <p style={{ color, fontSize: "22px", fontWeight: 900, margin: 0, lineHeight: 1.1, fontFamily: "'Inter', sans-serif" }}>{number}</p>
      )}
      <p style={{ color: "#fff", fontSize: "13px", fontWeight: 800, margin: 0, lineHeight: 1.3 }}>{label}</p>
      <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "11px", fontWeight: 500, margin: 0 }}>{sub}</p>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100dvh",
    background: "#0A0A0A",
    fontFamily: "'Inter', sans-serif",
    color: "#fff",
    overflowX: "hidden" as const,
  },
  inner: {
    maxWidth: "680px",
    margin: "0 auto",
    padding: "48px 20px 64px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "24px",
  },
  header: {
    display: "flex", flexDirection: "column" as const, gap: "12px",
  },
  title: {
    fontSize: "36px", fontWeight: 900, margin: 0,
    lineHeight: 1.15,
    background: "linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.7) 100%)",
    WebkitBackgroundClip: "text" as const,
    WebkitTextFillColor: "transparent" as const,
  },
  subtitle: {
    color: "rgba(255,255,255,0.55)", fontSize: "15px",
    lineHeight: 1.7, margin: 0,
  },
  consentBadge: {
    display: "flex", alignItems: "center", gap: "10px",
    background: "rgba(41,128,185,0.1)",
    border: "1px solid rgba(41,128,185,0.3)",
    borderRadius: "100px", padding: "9px 16px",
    alignSelf: "flex-start",
  },
  consentText: {
    color: "#4BAED6", fontSize: "13px", fontWeight: 700, margin: 0,
  },
  sectionLabel: {
    color: "rgba(255,255,255,0.4)", fontSize: "12px", fontWeight: 800,
    letterSpacing: "1px", textTransform: "uppercase" as const,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: "12px",
  },
  errorCard: {
    background: "rgba(231,76,60,0.08)", border: "1px solid rgba(231,76,60,0.25)",
    borderRadius: "14px", padding: "14px",
  },
  bodyAreaCard: {
    background: "rgba(233,30,140,0.05)",
    border: "1px solid rgba(233,30,140,0.2)",
    borderRadius: "18px", padding: "20px",
  },
  cardLabel: {
    color: "#fff", fontSize: "15px", fontWeight: 900, margin: "0 0 4px",
  },
  cardSub: {
    color: "rgba(255,255,255,0.4)", fontSize: "12px",
    lineHeight: 1.5, margin: 0,
  },
  methodCard: {
    background: "rgba(41,128,185,0.05)",
    border: "1px solid rgba(41,128,185,0.2)",
    borderRadius: "18px", padding: "20px",
  },
  ctaCard: {
    background: "linear-gradient(135deg, rgba(41,128,185,0.1), rgba(31,97,141,0.08))",
    border: "1px solid rgba(41,128,185,0.3)",
    borderRadius: "18px", padding: "24px",
    display: "flex", flexDirection: "column" as const, gap: "12px",
  },
  ctaTitle: {
    color: "#fff", fontSize: "18px", fontWeight: 900, margin: 0,
  },
  ctaText: {
    color: "rgba(255,255,255,0.6)", fontSize: "14px",
    lineHeight: 1.7, margin: 0,
  },
  ctaBtn: {
    display: "inline-block",
    background: "linear-gradient(135deg, #2980B9, #1F618D)",
    borderRadius: "12px", color: "#fff",
    fontSize: "14px", fontWeight: 900,
    padding: "13px 22px", textDecoration: "none",
    alignSelf: "flex-start",
    boxShadow: "0 4px 20px rgba(41,128,185,0.35)",
  },
  footer: {
    display: "flex", flexDirection: "column" as const, alignItems: "center", gap: "6px",
    paddingTop: "16px", borderTop: "1px solid rgba(255,255,255,0.06)",
  },
  footerLogo: {
    color: "var(--color-accent, #FF4500)", fontSize: "16px", fontWeight: 900,
    letterSpacing: "3px", margin: 0,
  },
  footerText: {
    color: "rgba(255,255,255,0.25)", fontSize: "11px",
    textAlign: "center" as const, margin: 0, lineHeight: 1.6,
  },
  footerLink: {
    color: "#4BAED6", fontSize: "13px", fontWeight: 700,
    textDecoration: "none", marginTop: "4px",
  },
};
