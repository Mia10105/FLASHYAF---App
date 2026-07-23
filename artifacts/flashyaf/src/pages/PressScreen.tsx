import { useState, useEffect } from "react";
import { collection, getCountFromServer } from "firebase/firestore";
import { db } from "@/lib/firebase";

const PRESS_CONTACT = "press@flashyafapp.com";

const MARKET_FACTS = [
  { stat: "1 Billion+", label: "Women globally entering menopause by 2025", source: "WHO" },
  { stat: "47 Million", label: "Women in the U.S. currently in perimenopause or menopause", source: "NAMS" },
  { stat: "$600B+", label: "Projected global femtech market size by 2030", source: "Fortune Business Insights" },
  { stat: "3–10 Years", label: "Average duration of menopause symptoms", source: "Mayo Clinic" },
  { stat: "75%", label: "Of menopausal women experience hot flashes", source: "NAMS" },
  { stat: "$26B", label: "Annual cost of menopause-related lost productivity in the U.S.", source: "Mayo Clinic Proceedings 2023" },
];

const APP_FEATURES = [
  { icon: "🎙️", title: "Voice-Activated Logging", desc: "Say \"Hey Flashy, flash started\" hands-free during a hot flash episode." },
  { icon: "📊", title: "Pattern Intelligence", desc: "AI-powered analysis of triggers, duration, severity, and time-of-day patterns." },
  { icon: "💜", title: "Community", desc: "Moderated community feed, featured stories, humor bank, and encouragement hall." },
  { icon: "📋", title: "Monthly Reports", desc: "Exportable PDF-ready reports to share with healthcare providers." },
  { icon: "🔥", title: "Real-Time Tracking", desc: "Live timer with stage progression: Started → Peak → Cooling Down → Normal." },
  { icon: "🔔", title: "Smart Notifications", desc: "Reminders, daily check-ins, and open-flash alerts." },
];

const BRAND_ASSETS = [
  { name: "Primary Logo", desc: "FLASHYAF™ wordmark in #FF4500 on dark background" },
  { name: "App Icon", desc: "🔥 flame icon, works on dark and light backgrounds" },
  { name: "Brand Colors", desc: "Background #0A0A0A · Primary Red #C0392B · Accent Orange #FF4500 · Purple #8E44AD" },
  { name: "Typography", desc: "Inter (interface) · System display font (headings)" },
  { name: "Taglines", desc: '"Your hot flash. Your data. Your power." · "Real-Time Relief. Real-Life Support."' },
];

