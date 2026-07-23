import { useState } from "react";

interface Props {
  onBack: () => void;
}

const PRIVACY_TEXT = `Effective Date: May 3, 2026

BROWNWORKS4U2 LLC ("we," "our," or "us") built FLASHYAF™ as a personal health tracking application. This Privacy Policy describes how we collect, use, and protect your information.

INFORMATION WE COLLECT
• Account data: email address used to create your account
• Health data you enter: hot flash logs, daily check-in responses, and self-reported symptoms
• Usage data: app interactions, feature usage, and session frequency

HOW WE USE YOUR INFORMATION
• To provide and improve the FLASHYAF™ experience
• To generate personalized insights from your logged data
• To communicate with you about your account or product updates
• We do not sell, rent, or share your personal health data with third parties for advertising

DATA STORAGE & SECURITY
Your data is stored securely using Google Firebase (Firestore), protected by industry-standard encryption in transit and at rest. You may request deletion of all your data at any time from Settings → Delete My Data.

YOUR RIGHTS
• Access your data at any time through the app
• Delete all your data permanently from Settings
• Contact us at privacy@flashyafapp.com with any privacy questions

CHILDREN'S PRIVACY
FLASHYAF™ is not intended for users under 18 years of age.

CHANGES TO THIS POLICY
We may update this policy periodically. We will notify you of significant changes via the app.

Contact: privacy@flashyafapp.com
BROWNWORKS4U2 LLC`;

const TERMS_TEXT = `Effective Date: May 3, 2026

Welcome to FLASHYAF™, operated by BROWNWORKS4U2 LLC.

ACCEPTANCE OF TERMS
By using this application, you agree to these Terms of Service. If you do not agree, please do not use the app.

NOT MEDICAL ADVICE
FLASHYAF™ is a personal health tracking tool and is NOT a substitute for professional medical advice, diagnosis, or treatment. Always consult a qualified healthcare provider regarding menopause symptoms or any health concern.

YOUR ACCOUNT
You are responsible for maintaining the confidentiality of your account credentials. You agree to notify us immediately of any unauthorized use.

ACCEPTABLE USE
You agree not to:
• Use the app for any unlawful purpose
• Attempt to access other users' data
• Reverse-engineer or misappropriate any part of the application

COMMUNITY CONDUCT
Posts in the Community section must be respectful and supportive. We reserve the right to remove content that is harmful, abusive, or violates these terms.

INTELLECTUAL PROPERTY
FLASHYAF™, its design, branding, and content are owned by BROWNWORKS4U2 LLC. You may not reproduce or distribute any part of the app without written permission.

LIMITATION OF LIABILITY
To the maximum extent permitted by law, BROWNWORKS4U2 LLC is not liable for any indirect, incidental, or consequential damages arising from your use of the app.

TERMINATION
We reserve the right to suspend or terminate accounts that violate these terms.

GOVERNING LAW
These terms are governed by the laws of the United States.

Contact: iva@brownworks4u2.com
BROWNWORKS4U2 LLC`;