function generatePressKit(waitlistCount: number | null): string {
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  return `FLASHYAF™ PRESS KIT
Generated: ${date}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

COMPANY OVERVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Company Name: BROWNWORKS4U2 LLC
Product: FLASHYAF™
Category: Women's Health / FemTech / Mobile Application
Platform: Web App (iOS Safari / Android Chrome optimized)
Launch Year: 2026
Headquarters: United States
Website: https://flashyafapp.com
Press Contact: ${PRESS_CONTACT}

ABOUT FLASHYAF™
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FLASHYAF™ is a mobile-first hot flash tracker for women navigating menopause.
Built for the 1 in 2 women who will experience significant menopause symptoms,
FLASHYAF™ gives women the tools to understand, document, and share their
menopause journey — on their terms.

Key features include hands-free voice logging ("Hey Flashy"), real-time flash
tracking with stage progression, AI-powered pattern intelligence, exportable
monthly health reports for healthcare providers, and a moderated community
with hot moments, featured stories, and a humor bank.

Tagline: "Your hot flash. Your data. Your power."
Secondary: "Real-Time Relief. Real-Life Support."

${waitlistCount ? `WAITLIST\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${waitlistCount.toLocaleString()} women currently on the waitlist\nWaitlist URL: https://flashyafapp.com/waitlist\n` : ""}
FOUNDER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Iva Marie Brown-Ziegler
Founder & CEO, BROWNWORKS4U2 LLC

Iva Marie Brown-Ziegler founded BROWNWORKS4U2 LLC and created FLASHYAF™ out
of personal necessity — frustrated by the lack of practical, stigma-free tools
for women managing menopause. Her vision is a world where every woman has
access to real-time data about her own body, the language to discuss it with
her doctor, and a community of women who truly understand.

A champion of women's health data ownership, Iva built FLASHYAF™ with a
mobile-first, privacy-forward approach: your health data belongs to you,
full stop.

Contact: iva@brownworks4u2.com

KEY MARKET FACTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• 1 Billion+ women globally entering menopause by 2025 (WHO)
• 47 Million women in the U.S. currently in perimenopause or menopause (NAMS)
• $600B+ projected global femtech market by 2030 (Fortune Business Insights)
• 75% of menopausal women experience hot flashes (NAMS)
• $26B annual cost of menopause-related lost productivity in the U.S. (Mayo Clinic Proceedings 2023)
• Average hot flash lasts 3–10 minutes; symptoms can last 3–10 years (Mayo Clinic)

APP FEATURES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Voice-Activated Logging — Say "Hey Flashy, flash started" hands-free
• Pattern Intelligence — AI-powered trigger, duration & severity analysis
• Community — Moderated feed, stories, humor bank, encouragement hall
• Monthly Reports — Exportable summaries for healthcare providers
• Real-Time Tracking — Stage progression: Started → Peak → Cooling → Normal
• Smart Notifications — Reminders, check-ins, and open-flash alerts

BRAND ASSETS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Primary Logo: FLASHYAF™ wordmark in #FF4500 on dark background
App Icon: 🔥 flame icon
Brand Colors: Background #0A0A0A | Primary #C0392B | Accent #FF4500 | Purple #8E44AD
Typography: Inter (interface)
Taglines:
  "Your hot flash. Your data. Your power."
  "Real-Time Relief. Real-Life Support."

For high-resolution brand assets, contact: ${PRESS_CONTACT}

PRESS CONTACT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Email: ${PRESS_CONTACT}
Company: BROWNWORKS4U2 LLC
Response time: Within 2 business days

© 2026 BROWNWORKS4U2 LLC. All rights reserved. FLASHYAF™ is a trademark of BROWNWORKS4U2 LLC.
`;
}

export default function PressScreen() {
  const [waitlistCount, setWaitlistCount] = useState<number | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    getCountFromServer(collection(db, "waitlist"))
      .then((snap) => setWaitlistCount(snap.data().count))
      .catch(() => {});
  }, []);

  function handleDownload() {
    setDownloading(true);
    const text = generatePressKit(waitlistCount);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "FLASHYAF-Press-Kit.txt";
    a.click();
    URL.revokeObjectURL(url);
    setTimeout(() => setDownloading(false), 1500);
  }

  return (
    <div style={s.page}>
      <div style={s.inner}>

        {/* Header */}
        <div style={s.header}>
          <div style={s.logoRow}>
            <span style={s.flameIcon}>🔥</span>
            <div>
              <p style={s.brand}>FLASHYAF™</p>
              <p style={s.brandSub}>by BROWNWORKS4U2 LLC</p>
            </div>
          </div>
          <div style={s.pressBadge}>PRESS &amp; MEDIA KIT</div>
          <p style={s.headerTagline}>"Your hot flash. Your data. Your power."</p>
          <p style={s.headerMeta}>
            For media inquiries, interview requests, or brand assets —
            contact{" "}
            <a href={`mailto:${PRESS_CONTACT}`} style={s.emailLink}>
              {PRESS_CONTACT}
            </a>
          </p>
          <button
            style={{ ...s.downloadBtn, opacity: downloading ? 0.7 : 1 }}
            onClick={handleDownload}
            disabled={downloading}
          >
            {downloading ? "Generating…" : "⬇ Download Press Kit (.txt)"}
          </button>
        </div>

        {/* Company Overview */}
        <Section title="Company Overview" icon="🏢">
          <div style={s.overviewGrid}>
            {[
              { label: "Company", value: "BROWNWORKS4U2 LLC" },
              { label: "Product", value: "FLASHYAF™" },
              { label: "Category", value: "Women's Health · FemTech" },
              { label: "Platform", value: "Web App (iOS & Android optimized)" },
              { label: "Launch Year", value: "2026" },
              { label: "Headquarters", value: "United States" },
              { label: "Website", value: "flashyafapp.com" },
              { label: "Press Contact", value: PRESS_CONTACT },
            ].map(({ label, value }) => (
              <div key={label} style={s.overviewRow}>
                <span style={s.overviewLabel}>{label}</span>
                <span style={s.overviewValue}>{value}</span>
              </div>
            ))}
          </div>
          <p style={s.overviewDesc}>
            FLASHYAF™ is a mobile-first hot flash tracker for women navigating menopause.
            Built for the 1 in 2 women who will experience significant menopause symptoms,
            FLASHYAF™ gives women the tools to understand, document, and share their
            menopause journey — on their terms.
          </p>
        </Section>

        {/* Founder Bio */}
        <Section title="Founder" icon="👩‍💼">
          <div style={s.founderCard}>
            <div style={s.founderAvatar}>
              <span style={{ fontSize: "36px" }}>👩🏾‍💼</span>
            </div>
            <div style={s.founderInfo}>
              <p style={s.founderName}>Iva Marie Brown-Ziegler</p>
              <p style={s.founderRole}>Founder &amp; CEO, BROWNWORKS4U2 LLC</p>
            </div>
          </div>
          <p style={s.bioText}>
            Iva Marie Brown-Ziegler founded BROWNWORKS4U2 LLC and created FLASHYAF™ out
            of personal necessity — frustrated by the lack of practical, stigma-free tools
            for women managing menopause. Her vision is a world where every woman has
            access to real-time data about her own body, the language to discuss it with
            her doctor, and a community of women who truly understand.
          </p>
          <p style={s.bioText}>
            A champion of women's health data ownership, Iva built FLASHYAF™ with a
            mobile-first, privacy-forward approach: your health data belongs to you,
            full stop.
          </p>
          <a href="mailto:iva@brownworks4u2.com" style={s.founderContactBtn}>
            ✉️ Request founder interview
          </a>
        </Section>

        {/* App Statistics */}
        <Section title="App at a Glance" icon="📊">
          <div style={s.statsGrid}>
            {[
              { num: "2026", label: "Launch Year" },
              { num: "5", label: "Community tabs" },
              { num: "6", label: "Stage-tracked flash phases" },
              { num: waitlistCount !== null ? waitlistCount.toLocaleString() : "—", label: "Waitlist signups", highlight: true },
              { num: "Monthly", label: "Exportable health reports" },
              { num: "iOS + Android", label: "Mobile browsers supported" },
            ].map(({ num, label, highlight }) => (
              <div key={label} style={{ ...s.statCard, ...(highlight ? s.statCardHighlight : {}) }}>
                <p style={{ ...s.statNum, ...(highlight ? s.statNumHighlight : {}) }}>{num}</p>
                <p style={s.statLabel}>{label}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Market Facts */}
        <Section title="Menopause Market" icon="🌍">
          <p style={s.sectionIntro}>
            The menopause health market is one of the most underserved and fastest-growing
            segments in women's health. Here are the key facts:
          </p>
          <div style={s.factsGrid}>
            {MARKET_FACTS.map(({ stat, label, source }) => (
              <div key={stat} style={s.factCard}>
                <p style={s.factStat}>{stat}</p>
                <p style={s.factLabel}>{label}</p>
                <p style={s.factSource}>Source: {source}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Key Features */}
        <Section title="Key Features" icon="✨">
          <div style={s.featuresGrid}>
            {APP_FEATURES.map(({ icon, title, desc }) => (
              <div key={title} style={s.featureCard}>
                <span style={s.featureIcon}>{icon}</span>
                <p style={s.featureTitle}>{title}</p>
                <p style={s.featureDesc}>{desc}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Brand Assets */}
        <Section title="Brand Assets" icon="🎨">
          <p style={s.sectionIntro}>
            For high-resolution logos, screenshots, and brand guidelines,
            contact{" "}
            <a href={`mailto:${PRESS_CONTACT}`} style={s.emailLink}>
              {PRESS_CONTACT}
            </a>
          </p>
          <div style={s.assetsGrid}>
            {BRAND_ASSETS.map(({ name, desc }) => (
              <div key={name} style={s.assetRow}>
                <p style={s.assetName}>{name}</p>
                <p style={s.assetDesc}>{desc}</p>
              </div>
            ))}
          </div>
          <div style={s.colorSwatches}>
            {[
              { hex: "#0A0A0A", label: "Background" },
              { hex: "#C0392B", label: "Primary" },
              { hex: "#FF4500", label: "Accent" },
              { hex: "#8E44AD", label: "Purple" },
            ].map(({ hex, label }) => (
              <div key={hex} style={s.swatch}>
                <div style={{ ...s.swatchBlock, background: hex, border: hex === "#0A0A0A" ? "1px solid rgba(255,255,255,0.15)" : "none" }} />
                <p style={s.swatchHex}>{hex}</p>
                <p style={s.swatchLabel}>{label}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Press Contact */}
        <div style={s.contactCard}>
          <span style={s.contactIcon}>📬</span>
          <p style={s.contactTitle}>Press Contact</p>
          <p style={s.contactSub}>
            For interviews, review access, high-res assets, or partnership inquiries —
            we respond within 2 business days.
          </p>
          <a href={`mailto:${PRESS_CONTACT}?subject=Press%20Inquiry%20%E2%80%94%20FLASHYAF%E2%84%A2`} style={s.contactBtn}>
            ✉️ {PRESS_CONTACT}
          </a>
        </div>

        {/* Footer */}
        <div style={s.footer}>
          <a href="/" style={s.footerAppLink}>Open FLASHYAF™ App →</a>
          <p style={s.footerText}>
            © 2026 BROWNWORKS4U2 LLC · FLASHYAF™ is a registered trademark.
          </p>
        </div>

      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={s.section}>
      <div style={s.sectionHeader}>
        <span style={s.sectionIcon}>{icon}</span>
        <p style={s.sectionTitle}>{title}</p>
      </div>
      <div style={s.sectionBody}>{children}</div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100dvh",
    background: "var(--color-bg)",
    fontFamily: "'Inter', sans-serif",
    color: "#fff",
  },
  inner: {
    maxWidth: "680px",
    margin: "0 auto",
    padding: "0 16px 60px",
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },

  // Header
  header: {
    padding: "40px 0 24px",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },
  logoRow: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
  },
  flameIcon: { fontSize: "40px", lineHeight: 1 },
  brand: {
    color: "var(--color-accent)",
    fontSize: "26px",
    fontWeight: 900,
    letterSpacing: "3px",
    margin: 0,
  },
  brandSub: {
    color: "rgba(255,255,255,0.35)",
    fontSize: "12px",
    fontWeight: 600,
    margin: "2px 0 0",
    letterSpacing: "0.5px",
  },
  pressBadge: {
    display: "inline-block",
    background: "rgba(255,69,0,0.1)",
    border: "1px solid rgba(255,69,0,0.25)",
    borderRadius: "6px",
    color: "var(--color-accent)",
    fontSize: "11px",
    fontWeight: 900,
    letterSpacing: "2px",
    padding: "5px 12px",
    alignSelf: "flex-start",
  },
  headerTagline: {
    color: "rgba(255,255,255,0.55)",
    fontSize: "16px",
    fontStyle: "italic",
    margin: 0,
    lineHeight: 1.5,
  },
  headerMeta: {
    color: "rgba(255,255,255,0.4)",
    fontSize: "13px",
    lineHeight: 1.6,
    margin: 0,
  },
  emailLink: {
    color: "var(--color-accent)",
    textDecoration: "none",
    fontWeight: 600,
  },
  downloadBtn: {
    alignSelf: "flex-start",
    background: "linear-gradient(135deg, #C0392B, #FF4500)",
    border: "none",
    borderRadius: "10px",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 800,
    padding: "12px 22px",
    cursor: "pointer",
    fontFamily: "'Inter', sans-serif",
    letterSpacing: "0.2px",
    boxShadow: "0 3px 16px rgba(255,69,0,0.3)",
  },

  // Sections
  section: {
    background: "#111",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: "18px",
    overflow: "hidden",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "16px 20px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(255,255,255,0.02)",
  },
  sectionIcon: { fontSize: "18px" },
  sectionTitle: {
    color: "#fff",
    fontSize: "14px",
    fontWeight: 800,
    margin: 0,
    textTransform: "uppercase" as const,
    letterSpacing: "1.5px",
  },
  sectionBody: { padding: "18px 20px", display: "flex", flexDirection: "column", gap: "14px" },
  sectionIntro: {
    color: "rgba(255,255,255,0.5)",
    fontSize: "13px",
    lineHeight: 1.65,
    margin: 0,
  },

  // Overview
  overviewGrid: {
    display: "flex",
    flexDirection: "column",
    gap: "0",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: "12px",
    overflow: "hidden",
  },
  overviewRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
    padding: "10px 14px",
    borderBottom: "1px solid rgba(255,255,255,0.04)",
  },
  overviewLabel: {
    color: "rgba(255,255,255,0.35)",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.3px",
    flexShrink: 0,
  },
  overviewValue: {
    color: "rgba(255,255,255,0.8)",
    fontSize: "12px",
    fontWeight: 600,
    textAlign: "right" as const,
  },
  overviewDesc: {
    color: "rgba(255,255,255,0.55)",
    fontSize: "13px",
    lineHeight: 1.7,
    margin: 0,
  },

  // Founder
  founderCard: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: "14px",
    padding: "14px",
  },
  founderAvatar: {
    width: "60px",
    height: "60px",
    borderRadius: "50%",
    background: "rgba(142,68,173,0.15)",
    border: "1px solid rgba(142,68,173,0.3)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  founderInfo: { display: "flex", flexDirection: "column", gap: "3px" },
  founderName: { color: "#fff", fontSize: "16px", fontWeight: 900, margin: 0 },
  founderRole: { color: "rgba(255,255,255,0.45)", fontSize: "12px", fontWeight: 600, margin: 0 },
  bioText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: "13px",
    lineHeight: 1.75,
    margin: 0,
  },
  founderContactBtn: {
    display: "inline-block",
    background: "rgba(142,68,173,0.12)",
    border: "1px solid rgba(142,68,173,0.3)",
    borderRadius: "10px",
    color: "#C39BD3",
    fontSize: "13px",
    fontWeight: 700,
    padding: "10px 18px",
    textDecoration: "none",
    alignSelf: "flex-start",
  },

  // Stats
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "10px",
  },
  statCard: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: "14px",
    padding: "16px 14px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  statCardHighlight: {
    background: "rgba(255,69,0,0.07)",
    border: "1px solid rgba(255,69,0,0.2)",
  },
  statNum: {
    color: "#fff",
    fontSize: "22px",
    fontWeight: 900,
    margin: 0,
    lineHeight: 1.1,
  },
  statNumHighlight: { color: "var(--color-accent)" },
  statLabel: {
    color: "rgba(255,255,255,0.4)",
    fontSize: "11px",
    fontWeight: 600,
    margin: 0,
    lineHeight: 1.4,
  },

  // Market facts
  factsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: "10px",
  },
  factCard: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: "14px",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "5px",
  },
  factStat: {
    color: "var(--color-accent)",
    fontSize: "20px",
    fontWeight: 900,
    margin: 0,
    lineHeight: 1.1,
  },
  factLabel: {
    color: "rgba(255,255,255,0.75)",
    fontSize: "12px",
    fontWeight: 600,
    lineHeight: 1.45,
    margin: 0,
  },
  factSource: {
    color: "rgba(255,255,255,0.25)",
    fontSize: "10px",
    fontWeight: 600,
    margin: 0,
    marginTop: "2px",
  },

  // Features
  featuresGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
    gap: "10px",
  },
  featureCard: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: "14px",
    padding: "14px",
    display: "flex",
    flexDirection: "column",
    gap: "5px",
  },
  featureIcon: { fontSize: "22px", lineHeight: 1 },
  featureTitle: {
    color: "#fff",
    fontSize: "13px",
    fontWeight: 800,
    margin: 0,
  },
  featureDesc: {
    color: "rgba(255,255,255,0.45)",
    fontSize: "12px",
    lineHeight: 1.5,
    margin: 0,
  },

  // Brand assets
  assetsGrid: {
    display: "flex",
    flexDirection: "column",
    gap: "0",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: "12px",
    overflow: "hidden",
  },
  assetRow: {
    padding: "12px 14px",
    borderBottom: "1px solid rgba(255,255,255,0.04)",
  },
  assetName: {
    color: "rgba(255,255,255,0.7)",
    fontSize: "12px",
    fontWeight: 800,
    margin: "0 0 3px",
    letterSpacing: "0.3px",
  },
  assetDesc: {
    color: "rgba(255,255,255,0.4)",
    fontSize: "12px",
    lineHeight: 1.5,
    margin: 0,
  },
  colorSwatches: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap" as const,
  },
  swatch: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "5px",
  },
  swatchBlock: {
    width: "44px",
    height: "44px",
    borderRadius: "10px",
  },
  swatchHex: {
    color: "rgba(255,255,255,0.5)",
    fontSize: "10px",
    fontWeight: 700,
    margin: 0,
    fontFamily: "monospace",
  },
  swatchLabel: {
    color: "rgba(255,255,255,0.3)",
    fontSize: "10px",
    fontWeight: 600,
    margin: 0,
  },

  // Contact
  contactCard: {
    background: "linear-gradient(135deg, rgba(192,57,43,0.12), rgba(255,69,0,0.06))",
    border: "1px solid rgba(255,69,0,0.2)",
    borderRadius: "18px",
    padding: "28px 24px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "12px",
    textAlign: "center" as const,
  },
  contactIcon: { fontSize: "36px" },
  contactTitle: {
    color: "#fff",
    fontSize: "20px",
    fontWeight: 900,
    margin: 0,
  },
  contactSub: {
    color: "rgba(255,255,255,0.5)",
    fontSize: "13px",
    lineHeight: 1.6,
    margin: 0,
  },
  contactBtn: {
    display: "inline-block",
    background: "linear-gradient(135deg, #C0392B, #FF4500)",
    border: "none",
    borderRadius: "12px",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 800,
    padding: "14px 28px",
    textDecoration: "none",
    marginTop: "4px",
    boxShadow: "0 4px 20px rgba(255,69,0,0.3)",
  },

  // Footer
  footer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    paddingTop: "8px",
  },
  footerAppLink: {
    color: "rgba(255,255,255,0.3)",
    fontSize: "13px",
    fontWeight: 600,
    textDecoration: "none",
  },
  footerText: {
    color: "rgba(255,255,255,0.18)",
    fontSize: "11px",
    margin: 0,
    textAlign: "center" as const,
  },
};