export default function AboutScreen({ onBack }: Props) {
  const [modal, setModal] = useState<null | "privacy" | "terms">(null);

  return (
    <div style={s.container}>
      {/* ── Legal modal ── */}
      {modal && (
        <div style={s.modalBackdrop} onClick={() => setModal(null)}>
          <div style={s.modalSheet} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <p style={s.modalTitle}>
                {modal === "privacy" ? "Privacy Policy" : "Terms of Service"}
              </p>
              <button style={s.modalClose} onClick={() => setModal(null)}>✕</button>
            </div>
            <div style={s.modalBody}>
              <p style={s.modalText}>
                {modal === "privacy" ? PRIVACY_TEXT : TERMS_TEXT}
              </p>
            </div>
            <div style={s.modalFooter}>
              <p style={s.modalFooterNote}>
                Full legal documents will be published at flashyafapp.com prior to public launch.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div style={s.header}>
        <button style={s.backBtn} onClick={onBack}>‹ Settings</button>
        <p style={s.headerTitle}>About</p>
        <div style={{ width: "72px" }} />
      </div>

      {/* ── Scrollable content ── */}
      <div style={s.content}>

        {/* Hero */}
        <div style={s.hero}>
          <div style={s.glowRing} />
          <div style={s.logoCircle}>
            <span style={s.logoEmoji}>🔥</span>
          </div>
          <p style={s.appName}>FLASHYAF™</p>
          <p style={s.tagline}>Real-Time Relief · Real-Life Support</p>
          <div style={s.versionBadge}>
            <span style={s.versionText}>v1.0 MVP</span>
          </div>
        </div>

        {/* Mission */}
        <div style={s.card}>
          <p style={s.cardLabel}>Our Mission</p>
          <p style={s.missionText}>
            To give every woman navigating menopause the data, clarity, and community to feel <em style={{ color: "var(--color-accent)", fontStyle: "normal", fontWeight: 700 }}>empowered</em> — not ambushed — by her own body.
          </p>
          <p style={s.missionSub}>
            Hot flashes don't warn you. FLASHYAF does.
          </p>
        </div>

        {/* Company info */}
        <div style={s.card}>
          <p style={s.cardLabel}>Company</p>
          <div style={s.infoRows}>
            <InfoRow icon="🏢" label="Company" value="BROWNWORKS4U2 LLC" />
            <InfoRow icon="👩‍💼" label="Founder" value="Iva Marie Brown-Ziegler" />
            <InfoRow icon="📍" label="Headquarters" value="United States" />
            <InfoRow icon="📦" label="Version" value="1.0 MVP" />
            <InfoRow icon="📅" label="Launched" value="2026" />
          </div>
        </div>

        {/* Contact */}
        <div style={s.card}>
          <p style={s.cardLabel}>Get in Touch</p>
          <p style={s.contactDesc}>
            Questions, feedback, or partnership inquiries? We read every email.
          </p>
          <a
            href="mailto:contact@flashyafapp.com?subject=FLASHYAF%20Inquiry"
            style={s.contactBtn}
          >
            <span style={s.contactBtnIcon}>✉️</span>
            <div style={s.contactBtnText}>
              <span style={s.contactBtnTitle}>Contact Us</span>
              <span style={s.contactBtnSub}>contact@flashyafapp.com</span>
            </div>
            <span style={s.contactBtnArrow}>›</span>
          </a>
        </div>

        {/* Legal */}
        <div style={s.card}>
          <p style={s.cardLabel}>Legal</p>
          <div style={s.legalRow}>
            <button style={s.legalBtn} onClick={() => setModal("privacy")}>
              <span style={s.legalIcon}>🔒</span>
              <span style={s.legalLabel}>Privacy Policy</span>
              <span style={s.legalArrow}>›</span>
            </button>
            <div style={s.legalDivider} />
            <button style={s.legalBtn} onClick={() => setModal("terms")}>
              <span style={s.legalIcon}>📋</span>
              <span style={s.legalLabel}>Terms of Service</span>
              <span style={s.legalArrow}>›</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div style={s.footer}>
          <p style={s.footerLine}>🔥 FLASHYAF™ · Made with 💜 for the 1 in 2</p>
          <p style={s.footerSub}>© 2026 BROWNWORKS4U2 LLC. All rights reserved.</p>
        </div>

      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={ir.row}>
      <span style={ir.icon}>{icon}</span>
      <span style={ir.label}>{label}</span>
      <span style={ir.value}>{value}</span>
    </div>
  );
}

const ir: Record<string, React.CSSProperties> = {
  row: {
    display: "flex", alignItems: "center", gap: "10px",
    padding: "9px 0",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  icon: { fontSize: "16px", flexShrink: 0, width: "22px", textAlign: "center" },
  label: { color: "rgba(255,255,255,0.35)", fontSize: "12px", fontWeight: 600, flex: 1, textTransform: "uppercase", letterSpacing: "0.5px" },
  value: { color: "var(--color-text)", fontSize: "14px", fontWeight: 700, textAlign: "right" },
};

const s: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh", background: "var(--color-bg)",
    display: "flex", flexDirection: "column",
    maxWidth: "480px", margin: "0 auto",
    fontFamily: "'Inter', sans-serif",
  },

  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "16px 20px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    flexShrink: 0,
  },
  backBtn: {
    background: "transparent", border: "none",
    color: "var(--color-accent)", fontSize: "15px",
    fontWeight: 600, cursor: "pointer",
    fontFamily: "'Inter', sans-serif", padding: 0,
  },
  headerTitle: {
    color: "var(--color-text)", fontSize: "17px",
    fontWeight: 800, margin: 0,
  },

  content: {
    flex: 1, overflowY: "auto",
    padding: "24px 20px 48px",
    display: "flex", flexDirection: "column", gap: "16px",
  },

  // Hero
  hero: {
    display: "flex", flexDirection: "column",
    alignItems: "center", gap: "8px",
    padding: "24px 20px 28px",
    background: "var(--color-card)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "20px", position: "relative",
    overflow: "hidden",
  },
  glowRing: {
    position: "absolute", top: "-60px", left: "50%",
    transform: "translateX(-50%)",
    width: "240px", height: "240px", borderRadius: "50%",
    background: "radial-gradient(circle, rgba(245,166,35,0.2) 0%, transparent 70%)",
    pointerEvents: "none",
  },
  logoCircle: {
    width: "84px", height: "84px", borderRadius: "28px",
    background: "linear-gradient(135deg, rgba(245,166,35,0.15) 0%, rgba(231,76,60,0.1) 100%)",
    border: "2px solid rgba(245,166,35,0.3)",
    display: "flex", alignItems: "center", justifyContent: "center",
    position: "relative", zIndex: 1,
  },
  logoEmoji: { fontSize: "48px", lineHeight: 1 },
  appName: {
    color: "var(--color-text)", fontSize: "28px", fontWeight: 900,
    letterSpacing: "3px", margin: 0, position: "relative", zIndex: 1,
  },
  tagline: {
    color: "var(--color-accent)", fontSize: "13px", fontWeight: 700,
    letterSpacing: "0.5px", margin: 0,
    position: "relative", zIndex: 1, textAlign: "center",
  },
  versionBadge: {
    background: "rgba(245,166,35,0.12)", border: "1px solid rgba(245,166,35,0.3)",
    borderRadius: "100px", padding: "4px 14px", marginTop: "4px",
  },
  versionText: { color: "var(--color-accent)", fontSize: "11px", fontWeight: 800, letterSpacing: "1px" },

  // Card
  card: {
    background: "var(--color-card)", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "16px", padding: "16px 18px",
  },
  cardLabel: {
    color: "rgba(255,255,255,0.3)", fontSize: "10px", fontWeight: 800,
    textTransform: "uppercase", letterSpacing: "1.5px",
    margin: "0 0 12px",
  },

  // Mission
  missionText: {
    color: "rgba(255,255,255,0.75)", fontSize: "15px",
    lineHeight: 1.65, margin: "0 0 10px",
  },
  missionSub: {
    color: "rgba(255,255,255,0.35)", fontSize: "12px",
    fontWeight: 600, fontStyle: "italic", margin: 0,
  },

  // Info rows
  infoRows: { display: "flex", flexDirection: "column" },

  // Contact
  contactDesc: {
    color: "rgba(255,255,255,0.45)", fontSize: "13px",
    lineHeight: 1.5, margin: "0 0 12px",
  },
  contactBtn: {
    display: "flex", alignItems: "center", gap: "12px",
    background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.25)",
    borderRadius: "12px", padding: "14px 16px",
    textDecoration: "none",
  },
  contactBtnIcon: { fontSize: "22px", flexShrink: 0 },
  contactBtnText: { flex: 1, display: "flex", flexDirection: "column", gap: "2px" },
  contactBtnTitle: { color: "var(--color-text)", fontSize: "15px", fontWeight: 700 },
  contactBtnSub: { color: "rgba(255,255,255,0.35)", fontSize: "11px", fontWeight: 500 },
  contactBtnArrow: { color: "var(--color-accent)", fontSize: "20px", fontWeight: 300, flexShrink: 0 },

  // Legal
  legalRow: { display: "flex", flexDirection: "column" },
  legalBtn: {
    display: "flex", alignItems: "center", gap: "12px",
    background: "transparent", border: "none",
    padding: "12px 0", cursor: "pointer", width: "100%",
    textAlign: "left", fontFamily: "'Inter', sans-serif",
  },
  legalIcon: { fontSize: "18px", flexShrink: 0, width: "24px", textAlign: "center" },
  legalLabel: { color: "var(--color-text)", fontSize: "14px", fontWeight: 600, flex: 1 },
  legalArrow: { color: "rgba(255,255,255,0.25)", fontSize: "20px", fontWeight: 300 },
  legalDivider: { height: "1px", background: "rgba(255,255,255,0.07)", margin: "0" },

  // Footer
  footer: {
    display: "flex", flexDirection: "column", alignItems: "center",
    gap: "6px", padding: "8px 0",
  },
  footerLine: {
    color: "rgba(255,255,255,0.25)", fontSize: "12px",
    fontWeight: 600, margin: 0, textAlign: "center",
  },
  footerSub: {
    color: "rgba(255,255,255,0.15)", fontSize: "11px",
    margin: 0, textAlign: "center",
  },

  // Modal
  modalBackdrop: {
    position: "fixed", inset: 0, zIndex: 600,
    background: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)",
    display: "flex", alignItems: "flex-end", justifyContent: "center",
  },
  modalSheet: {
    background: "#1C1C1C", borderRadius: "24px 24px 0 0",
    width: "100%", maxWidth: "480px",
    maxHeight: "82vh", display: "flex", flexDirection: "column",
    border: "1px solid rgba(255,255,255,0.1)",
    boxShadow: "0 -16px 48px rgba(0,0,0,0.6)",
  },
  modalHeader: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "18px 20px 14px",
    borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0,
  },
  modalTitle: {
    color: "#fff", fontSize: "17px", fontWeight: 800, margin: 0,
  },
  modalClose: {
    background: "rgba(255,255,255,0.08)", border: "none",
    borderRadius: "50%", width: "30px", height: "30px",
    color: "rgba(255,255,255,0.5)", fontSize: "14px",
    cursor: "pointer", display: "flex", alignItems: "center",
    justifyContent: "center", fontFamily: "'Inter', sans-serif",
    flexShrink: 0,
  },
  modalBody: {
    flex: 1, overflowY: "auto", padding: "20px",
  },
  modalText: {
    color: "rgba(255,255,255,0.55)", fontSize: "12px",
    lineHeight: 1.85, margin: 0, whiteSpace: "pre-line",
    fontFamily: "monospace",
  },
  modalFooter: {
    padding: "14px 20px 32px", flexShrink: 0,
    borderTop: "1px solid rgba(255,255,255,0.07)",
  },
  modalFooterNote: {
    color: "rgba(255,255,255,0.2)", fontSize: "11px",
    fontStyle: "italic", textAlign: "center", margin: 0, lineHeight: 1.5,
  },
};
