import { useState, useEffect } from "react";
import { signOut, updateProfile, deleteUser } from "firebase/auth";
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, query, where, addDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useDemo } from "@/context/DemoContext";
import { emailjsConfigured } from "@/lib/emailPartner";

const REFERRAL_MILESTONES = [
  { count: 1,  icon: "📣", label: "Beta Referrer Badge",                    code: null  },
  { count: 3,  icon: "🛍️", label: "30% off your FLASHYAF™ Shop order",      code: "REFER3" },
  { count: 5,  icon: "⭐", label: "FLASHYAF VIP Badge + Free Premium month*", code: null  },
  { count: 10, icon: "🥇", label: "Founding Ambassador status",               code: null  },
] as const;
type ReferralMilestone = (typeof REFERRAL_MILESTONES)[number];

interface Props {
  onNavigate: (screen: string) => void;
}

export default function SettingsScreen({ onNavigate }: Props) {
  const { user } = useAuth();
  const { enterDemo } = useDemo();
  const [searchQuery, setSearchQuery] = useState("");
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [nameError, setNameError] = useState("");

  // ── Mic Privacy Lock ────────────────────────────────────────────────────────
  const MIC_LOCK_KEY = "flashyaf_mic_locked";
  const [micLocked, setMicLocked] = useState(() => localStorage.getItem(MIC_LOCK_KEY) === "true");
  function toggleMicLock() {
    const next = !micLocked;
    setMicLocked(next);
    localStorage.setItem(MIC_LOCK_KEY, String(next));
    // Broadcast to App.tsx via storage event so it kills the global mic immediately
    window.dispatchEvent(new StorageEvent("storage", { key: MIC_LOCK_KEY, newValue: String(next) }));
  }

  // ── Auto-Start setup step tracker ──────────────────────────────────────────
  const [autoStartStep, setAutoStartStep] = useState<number | null>(null);

  // Partner Mode
  const [partnerMode, setPartnerMode] = useState(false);
  const [partnerEmail, setPartnerEmail] = useState("");
  const [partnerSaving, setPartnerSaving] = useState(false);
  const [partnerSaved, setPartnerSaved] = useState(false);
  const [partnerError, setPartnerError] = useState("");
  const [partnerLoaded, setPartnerLoaded] = useState(false);

  // Public Profile
  const [profileUsername, setProfileUsername] = useState("");
  const [profileQuote, setProfileQuote] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileCopied, setProfileCopied] = useState(false);

  // Newsletter
  const [nlSubbed, setNlSubbed] = useState(false);
  const [nlName, setNlName] = useState(user?.displayName || "");
  const [nlSubbing, setNlSubbing] = useState(false);
  const [nlError, setNlError] = useState("");

  // Support style
  const [supportStyle, setSupportStyle] = useState<"warm" | "direct" | "mindful">("warm");
  const [prefersHumor, setPrefersHumor] = useState(false);

  // Referral
  const [referralCode, setReferralCode] = useState("");
  const [referralCount, setReferralCount] = useState(0);
  const [shareFeedback, setShareFeedback] = useState<"" | "copied" | "shared">("");
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [celebratedMilestone, setCelebratedMilestone] = useState<ReferralMilestone | null>(null);

  // Delete My Data
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [ambNlSubbed, setAmbNlSubbed] = useState(false);
  const [ambNlSubbing, setAmbNlSubbing] = useState(false);
  const [ambNlError, setAmbNlError] = useState("");
  const [ambCodeCopied, setAmbCodeCopied] = useState(false);

  const configured = emailjsConfigured();

  useEffect(() => {
    if (!user) return;
    getDocs(query(collection(db, "ambassadorNewsletter"), where("userId", "==", user.uid)))
      .then((snap) => { if (!snap.empty) setAmbNlSubbed(true); })
      .catch(() => {});
  }, [user]);

  // Demo mode trigger
  useEffect(() => {
    if (searchQuery.trim().toUpperCase() === "DEMO") {
      setSearchQuery("");
      enterDemo();
    }
  }, [searchQuery]);

  useEffect(() => {
    if (!user) return;
    async function loadPartner() {
      try {
        const snap = await getDoc(doc(db, "users", user!.uid));
        if (snap.exists()) {
          const data = snap.data();
          setPartnerMode(!!data.partnerMode);
          setPartnerEmail(data.partnerEmail || "");
          const count = data.referralCount || 0;
          setReferralCount(count);
          const ackKey = `flashyaf_referral_ack_${user!.uid}`;
          const acked: number[] = JSON.parse(localStorage.getItem(ackKey) || "[]");
          const newMilestone = [...REFERRAL_MILESTONES].reverse().find(
            (m) => count >= m.count && !acked.includes(m.count)
          );
          if (newMilestone) { setCelebratedMilestone(newMilestone); setShowMilestoneModal(true); }
          if (data.referralCode) {
            setReferralCode(data.referralCode);
          } else {
            const code = user!.uid.slice(0, 8).toUpperCase();
            setReferralCode(code);
            setDoc(doc(db, "users", user!.uid), { referralCode: code, referralCount: 0 }, { merge: true }).catch(() => {});
          }
          if (data.supportStyle) setSupportStyle(data.supportStyle as "warm" | "direct" | "mindful");
          if (typeof data.prefersHumor === "boolean") setPrefersHumor(data.prefersHumor);
          if (data.username) setProfileUsername(data.username);
          if (data.profileQuote) setProfileQuote(data.profileQuote);
        }
      } catch {}
      try {
        const nlSnap = await getDocs(query(collection(db, "newsletter"), where("userId", "==", user!.uid)));
        if (!nlSnap.empty) setNlSubbed(true);
      } catch {}
      setPartnerLoaded(true);
    }
    loadPartner();
  }, [user]);

  async function handleSaveProfile() {
    if (!user) return;
    const slug = profileUsername.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "");
    if (slug.length < 3) { setProfileError("Username must be at least 3 characters."); return; }
    if (slug.length > 30) { setProfileError("Username must be 30 characters or fewer."); return; }
    setProfileSaving(true); setProfileError(""); setProfileSaved(false);
    try {
      const existing = await getDocs(query(collection(db, "users"), where("username", "==", slug)));
      const conflict = existing.docs.find((d) => d.id !== user!.uid);
      if (conflict) { setProfileError("That username is already taken. Try another."); setProfileSaving(false); return; }
      await setDoc(doc(db, "users", user.uid), { username: slug, profileQuote: profileQuote.trim() }, { merge: true });
      setProfileUsername(slug);
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
    } catch { setProfileError("Couldn't save. Please try again."); }
    setProfileSaving(false);
  }

  async function handleShareProfile() {
    const slug = profileUsername.trim().toLowerCase();
    if (!slug) return;
    const url = `${window.location.origin}/profile/${slug}`;
    try { await navigator.clipboard.writeText(url); } catch {
      const el = document.createElement("textarea");
      el.value = url; document.body.appendChild(el);
      el.select(); document.execCommand("copy");
      document.body.removeChild(el);
    }
    setProfileCopied(true);
    setTimeout(() => setProfileCopied(false), 2200);
  }

  async function handleNewsletterSubscribe() {
    if (!user) return;
    const email = user.email?.trim().toLowerCase() || "";
    if (!email) return;
    setNlSubbing(true); setNlError("");
    try {
      const existing = await getDocs(query(collection(db, "newsletter"), where("email", "==", email)));
      if (!existing.empty) { setNlSubbed(true); setNlSubbing(false); return; }
      await addDoc(collection(db, "newsletter"), {
        email, name: nlName.trim() || user.displayName || "",
        signupDate: serverTimestamp(), isAppUser: true, userId: user.uid, source: "settings",
      });
      setNlSubbed(true);
    } catch { setNlError("Couldn't subscribe. Please try again."); }
    finally { setNlSubbing(false); }
  }

  async function handleSupportStyle(style: "warm" | "direct" | "mindful") {
    setSupportStyle(style);
    if (!user) return;
    try { await setDoc(doc(db, "users", user.uid), { supportStyle: style }, { merge: true }); } catch {}
  }

  async function handleToggleHumor() {
    const next = !prefersHumor;
    setPrefersHumor(next);
    if (!user) return;
    try { await setDoc(doc(db, "users", user.uid), { prefersHumor: next }, { merge: true }); } catch {}
  }

  async function handleSaveName() {
    if (!user || !displayName.trim()) return;
    setSaving(true); setNameError("");
    try {
      await updateProfile(user, { displayName: displayName.trim() });
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch { setNameError("Failed to update name."); }
    finally { setSaving(false); }
  }

  async function handleTogglePartner() {
    if (!user || !partnerLoaded) return;
    const next = !partnerMode;
    setPartnerMode(next);
    try { await setDoc(doc(db, "users", user.uid), { partnerMode: next }, { merge: true }); } catch {}
  }

  async function handleSavePartnerEmail() {
    if (!user) return;
    const email = partnerEmail.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setPartnerError("Please enter a valid email address."); return;
    }
    setPartnerSaving(true); setPartnerError("");
    try {
      await setDoc(doc(db, "users", user.uid), { partnerEmail: email }, { merge: true });
      setPartnerSaved(true); setTimeout(() => setPartnerSaved(false), 2500);
    } catch { setPartnerError("Failed to save. Please try again."); }
    finally { setPartnerSaving(false); }
  }

  async function handleSignOut() { await signOut(auth); }

  function dismissMilestoneModal() {
    if (!user || !celebratedMilestone) return;
    const ackKey = `flashyaf_referral_ack_${user.uid}`;
    const acked: number[] = JSON.parse(localStorage.getItem(ackKey) || "[]");
    if (!acked.includes(celebratedMilestone.count)) { acked.push(celebratedMilestone.count); localStorage.setItem(ackKey, JSON.stringify(acked)); }
    setShowMilestoneModal(false); setCelebratedMilestone(null);
  }

  function handleCopyMerchCode(code: string) { navigator.clipboard?.writeText(code).catch(() => {}); }

  async function handleDeleteData() {
    if (!user || deleteInput.trim().toUpperCase() !== "DELETE") return;
    setDeleting(true); setDeleteError("");
    try {
      const uid = user.uid;
      const flashSnap = await getDocs(collection(db, "users", uid, "flashes"));
      await Promise.all(flashSnap.docs.map((d) => deleteDoc(d.ref)));
      const checkinSnap = await getDocs(collection(db, "users", uid, "checkins"));
      await Promise.all(checkinSnap.docs.map((d) => deleteDoc(d.ref)));
      const postSnap = await getDocs(query(collection(db, "community"), where("userId", "==", uid)));
      await Promise.all(postSnap.docs.map((d) => deleteDoc(d.ref)));
      const feedbackSnap = await getDocs(query(collection(db, "feedback"), where("userId", "==", uid)));
      await Promise.all(feedbackSnap.docs.map((d) => deleteDoc(d.ref)));
      await deleteDoc(doc(db, "users", uid));
      try { await deleteUser(user); } catch { await signOut(auth); }
    } catch { setDeleteError("Deletion failed. Please check your connection and try again."); setDeleting(false); }
  }

  async function handleShare() {
    if (!referralCode) return;
    const appUrl = window.location.origin;
    const message = `I have been using FLASHYAF™ to track my hot flashes and it is actually helping. Use my code ${referralCode} to sign up free at ${appUrl}?ref=${referralCode}`;
    if (navigator.share) {
      try { await navigator.share({ title: "FLASHYAF™", text: message }); setShareFeedback("shared"); setTimeout(() => setShareFeedback(""), 2500); } catch {}
    } else {
      try { await navigator.clipboard.writeText(message); setShareFeedback("copied"); setTimeout(() => setShareFeedback(""), 2500); } catch {}
    }
  }

  // ── Auto-Start setup steps ──────────────────────────────────────────────────
  const AUTO_START_STEPS = [
    { icon: "1️⃣", text: 'Open the Google app on your Android phone and tap your profile picture in the top right.' },
    { icon: "2️⃣", text: 'Tap "Settings" → then "Google Assistant" → then "Routines".' },
    { icon: "3️⃣", text: 'Tap the blue "+" button to create a new routine.' },
    { icon: "4️⃣", text: 'Under "When I say to Google Assistant" → tap "+ Add starter" → choose "Voice" → type: Hey Google, open FLASHYAF' },
    { icon: "5️⃣", text: 'Under "And then" → tap "+ Add action" → tap "Try adding your own" → type: Open FLASHYAF app → tap "Add".' },
    { icon: "6️⃣", text: 'Tap "Save" in the top right. Done! Say "Hey Google, open FLASHYAF" to test it.' },
  ];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <p style={styles.appName}>FLASHYAF™</p>
        <p style={styles.headerTitle}>Settings</p>
      </div>

      <div style={styles.searchRow}>
        <span style={styles.searchIcon}>🔍</span>
        <input
          style={styles.searchInput}
          type="text"
          placeholder="Search settings…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery.length > 0 && (
          <button style={styles.searchClear} onClick={() => setSearchQuery("")}>✕</button>
        )}
      </div>

      <div style={styles.content}>

        {/* ── MIC PRIVACY LOCK ─────────────────────────────────────────────── */}
        <div style={{
          ...styles.section,
          background: micLocked ? "rgba(192,57,43,0.08)" : "rgba(26,188,156,0.06)",
          border: micLocked ? "1.5px solid rgba(192,57,43,0.5)" : "1.5px solid rgba(26,188,156,0.35)",
        }}>
          <p style={styles.sectionLabel}>🔒 Mic Privacy Lock</p>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ flex: 1 }}>
              <p style={{ color: "#fff", fontSize: "15px", fontWeight: 800, margin: "0 0 4px" }}>
                {micLocked ? "🔴 Microphone is OFF" : "🟢 Microphone is ON"}
              </p>
              <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "12px", fontWeight: 500, margin: 0, lineHeight: 1.5 }}>
                {micLocked
                  ? "Mic completely disabled — no listening, no wake word. Tap to re-enable."
                  : "Wake word and voice commands are active. Tap to lock the mic completely."}
              </p>
            </div>
            <div
              style={{
                width: "56px", height: "30px", borderRadius: "15px", flexShrink: 0,
                background: micLocked ? "#C0392B" : "#1ABC9C",
                position: "relative", cursor: "pointer", transition: "background 0.25s ease",
              }}
              onClick={toggleMicLock}
            >
              <div style={{
                position: "absolute", top: "4px",
                left: micLocked ? "28px" : "4px",
                width: "22px", height: "22px", borderRadius: "50%",
                background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
                transition: "left 0.25s ease",
              }} />
            </div>
          </div>
          {micLocked && (
            <div style={{
              marginTop: "12px",
              background: "rgba(192,57,43,0.12)", border: "1px solid rgba(192,57,43,0.3)",
              borderRadius: "12px", padding: "10px 14px",
              display: "flex", alignItems: "center", gap: "8px",
            }}>
              <span style={{ fontSize: "16px" }}>🔕</span>
              <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "12px", fontWeight: 600, margin: 0, lineHeight: 1.4 }}>
                Mic Privacy Lock is ON. "Hey Flashy" and all voice commands are completely disabled until you toggle this off.
              </p>
            </div>
          )}
        </div>

        {/* ── FLASHYAF AUTO-START™ ──────────────────────────────────────────── */}
        <div style={{
          ...styles.section,
          background: "linear-gradient(135deg, rgba(41,128,185,0.08) 0%, rgba(52,73,94,0.06) 100%)",
          border: "1.5px solid rgba(41,128,185,0.35)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
            <p style={{ ...styles.sectionLabel, margin: 0 }}>📱 FLASHYAF Auto-Start™</p>
            <span style={{
              background: "#2980B9", color: "#fff",
              fontSize: "9px", fontWeight: 900, letterSpacing: "1px",
              borderRadius: "100px", padding: "3px 8px",
            }}>OPT-IN</span>
          </div>

          <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "13px", lineHeight: 1.6, margin: "0 0 14px" }}>
            Say <strong style={{ color: "#fff" }}>"Hey Google, open FLASHYAF"</strong> to launch the app hands-free — no tapping required. Perfect for when a flash hits and your hands are full.
          </p>

          <div style={{
            background: "rgba(41,128,185,0.1)", border: "1px solid rgba(41,128,185,0.3)",
            borderRadius: "12px", padding: "12px 14px", marginBottom: "14px",
            display: "flex", alignItems: "flex-start", gap: "8px",
          }}>
            <span style={{ fontSize: "16px", flexShrink: 0 }}>ℹ️</span>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "12px", fontWeight: 500, margin: 0, lineHeight: 1.55 }}>
              This uses Google Assistant Routines on Android — a free built-in feature. No extra apps needed. Takes about 2 minutes to set up.
            </p>
          </div>

          {/* Step-by-step guide */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {AUTO_START_STEPS.map((step, i) => {
              const isOpen = autoStartStep === i;
              const isDone = autoStartStep !== null && autoStartStep > i;
              return (
                <div
                  key={i}
                  style={{
                    background: isDone ? "rgba(26,188,156,0.08)" : isOpen ? "rgba(41,128,185,0.12)" : "rgba(255,255,255,0.03)",
                    border: isDone ? "1px solid rgba(26,188,156,0.3)" : isOpen ? "1px solid rgba(41,128,185,0.5)" : "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "12px", overflow: "hidden",
                    transition: "all 0.2s ease",
                  }}
                >
                  <button
                    style={{
                      width: "100%", background: "transparent", border: "none",
                      display: "flex", alignItems: "center", gap: "12px",
                      padding: "12px 14px", cursor: "pointer", textAlign: "left",
                    }}
                    onClick={() => setAutoStartStep(isOpen ? null : i)}
                  >
                    <span style={{ fontSize: "20px", flexShrink: 0 }}>
                      {isDone ? "✅" : step.icon}
                    </span>
                    <span style={{
                      color: isDone ? "#1ABC9C" : isOpen ? "#fff" : "rgba(255,255,255,0.6)",
                      fontSize: "13px", fontWeight: 700, flex: 1,
                    }}>
                      Step {i + 1}{isDone ? " — Done!" : ""}
                    </span>
                    <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "14px" }}>
                      {isOpen ? "▲" : "▼"}
                    </span>
                  </button>
                  {isOpen && (
                    <div style={{ padding: "0 14px 14px 46px" }}>
                      <p style={{ color: "rgba(255,255,255,0.75)", fontSize: "13px", fontWeight: 500, lineHeight: 1.65, margin: "0 0 10px" }}>
                        {step.text}
                      </p>
                      <div style={{ display: "flex", gap: "8px" }}>
                        {i < AUTO_START_STEPS.length - 1 && (
                          <button
                            style={{
                              flex: 1, background: "rgba(41,128,185,0.25)",
                              border: "1px solid rgba(41,128,185,0.5)",
                              borderRadius: "10px", color: "#87CEEB",
                              fontSize: "13px", fontWeight: 800,
                              padding: "10px 14px", cursor: "pointer",
                            }}
                            onClick={() => setAutoStartStep(i + 1)}
                          >
                            Done — Next Step →
                          </button>
                        )}
                        {i === AUTO_START_STEPS.length - 1 && (
                          <button
                            style={{
                              flex: 1, background: "rgba(26,188,156,0.25)",
                              border: "1px solid rgba(26,188,156,0.5)",
                              borderRadius: "10px", color: "#1ABC9C",
                              fontSize: "13px", fontWeight: 800,
                              padding: "10px 14px", cursor: "pointer",
                            }}
                            onClick={() => setAutoStartStep(null)}
                          >
                            ✓ All Done!
                          </button>
                        )}
                        <button
                          style={{
                            background: "rgba(255,255,255,0.06)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: "10px", color: "rgba(255,255,255,0.35)",
                            fontSize: "12px", fontWeight: 600,
                            padding: "10px 12px", cursor: "pointer",
                          }}
                          onClick={() => setAutoStartStep(null)}
                        >
                          Collapse
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{
            marginTop: "12px", background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px",
            padding: "12px 14px",
          }}>
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "11px", fontWeight: 600, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.8px" }}>
              Privacy Note
            </p>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px", fontWeight: 500, margin: 0, lineHeight: 1.55 }}>
              FLASHYAF™ does not control Google Assistant. This feature uses your phone's built-in Assistant and is fully optional — you can delete the routine anytime from Google Assistant settings.
            </p>
          </div>
        </div>

        {/* Account */}
        <div style={styles.section}>
          <p style={styles.sectionLabel}>Account</p>
          <div style={styles.emailRow}>
            <span style={styles.emailIcon}>✉️</span>
            <span style={styles.emailText}>{user?.email}</span>
          </div>
        </div>

        {/* Display Name */}
        <div style={styles.section}>
          <p style={styles.sectionLabel}>Display Name</p>
          <div style={styles.nameRow}>
            <input
              style={styles.input}
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
            />
            <button style={styles.saveBtn} onClick={handleSaveName} disabled={saving}>
              {saved ? "✓" : saving ? "..." : "Save"}
            </button>
          </div>
          {nameError && <p style={styles.error}>{nameError}</p>}
        </div>

        {/* My Public Profile */}
        <div style={{ ...styles.section, border: "1px solid rgba(245,166,35,0.3)", background: "rgba(245,166,35,0.04)" }}>
          <p style={styles.sectionLabel}>🌟 My Public Profile</p>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px", lineHeight: 1.55, margin: "0 0 10px" }}>
            Create a shareable profile page to show your FLASHYAF™ journey — badges, stats, and a personal quote.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "10px" }}>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "11px", fontWeight: 700, margin: 0, letterSpacing: "0.5px", textTransform: "uppercase" as const }}>Username</p>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <span style={{ color: "rgba(245,166,35,0.7)", fontSize: "13px", fontWeight: 700, flexShrink: 0 }}>flashyaf.app/profile/</span>
              <input
                style={{ ...styles.input, flex: 1, minWidth: 0 }}
                type="text"
                placeholder="yourname"
                value={profileUsername}
                onChange={(e) => { setProfileUsername(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, "")); setProfileSaved(false); setProfileError(""); }}
                maxLength={30}
              />
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "12px" }}>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "11px", fontWeight: 700, margin: 0, letterSpacing: "0.5px", textTransform: "uppercase" as const }}>Motivational Quote (optional)</p>
            <textarea
              style={{ ...styles.input, resize: "none", height: "72px", lineHeight: 1.5, paddingTop: "12px" } as React.CSSProperties}
              placeholder="e.g. I am not hot flashing — I am power surging. 🔥"
              value={profileQuote}
              onChange={(e) => setProfileQuote(e.target.value)}
              maxLength={160}
            />
            <p style={{ color: "rgba(255,255,255,0.2)", fontSize: "11px", margin: 0, textAlign: "right" as const }}>{profileQuote.length}/160</p>
          </div>
          {profileError && <p style={{ color: "#FF6B6B", fontSize: "12px", fontWeight: 600, margin: "0 0 8px" }}>{profileError}</p>}
          <button
            style={{
              width: "100%",
              background: profileSaved ? "linear-gradient(135deg, rgba(26,188,156,0.9), rgba(22,160,133,0.9))" : "linear-gradient(135deg, rgba(245,166,35,0.9), rgba(255,140,0,0.9))",
              border: "none", borderRadius: "12px", color: "#000", fontSize: "14px", fontWeight: 900,
              padding: "14px", cursor: profileSaving ? "not-allowed" : "pointer",
              opacity: profileSaving ? 0.6 : 1, fontFamily: "'Inter', sans-serif", marginBottom: "10px",
            }}
            onClick={handleSaveProfile}
            disabled={profileSaving}
          >
            {profileSaved ? "✓ Profile Saved!" : profileSaving ? "Saving…" : "Save Profile"}
          </button>
          {profileUsername.length >= 3 && (
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                style={{
                  flex: 1,
                  background: profileCopied ? "rgba(26,188,156,0.15)" : "rgba(245,166,35,0.12)",
                  border: `1px solid ${profileCopied ? "rgba(26,188,156,0.4)" : "rgba(245,166,35,0.35)"}`,
                  borderRadius: "12px", color: profileCopied ? "#1ABC9C" : "rgba(245,166,35,0.9)",
                  fontSize: "13px", fontWeight: 800, padding: "12px 8px", cursor: "pointer", fontFamily: "'Inter', sans-serif",
                }}
                onClick={handleShareProfile}
              >
                {profileCopied ? "✓ Copied!" : "🔗 Share My Journey"}
              </button>
              <a
                href={`/profile/${profileUsername}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "12px", color: "rgba(255,255,255,0.6)", fontSize: "13px", fontWeight: 800,
                  padding: "12px 8px", cursor: "pointer", textDecoration: "none",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                👁️ View Profile
              </a>
            </div>
          )}
        </div>

        {/* Newsletter */}
        <div style={{ ...styles.section, border: nlSubbed ? "1px solid rgba(26,188,156,0.35)" : "1px solid rgba(255,255,255,0.08)", background: nlSubbed ? "rgba(26,188,156,0.05)" : "var(--color-card)" }}>
          <p style={styles.sectionLabel}>📬 Newsletter</p>
          {nlSubbed ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "22px" }}>✅</span>
                <p style={{ color: "#1ABC9C", fontSize: "14px", fontWeight: 800, margin: 0 }}>You are subscribed to the FLASHYAF™ newsletter.</p>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px", lineHeight: 1.55, margin: 0 }}>
                Weekly tips, community highlights, new features, and exclusive beta offers — straight to your inbox.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <input style={{ ...styles.input, opacity: 0.5, cursor: "not-allowed" }} type="email" value={user?.email || ""} readOnly />
                <input style={styles.input} type="text" placeholder="Your first name (optional)" value={nlName} onChange={(e) => setNlName(e.target.value)} />
              </div>
              {nlError && <p style={{ color: "#FF6B6B", fontSize: "12px", fontWeight: 600, margin: 0 }}>{nlError}</p>}
              <button
                style={{ width: "100%", background: "linear-gradient(135deg, rgba(26,188,156,0.9), rgba(22,160,133,0.9))", border: "none", borderRadius: "12px", color: "#fff", fontSize: "14px", fontWeight: 800, padding: "14px", cursor: nlSubbing ? "not-allowed" : "pointer", opacity: nlSubbing ? 0.6 : 1, fontFamily: "'Inter', sans-serif" }}
                onClick={handleNewsletterSubscribe}
                disabled={nlSubbing}
              >
                {nlSubbing ? "Subscribing…" : "Subscribe to Newsletter 📬"}
              </button>
            </div>
          )}
        </div>

        {/* Partner Mode */}
        <div style={{ ...styles.section, border: partnerMode ? "1px solid rgba(135,206,235,0.35)" : "1px solid rgba(255,255,255,0.08)", background: partnerMode ? "rgba(135,206,235,0.06)" : "var(--color-card)" }}>
          <p style={styles.sectionLabel}>Partner Mode</p>
          <div style={styles.partnerToggleRow}>
            <div style={styles.partnerToggleLeft}>
              <span style={styles.partnerIcon}>👫</span>
              <div>
                <p style={styles.partnerToggleTitle}>Notify my support person</p>
                <p style={styles.partnerToggleSub}>Send a brief email after each flash is logged</p>
              </div>
            </div>
            <div style={{ ...styles.toggle, background: partnerMode ? "#2E86AB" : "rgba(255,255,255,0.15)" }} onClick={handleTogglePartner} role="switch" aria-checked={partnerMode}>
              <div style={{ ...styles.toggleKnob, left: partnerMode ? "22px" : "3px" }} />
            </div>
          </div>
          {partnerMode && (
            <div style={styles.partnerEmailSection}>
              <p style={styles.partnerEmailLabel}>Support person's email</p>
              <div style={styles.nameRow}>
                <input style={styles.input} type="email" value={partnerEmail} onChange={(e) => { setPartnerEmail(e.target.value); setPartnerError(""); }} placeholder="partner@example.com" />
                <button style={{ ...styles.saveBtn, background: "#2E86AB" }} onClick={handleSavePartnerEmail} disabled={partnerSaving}>
                  {partnerSaved ? "✓" : partnerSaving ? "..." : "Save"}
                </button>
              </div>
              {partnerError && <p style={styles.error}>{partnerError}</p>}
              {partnerEmail && !partnerError && (
                <div style={styles.previewBox}>
                  <p style={styles.previewLabel}>📧 Email preview</p>
                  <p style={styles.previewText}>"{user?.displayName || user?.email?.split("@")[0] || "Your person"} just logged a hot flash on FLASHYAF™. Duration: X min. Intensity: X out of 5. They are doing great!"</p>
                </div>
              )}
              {!configured && (
                <div style={styles.setupNotice}>
                  <p style={styles.setupTitle}>⚙️ Email setup required</p>
                  <p style={styles.setupBody}>To send emails, add these 3 secrets in your project settings:</p>
                  <div style={styles.setupKeys}>
                    <code style={styles.setupKey}>VITE_EMAILJS_SERVICE_ID</code>
                    <code style={styles.setupKey}>VITE_EMAILJS_TEMPLATE_ID</code>
                    <code style={styles.setupKey}>VITE_EMAILJS_PUBLIC_KEY</code>
                  </div>
                  <p style={styles.setupFooter}>Get these free at <a href="https://emailjs.com" target="_blank" rel="noopener noreferrer" style={styles.setupLink}>emailjs.com</a>.</p>
                </div>
              )}
              {configured && partnerEmail && (
                <div style={styles.activeNotice}>✓ Emails will be sent to <strong>{partnerEmail}</strong> after each flash</div>
              )}
            </div>
          )}
        </div>

        {/* Refer a Friend */}
        {(() => {
          const MILESTONE_COUNTS = [1, 3, 5, 10] as const;
          const nextCount = MILESTONE_COUNTS.find((m) => referralCount < m) ?? 10;
          const prevCount = [...MILESTONE_COUNTS].reverse().find((m) => referralCount >= m) ?? 0;
          const progressPct = nextCount === prevCount ? 100 : Math.round(((referralCount - prevCount) / (nextCount - prevCount)) * 100);
          const allDone = referralCount >= 10;
          return (
            <div style={{ ...styles.section, background: "linear-gradient(135deg, rgba(142,68,173,0.07) 0%, rgba(52,73,94,0.05) 100%)", border: "1px solid rgba(142,68,173,0.3)" }}>
              <p style={styles.sectionLabel}>📢 Refer a Friend</p>
              <div style={styles.referralCodeBox}>
                <p style={styles.referralCodeLabel}>Your referral code</p>
                <p style={styles.referralCodeText}>{referralCode || "Loading…"}</p>
              </div>
              <div style={styles.referralProgressWrap}>
                <div style={styles.referralProgressHeader}>
                  <span style={styles.referralProgressLeft}><span style={styles.referralProgressCount}>{referralCount}</span><span style={styles.referralProgressCountLabel}> friend{referralCount !== 1 ? "s" : ""} referred</span></span>
                  <span style={styles.referralProgressTarget}>{allDone ? "All rewards unlocked! 🎉" : `${referralCount}/${nextCount} to next reward`}</span>
                </div>
                <div style={styles.referralProgressTrack}><div style={{ ...styles.referralProgressFill, width: `${allDone ? 100 : progressPct}%` }} /></div>
              </div>
              <div style={styles.milestoneList}>
                {REFERRAL_MILESTONES.map((m) => {
                  const earned = referralCount >= m.count;
                  return (
                    <div key={m.count} style={{ ...styles.milestoneRow, opacity: earned ? 1 : 0.5 }}>
                      <div style={{ ...styles.milestoneDot, background: earned ? "linear-gradient(135deg, #8E44AD, #6C3483)" : "rgba(255,255,255,0.06)", border: earned ? "none" : "2px solid rgba(255,255,255,0.15)" }}>
                        <span style={styles.milestoneDotInner}>{earned ? "✓" : m.count}</span>
                      </div>
                      <div style={styles.milestoneInfo}>
                        <span style={styles.milestoneCount}>{m.count} referral{m.count !== 1 ? "s" : ""}</span>
                        <span style={styles.milestoneRewardText}>{m.icon} {m.label}</span>
                      </div>
                      {earned && m.code && (<button style={styles.milestoneCodePill} onClick={() => handleCopyMerchCode(m.code!)}>{m.code}</button>)}
                    </div>
                  );
                })}
              </div>
              <button style={{ ...styles.shareBtn, background: shareFeedback ? "rgba(26,188,156,0.25)" : "linear-gradient(135deg, #8E44AD 0%, #6C3483 100%)", border: shareFeedback ? "1px solid rgba(26,188,156,0.5)" : "none" }} onClick={handleShare} disabled={!referralCode}>
                <span style={styles.shareBtnIcon}>{shareFeedback ? "✓" : "📤"}</span>
                <span>{shareFeedback === "copied" ? "Message Copied!" : shareFeedback === "shared" ? "Shared!" : "Share My Code"}</span>
              </button>
              <p style={styles.referralNote}>When friends sign up with your code, your referral count goes up automatically.</p>
            </div>
          );
        })()}

        {/* Ambassador Program */}
        {(() => {
          const isAmbassador = referralCount >= 10;
          const ambCode = referralCode ? `AMB-${referralCode.toUpperCase()}` : "AMB-…";
          const EARLY_ACCESS_FEATURES = [
            { icon: "🔮", label: "Flash Forecast AI", sub: "Predict your next high-symptom window using your data" },
            { icon: "📄", label: "Symptom Pattern Report (PDF)", sub: "Export your monthly data as a shareable health report" },
            { icon: "🎙️", label: "Voice Flash Logging", sub: "Say 'Flashy' to log a flash hands-free" },
            { icon: "📊", label: "Monthly Progress Email", sub: "Personalized insights delivered to your inbox every month" },
            { icon: "🩺", label: "Doctor Appointment Prep", sub: "Auto-generated question list based on your tracked data" },
          ];
          return (
            <div style={{ ...styles.section, background: isAmbassador ? "linear-gradient(160deg, rgba(184,134,11,0.12) 0%, rgba(255,215,0,0.04) 100%)" : "linear-gradient(135deg, rgba(184,134,11,0.06) 0%, rgba(52,73,94,0.04) 100%)", border: isAmbassador ? "1.5px solid rgba(255,215,0,0.4)" : "1px solid rgba(184,134,11,0.2)", boxShadow: isAmbassador ? "0 0 40px rgba(255,215,0,0.07)" : "none" }}>
              {isAmbassador ? (
                <>
                  <div style={styles.ambBadgeHero}>
                    <div style={styles.ambBadgeRing}><span style={{ fontSize: "44px", lineHeight: 1 }}>🏅</span></div>
                    <div style={{ flex: 1 }}>
                      <p style={styles.ambTitle}>FLASHYAF™ AMBASSADOR</p>
                      <p style={styles.ambSubtitle}>Class of 2025 · {referralCount} referrals</p>
                    </div>
                  </div>
                  <div style={styles.ambDivider} />
                  <p style={styles.ambSectionLabel}>💌 A Message from Our Founder</p>
                  <div style={styles.ambVideoCard}>
                    <div style={styles.ambVideoThumb}>
                      <div style={styles.ambVideoPlayBtn}>▶</div>
                      <div style={styles.ambVideoGrad} />
                      <div style={styles.ambVideoOverlay}>
                        <p style={styles.ambVideoTitle}>A personal thank-you from Iva</p>
                        <p style={styles.ambVideoSub}>Founder, BROWNWORKS4U2 LLC</p>
                      </div>
                    </div>
                    <p style={styles.ambVideoCaption}>"You didn't just refer friends — you helped other women find a tool that makes them feel seen. That means everything to me. Thank you from the bottom of my heart."</p>
                    <p style={styles.ambVideoSig}>— Iva, Founder of FLASHYAF™</p>
                  </div>
                  <p style={{ ...styles.ambSectionLabel, marginTop: "18px" }}>🎁 Your Exclusive Ambassador Code</p>
                  <div style={styles.ambCodeCard}>
                    <div style={styles.ambCodeInner}>
                      <p style={styles.ambCodeLabel}>Share this for 25% off</p>
                      <p style={styles.ambCodeText}>{ambCode}</p>
                    </div>
                    <button style={{ ...styles.ambCodeCopyBtn, background: ambCodeCopied ? "rgba(26,188,156,0.25)" : "rgba(255,215,0,0.18)", borderColor: ambCodeCopied ? "rgba(26,188,156,0.5)" : "rgba(255,215,0,0.4)", color: ambCodeCopied ? "#1ABC9C" : "#FFD700" }} onClick={() => { navigator.clipboard.writeText(ambCode).catch(() => {}); setAmbCodeCopied(true); setTimeout(() => setAmbCodeCopied(false), 2500); }}>
                      {ambCodeCopied ? "✓ Copied" : "Copy"}
                    </button>
                  </div>
                  <p style={{ ...styles.ambSectionLabel, marginTop: "18px" }}>🚀 Your Early Access Features</p>
                  <div style={styles.ambEarlyList}>
                    {EARLY_ACCESS_FEATURES.map((f, i) => (
                      <div key={i} style={styles.ambEarlyItem}>
                        <div style={styles.ambEarlyIconCircle}><span style={{ fontSize: "18px" }}>{f.icon}</span></div>
                        <div style={{ flex: 1 }}><p style={styles.ambEarlyLabel}>{f.label}</p><p style={styles.ambEarlySub}>{f.sub}</p></div>
                        <div style={styles.ambEarlyPill}>COMING SOON</div>
                      </div>
                    ))}
                  </div>
                  <p style={{ ...styles.ambSectionLabel, marginTop: "18px" }}>💬 Private Ambassador Community</p>
                  <div style={styles.ambCommunityCard}>
                    <div style={styles.ambCommunityLeft}><span style={{ fontSize: "32px" }}>👑</span><div><p style={styles.ambCommunityTitle}>Ambassador Inner Circle</p><p style={styles.ambCommunitySub}>A private group for Ambassadors only.</p></div></div>
                    <a href={`mailto:iva@brownworks4u2.com?subject=Ambassador%20Community%20Access%20Request`} style={styles.ambCommunityBtn}>Request Access →</a>
                  </div>
                  <p style={{ ...styles.ambSectionLabel, marginTop: "18px" }}>📬 Monthly Ambassador Newsletter</p>
                  {ambNlSubbed ? (
                    <div style={styles.ambNlSuccessCard}><span style={{ fontSize: "28px" }}>📬</span><div><p style={styles.ambNlSuccessTitle}>You're on the VIP list.</p><p style={styles.ambNlSuccessSub}>Ambassador-only updates every month.</p></div></div>
                  ) : (
                    <div style={styles.ambNlCard}>
                      <p style={styles.ambNlCardText}>Get exclusive Ambassador-only updates: product sneak peeks, behind-the-scenes stories from Iva, and early feature launches.</p>
                      {ambNlError !== "" && <p style={{ color: "#FF6B6B", fontSize: "12px", fontWeight: 600, margin: 0 }}>{ambNlError}</p>}
                      <button style={{ ...styles.ambNlBtn, opacity: ambNlSubbing ? 0.6 : 1 }} disabled={ambNlSubbing} onClick={async () => {
                        if (!user) return; setAmbNlSubbing(true); setAmbNlError("");
                        try {
                          const existing = await getDocs(query(collection(db, "ambassadorNewsletter"), where("userId", "==", user.uid)));
                          if (!existing.empty) { setAmbNlSubbed(true); setAmbNlSubbing(false); return; }
                          await addDoc(collection(db, "ambassadorNewsletter"), { userId: user.uid, email: user.email, name: user.displayName || "", referralCode, referralCount, subscribedAt: serverTimestamp() });
                          setAmbNlSubbed(true);
                        } catch { setAmbNlError("Couldn't subscribe. Please try again."); }
                        setAmbNlSubbing(false);
                      }}>
                        {ambNlSubbing ? "Subscribing…" : "Subscribe to Ambassador Newsletter 🏅"}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div style={styles.ambTeaserHeader}>
                    <div style={styles.ambTeaserLock}><span style={{ fontSize: "28px" }}>🏅</span></div>
                    <div style={{ flex: 1 }}><p style={styles.ambTeaserTitle}>FLASHYAF™ Ambassador Program</p><p style={styles.ambTeaserSub}>Unlock at 10 referrals — you're at {referralCount}</p></div>
                  </div>
                  <div style={styles.ambTeaserProgress}>
                    <div style={styles.ambTeaserProgressHeader}><span style={styles.ambTeaserProgressLabel}>{referralCount} / 10 referrals</span><span style={styles.ambTeaserProgressRight}>{10 - referralCount} to go</span></div>
                    <div style={styles.ambTeaserTrack}><div style={{ ...styles.ambTeaserFill, width: `${Math.min(100, Math.round((referralCount / 10) * 100))}%` }} /></div>
                  </div>
                  <p style={styles.ambTeaserPerksTitle}>What you'll unlock:</p>
                  <div style={styles.ambTeaserPerksList}>
                    {["🏅 Exclusive gold Ambassador badge","🎁 Unique ambassador discount code to share","💌 Personal video message from Iva","🚀 Early access to every new feature","👑 Private Ambassador Community invitation","📬 Monthly Ambassador-only newsletter"].map((perk, i) => (
                      <div key={i} style={styles.ambTeaserPerkRow}><span style={{ fontSize: "14px", flexShrink: 0 }}>🔒</span><p style={styles.ambTeaserPerkText}>{perk}</p></div>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {/* Support Style */}
        <div style={styles.section}>
          <p style={styles.sectionLabel}>🎁 My Support Style</p>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px", lineHeight: 1.55, margin: "0 0 12px", fontStyle: "italic" }}>On rough days, Flashy sends you a Care Package. Choose how it talks to you.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {([{ key: "warm", icon: "💜", label: "Warm & Nurturing", sub: "Gentle, affirming, and kind" },{ key: "direct", icon: "💪", label: "Straight Talk", sub: "Practical, direct, and real" },{ key: "mindful", icon: "🧘", label: "Mindful Moments", sub: "Reflective, grounding, and calm" }] as const).map((opt) => (
              <button key={opt.key} style={{ width: "100%", display: "flex", alignItems: "center", gap: "12px", background: supportStyle === opt.key ? "rgba(184,134,11,0.12)" : "rgba(255,255,255,0.03)", border: supportStyle === opt.key ? "1.5px solid #B8860B" : "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "12px 14px", cursor: "pointer", fontFamily: "'Inter', sans-serif", textAlign: "left" }} onClick={() => handleSupportStyle(opt.key)}>
                <span style={{ fontSize: "22px", flexShrink: 0 }}>{opt.icon}</span>
                <div style={{ flex: 1 }}><p style={{ color: supportStyle === opt.key ? "#DAA520" : "#fff", fontSize: "13px", fontWeight: 800, margin: 0 }}>{opt.label}</p><p style={{ color: "rgba(255,255,255,0.4)", fontSize: "11px", margin: 0 }}>{opt.sub}</p></div>
                {supportStyle === opt.key && <span style={{ color: "#B8860B", fontSize: "16px", fontWeight: 900 }}>✓</span>}
              </button>
            ))}
          </div>
          <button style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "12px 14px", cursor: "pointer", fontFamily: "'Inter', sans-serif", textAlign: "left", marginTop: "8px" }} onClick={handleToggleHumor}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "20px" }}>😄</span>
              <div><p style={{ color: "#fff", fontSize: "13px", fontWeight: 800, margin: 0 }}>Include a humor line</p><p style={{ color: "rgba(255,255,255,0.4)", fontSize: "11px", margin: 0 }}>A little comedy for rough days</p></div>
            </div>
            <div style={{ width: "40px", height: "22px", borderRadius: "100px", background: prefersHumor ? "#B8860B" : "rgba(255,255,255,0.1)", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
              <div style={{ position: "absolute", top: "3px", left: prefersHumor ? "21px" : "3px", width: "16px", height: "16px", borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
            </div>
          </button>
        </div>

        {/* Affiliate Program */}
        <div style={styles.section}>
          <p style={styles.sectionLabel}>Earn Money</p>
          <button style={styles.wearableBtn} onClick={() => onNavigate("affiliate")}>
            <span style={styles.wearableBtnIcon}>💰</span>
            <div style={styles.wearableBtnText}><span style={styles.wearableBtnTitle}>Affiliate Program</span><span style={styles.wearableBtnSub}>Earn 20% on every Premium signup you refer</span></div>
            <span style={styles.wearableBtnArrow}>›</span>
          </button>
        </div>

        {/* Devices */}
        <div style={styles.section}>
          <p style={styles.sectionLabel}>Devices</p>
          <button style={styles.wearableBtn} onClick={() => onNavigate("wearable")}>
            <span style={styles.wearableBtnIcon}>⌚</span>
            <div style={styles.wearableBtnText}><span style={styles.wearableBtnTitle}>Connect Your Device</span><span style={styles.wearableBtnSub}>Apple Watch · Fitbit · Garmin · Oura</span></div>
            <div style={styles.wearableBtnRight}><span style={styles.wearableComingSoon}>2.0</span><span style={styles.wearableBtnArrow}>›</span></div>
          </button>
        </div>

        {/* Data & Insights */}
        <div style={styles.section}>
          <p style={styles.sectionLabel}>Data & Insights</p>
          <button style={styles.patternBtn} onClick={() => onNavigate("pattern-intelligence")}>
            <span style={styles.patternBtnIcon}>🧠</span>
            <div style={styles.patternBtnText}><span style={styles.patternBtnTitle}>Pattern Intelligence</span><span style={styles.patternBtnSub}>Full data table · stats · hour chart</span></div>
            <span style={styles.patternBtnArrow}>›</span>
          </button>
        </div>

        {/* Talk To Someone */}
        <div style={styles.section}>
          <p style={styles.sectionLabel}>Talk To Someone</p>
          <div style={styles.telehealthDisclaimer}>
            <span style={styles.telehealthDisclaimerIcon}>ℹ️</span>
            <p style={styles.telehealthDisclaimerText}>FLASHYAF™ is not a medical provider. These links connect you to independent third-party services. Always consult a qualified healthcare professional for medical advice.</p>
          </div>
          {[
            { icon: "🩺", title: "Find a Menopause Specialist", desc: "Connect with certified menopause practitioners who understand what you're going through.", cta: "Find a Specialist", url: "https://www.menopausespecialist.org", accent: "#8E44AD", bg: "rgba(142,68,173,0.08)", border: "rgba(142,68,173,0.25)" },
            { icon: "👩‍⚕️", title: "Talk to a Nurse", desc: "Speak with a registered nurse from the comfort of home — available 24/7.", cta: "Talk to a Nurse", url: "https://www.nursenextdoor.com", accent: "#2980B9", bg: "rgba(41,128,185,0.08)", border: "rgba(41,128,185,0.25)" },
            { icon: "💭", title: "Mental Health Support", desc: "Hormonal changes affect your mind too. Connect with a licensed therapist online.", cta: "Get Support", url: "https://www.betterhelp.com", accent: "#16A085", bg: "rgba(22,160,133,0.08)", border: "rgba(22,160,133,0.25)" },
            { icon: "🆘", title: "Crisis Support", desc: "If you're in emotional distress or crisis, help is available right now — free, confidential, 24/7.", cta: "Get Help Now", url: "https://988lifeline.org", accent: "#C0392B", bg: "rgba(192,57,43,0.1)", border: "rgba(192,57,43,0.4)" },
          ].map(({ icon, title, desc, cta, url, accent, bg, border }) => (
            <div key={title} style={{ ...styles.telehealthCard, background: bg, border: `1px solid ${border}` }}>
              <div style={styles.telehealthCardTop}>
                <div style={{ ...styles.telehealthIconCircle, background: `${accent}22` }}><span style={styles.telehealthIcon}>{icon}</span></div>
                <div style={styles.telehealthCardBody}><p style={styles.telehealthTitle}>{title}</p><p style={styles.telehealthDesc}>{desc}</p></div>
              </div>
              <a href={url} target="_blank" rel="noopener noreferrer" style={{ ...styles.telehealthCta, background: accent }}>{cta} →</a>
            </div>
          ))}
        </div>

        {/* Get Help */}
        <div style={{ ...styles.section, border: "1px solid rgba(192,57,43,0.35)", background: "rgba(192,57,43,0.05)" }}>
          <p style={styles.sectionLabel}>Get Help</p>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", background: "rgba(192,57,43,0.12)", border: "1px solid rgba(192,57,43,0.45)", borderRadius: "14px", padding: "14px 14px", marginBottom: "4px" }}>
            <span style={{ fontSize: "22px", flexShrink: 0, lineHeight: 1 }}>🚨</span>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: "3px" }}>
              <p style={{ color: "#E74C3C", fontSize: "13px", fontWeight: 900, margin: 0, lineHeight: 1.3 }}>FLASHYAF™ is not a crisis service.</p>
              <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "12px", fontWeight: 600, margin: 0, lineHeight: 1.5 }}>If you are in immediate danger, call <a href="tel:911" style={{ color: "#E74C3C", fontWeight: 900, textDecoration: "none" }}>911</a> right now.</p>
            </div>
          </div>
          {([
            { icon: "🌸", title: "National Menopause Foundation", desc: "Research-backed education, community, and menopause resources for every stage.", cta: "Visit menopause.org", href: "https://www.menopause.org", accent: "#8E44AD", bg: "rgba(142,68,173,0.08)", border: "rgba(142,68,173,0.3)", type: "url" },
            { icon: "📞", title: "NAMI Mental Health Hotline", desc: "National Alliance on Mental Illness — free, confidential support, available now.", cta: "Tap to Call 988", href: "tel:988", accent: "#E67E22", bg: "rgba(230,126,34,0.08)", border: "rgba(230,126,34,0.3)", type: "call" },
            { icon: "💬", title: "Crisis Text Line", desc: "Text HOME to 741741 — free crisis counseling via text, 24/7, confidential.", cta: "Tap to Text HOME", href: "sms:741741?body=HOME", accent: "#16A085", bg: "rgba(22,160,133,0.08)", border: "rgba(22,160,133,0.3)", type: "text" },
          ] as { icon: string; title: string; desc: string; cta: string; href: string; accent: string; bg: string; border: string; type: string }[]).map(({ icon, title, desc, cta, href, accent, bg, border, type }) => (
            <div key={title} style={{ ...styles.telehealthCard, background: bg, border: `1px solid ${border}` }}>
              <div style={styles.telehealthCardTop}>
                <div style={{ ...styles.telehealthIconCircle, background: `${accent}22` }}><span style={styles.telehealthIcon}>{icon}</span></div>
                <div style={styles.telehealthCardBody}><p style={styles.telehealthTitle}>{title}</p><p style={styles.telehealthDesc}>{desc}</p></div>
              </div>
              <a href={href} target={type === "url" ? "_blank" : undefined} rel={type === "url" ? "noopener noreferrer" : undefined} style={{ ...styles.telehealthCta, background: accent, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                {type === "call" && <span style={{ fontSize: "14px" }}>📞</span>}
                {type === "text" && <span style={{ fontSize: "14px" }}>💬</span>}
                {cta}{type === "url" && " →"}
              </a>
            </div>
          ))}
        </div>

        {/* Shop */}
        <div style={styles.section}>
          <p style={styles.sectionLabel}>Shop</p>
          <button style={styles.shopBtn} onClick={() => onNavigate("shop")}>
            <span style={styles.shopBtnIcon}>🛍️</span>
            <div style={styles.shopBtnText}><span style={styles.shopBtnTitle}>Shop FLASHYAF™ Merch</span><span style={styles.shopBtnSub}>Cooling towels · tees · water bottles · gift sets</span></div>
            <div style={styles.shopBtnRight}><span style={styles.shopDiscount}>FOUNDING20</span><span style={styles.shopBtnArrow}>›</span></div>
          </button>
        </div>

        {/* About */}
        <div style={styles.section}>
          <p style={styles.sectionLabel}>About</p>
          <div style={styles.aboutBox}><p style={styles.aboutLine}>🔥 FLASHYAF™</p><p style={styles.aboutSub}>Your hot flash. Your data. Your power.</p></div>
          <button style={styles.howItWorksBtn} onClick={() => onNavigate("tutorial")}>
            <span style={styles.howItWorksIcon}>📖</span>
            <div style={styles.howItWorksBtnText}><span style={styles.howItWorksBtnTitle}>How It Works</span><span style={styles.howItWorksBtnSub}>5-card intro to FLASHYAF</span></div>
            <span style={styles.howItWorksBtnArrow}>›</span>
          </button>
          <button style={{ ...styles.howItWorksBtn, marginTop: "8px" }} onClick={() => onNavigate("about")}>
            <span style={styles.howItWorksIcon}>ℹ️</span>
            <div style={styles.howItWorksBtnText}><span style={styles.howItWorksBtnTitle}>About FLASHYAF</span><span style={styles.howItWorksBtnSub}>Company · Founder · Legal</span></div>
            <span style={styles.howItWorksBtnArrow}>›</span>
          </button>
        </div>

        {/* BrownWorks4U2 Brand */}
        <div style={styles.brandSection}>
          <div style={styles.brandHeader}>
            <span style={styles.brandHeaderEmoji}>🏢</span>
            <div style={styles.brandHeaderText}>
              <p style={styles.brandHeaderTitle}>BROWNWORKS4U2 LLC</p>
              <p style={styles.brandHeaderSub}>Woman-owned · Minority-owned · Virginia</p>
            </div>
          </div>
          <p style={styles.brandTagline}>"Built by a woman who needed this and could not find it. So she built it herself."</p>
          <p style={styles.brandDesc}>FLASHYAF™ is a product of BROWNWORKS4U2 LLC — a woman-owned, minority-owned company based in Virginia, built from lived experience.</p>
          <div style={styles.brandDivisionsLabel}>Our Divisions</div>
          <div style={styles.brandDivisions}>
            {[{ icon: "🔥", name: "FLASHYAF™", desc: "Digital Health Innovation" },{ icon: "🎨", name: "BrownMark Designz", desc: "Apparel & Merchandise" },{ icon: "⚙️", name: "BrownWorks4U2", desc: "Service Based Operations" }].map((d) => (
              <div key={d.name} style={styles.brandDivisionRow}>
                <span style={styles.brandDivisionIcon}>{d.icon}</span>
                <div style={styles.brandDivisionInfo}><span style={styles.brandDivisionName}>{d.name}</span><span style={styles.brandDivisionDesc}>{d.desc}</span></div>
              </div>
            ))}
          </div>
          <div style={styles.brandFounderRow}><span style={styles.brandFounderLabel}>Founder</span><span style={styles.brandFounderName}>Iva Marie Brown-Ziegler</span></div>
          <div style={styles.brandSocialRow}>
            {[{ icon: "📸", handle: "@flashyaf", label: "Instagram", href: "https://instagram.com/flashyaf" },{ icon: "🎵", handle: "@flashyaf", label: "TikTok", href: "https://tiktok.com/@flashyaf" },{ icon: "👥", handle: "FLASHYAF", label: "Facebook", href: "https://facebook.com/flashyaf" }].map((s) => (
              <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" style={styles.brandSocialBtn}>
                <span style={styles.brandSocialIcon}>{s.icon}</span>
                <span style={styles.brandSocialLabel}>{s.label}</span>
              </a>
            ))}
          </div>
          <a href="mailto:contact@flashyafapp.com" style={styles.brandEmailLink}>✉️ contact@flashyafapp.com</a>
        </div>

        <button style={styles.signOutBtn} onClick={handleSignOut}>Sign Out</button>

        {/* Delete My Data */}
        <div style={styles.deleteSection}>
          <p style={styles.deleteSectionLabel}>⚠️ Danger Zone</p>
          <button style={styles.deleteBtn} onClick={() => { setShowDeleteModal(true); setDeleteInput(""); setDeleteError(""); }}>
            <span style={styles.deleteBtnIcon}>🗑️</span>
            <div style={styles.deleteBtnText}><span style={styles.deleteBtnTitle}>Delete My Data</span><span style={styles.deleteBtnSub}>Permanently remove all flashes, check-ins, and account data</span></div>
          </button>
        </div>
      </div>

      {/* Milestone Modal */}
      {showMilestoneModal && celebratedMilestone && (
        <div style={styles.milestoneModalBackdrop} onClick={dismissMilestoneModal}>
          <div style={styles.milestoneModalSheet} onClick={(e) => e.stopPropagation()}>
            <div style={styles.milestoneModalEmojiBubble}><span style={styles.milestoneModalEmoji}>🎉</span></div>
            <p style={styles.milestoneModalTitle}>You earned a reward!</p>
            <p style={styles.milestoneModalMilestone}>{celebratedMilestone.count} referral{celebratedMilestone.count !== 1 ? "s" : ""} reached</p>
            {celebratedMilestone.code ? (
              <>
                <p style={styles.milestoneModalSub}>Use this code for <strong style={{ color: "#FFD700" }}>30% off</strong> your next FLASHYAF™ Shop order:</p>
                <div style={styles.milestoneCodeBox}><span style={styles.milestoneCodeBoxText}>{celebratedMilestone.code}</span><button style={styles.milestoneCodeCopyBtn} onClick={() => handleCopyMerchCode(celebratedMilestone.code!)}>Copy</button></div>
                <button style={styles.milestoneShopNowBtn} onClick={() => { window.open("https://brownworks4u2.myshopify.com", "_blank"); dismissMilestoneModal(); }}>Shop Now →</button>
              </>
            ) : (
              <p style={styles.milestoneModalSub}>{celebratedMilestone.icon} <strong>{celebratedMilestone.label}</strong> has been added to your profile!</p>
            )}
            <button style={styles.milestoneGotItBtn} onClick={dismissMilestoneModal}>Got it! ✨</button>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalSheet}>
            {deleting ? (
              <div style={styles.deletingState}>
                <div style={styles.deletingSpinner}>🗑️</div>
                <p style={styles.deletingTitle}>Deleting your data…</p>
                <p style={styles.deletingSub}>This may take a few seconds. Do not close the app.</p>
              </div>
            ) : (
              <>
                <div style={styles.modalIconWrap}><span style={styles.modalIcon}>⚠️</span></div>
                <p style={styles.modalTitle}>Delete All My Data</p>
                <p style={styles.modalSub}>This will permanently and irreversibly delete everything.</p>
                <p style={styles.modalConfirmLabel}>Type <strong style={{ color: "#FF6B6B" }}>DELETE</strong> to confirm</p>
                <input style={{ ...styles.modalInput, borderColor: deleteInput.toUpperCase() === "DELETE" ? "rgba(255,107,107,0.6)" : "rgba(255,255,255,0.12)" }} type="text" placeholder="Type DELETE here" value={deleteInput} onChange={(e) => { setDeleteInput(e.target.value); setDeleteError(""); }} autoCapitalize="characters" spellCheck={false} />
                {deleteError && <p style={styles.deleteErrMsg}>{deleteError}</p>}
                <button style={{ ...styles.modalDeleteBtn, background: deleteInput.trim().toUpperCase() === "DELETE" ? "linear-gradient(135deg, #922B21 0%, #C0392B 100%)" : "rgba(255,255,255,0.06)", color: deleteInput.trim().toUpperCase() === "DELETE" ? "#fff" : "rgba(255,255,255,0.2)", cursor: deleteInput.trim().toUpperCase() === "DELETE" ? "pointer" : "default" }} onClick={handleDeleteData} disabled={deleteInput.trim().toUpperCase() !== "DELETE"}>
                  🗑️ Permanently Delete Everything
                </button>
                <button style={styles.modalCancelBtn} onClick={() => { setShowDeleteModal(false); setDeleteInput(""); }}>Cancel — Keep My Data</button>
              </>
            )}
          </div>
        </div>
      )}

      <div style={styles.bottomNav}>
        <button style={styles.navBtn} onClick={() => onNavigate("home")}><span>🏠</span><span style={styles.navLabel}>Home</span></button>
        <button style={styles.navBtn} onClick={() => onNavigate("history")}><span>📋</span><span style={styles.navLabel}>History</span></button>
        <button style={styles.navBtn} onClick={() => onNavigate("community")}><span>💬</span><span style={styles.navLabel}>Community</span></button>
        <button style={styles.navBtn} onClick={() => onNavigate("learn")}><span>📚</span><span style={styles.navLabel}>Learn</span></button>
        <button style={styles.navBtn} onClick={() => onNavigate("shop")}><span>🛍️</span><span style={styles.navLabel}>Shop</span></button>
        <button style={{ ...styles.navBtn, ...styles.navBtnActive }} onClick={() => onNavigate("settings")}><span>⚙️</span><span style={styles.navLabel}>Settings</span></button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { minHeight: "100vh", background: "var(--color-bg)", display: "flex", flexDirection: "column", maxWidth: "480px", margin: "0 auto", fontFamily: "'Inter', sans-serif" },
  header: { padding: "20px 24px 16px", borderBottom: "1px solid rgba(255,255,255,0.1)", textAlign: "center" },
  appName: { color: "var(--color-accent)", fontSize: "13px", fontWeight: 900, letterSpacing: "2px", margin: "0 0 4px" },
  headerTitle: { color: "var(--color-text)", fontSize: "22px", fontWeight: 800, margin: 0 },
  content: { flex: 1, padding: "20px", display: "flex", flexDirection: "column", gap: "16px", overflowY: "auto" },
  section: { background: "var(--color-card)", borderRadius: "16px", padding: "16px 18px", border: "1px solid rgba(255,255,255,0.08)", transition: "border 0.3s ease, background 0.3s ease" },
  sectionLabel: { color: "var(--color-text-muted)", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", margin: "0 0 12px" },
  emailRow: { display: "flex", alignItems: "center", gap: "10px" },
  emailIcon: { fontSize: "18px" },
  emailText: { color: "var(--color-text)", fontSize: "15px", fontWeight: 500 },
  nameRow: { display: "flex", gap: "10px" },
  input: { flex: 1, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "10px", padding: "12px 14px", color: "var(--color-text)", fontSize: "15px", outline: "none", minWidth: 0, fontFamily: "'Inter', sans-serif" },
  saveBtn: { background: "var(--color-cool)", border: "none", borderRadius: "10px", color: "var(--color-text)", fontSize: "14px", fontWeight: 700, padding: "12px 18px", cursor: "pointer", whiteSpace: "nowrap", transition: "background 0.2s ease" },
  error: { color: "#FF6B6B", fontSize: "12px", marginTop: "8px" },
  partnerToggleRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" },
  partnerToggleLeft: { display: "flex", alignItems: "center", gap: "12px", flex: 1 },
  partnerIcon: { fontSize: "22px", flexShrink: 0 },
  partnerToggleTitle: { color: "var(--color-text)", fontSize: "14px", fontWeight: 700, margin: 0 },
  partnerToggleSub: { color: "rgba(255,255,255,0.4)", fontSize: "11px", margin: "2px 0 0", lineHeight: 1.4 },
  toggle: { width: "44px", height: "26px", borderRadius: "13px", position: "relative", cursor: "pointer", flexShrink: 0, transition: "background 0.25s ease" },
  toggleKnob: { position: "absolute", top: "4px", width: "18px", height: "18px", borderRadius: "50%", background: "#fff", transition: "left 0.25s ease", boxShadow: "0 1px 4px rgba(0,0,0,0.35)" },
  partnerEmailSection: { marginTop: "16px", paddingTop: "16px", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: "10px" },
  partnerEmailLabel: { color: "rgba(255,255,255,0.5)", fontSize: "12px", fontWeight: 600, margin: 0 },
  previewBox: { background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", padding: "12px 14px" },
  previewLabel: { color: "rgba(255,255,255,0.4)", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", margin: "0 0 6px" },
  previewText: { color: "rgba(255,255,255,0.65)", fontSize: "12px", fontStyle: "italic", lineHeight: 1.5, margin: 0 },
  setupNotice: { background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.25)", borderRadius: "12px", padding: "14px", display: "flex", flexDirection: "column", gap: "8px" },
  setupTitle: { color: "var(--color-accent)", fontSize: "13px", fontWeight: 700, margin: 0 },
  setupBody: { color: "rgba(255,255,255,0.55)", fontSize: "12px", margin: 0, lineHeight: 1.4 },
  setupKeys: { display: "flex", flexDirection: "column", gap: "4px" },
  setupKey: { background: "rgba(0,0,0,0.3)", borderRadius: "6px", padding: "4px 8px", color: "#87CEEB", fontSize: "11px", fontFamily: "monospace", letterSpacing: "0.3px" },
  setupFooter: { color: "rgba(255,255,255,0.4)", fontSize: "11px", margin: 0, lineHeight: 1.5 },
  setupLink: { color: "var(--color-accent)", textDecoration: "none" },
  inlineCode: { background: "rgba(0,0,0,0.3)", borderRadius: "4px", padding: "1px 5px", color: "#87CEEB", fontSize: "10px", fontFamily: "monospace" },
  activeNotice: { color: "#1ABC9C", fontSize: "12px", fontWeight: 600, background: "rgba(26,188,156,0.1)", borderRadius: "10px", padding: "10px 14px", lineHeight: 1.4 },
  wearableBtn: { display: "flex", alignItems: "center", gap: "12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "12px", padding: "14px 16px", cursor: "pointer", width: "100%", textAlign: "left" as const },
  wearableBtnIcon: { fontSize: "22px", flexShrink: 0 },
  wearableBtnText: { flex: 1, display: "flex", flexDirection: "column" as const, gap: "2px" },
  wearableBtnTitle: { color: "var(--color-text)", fontSize: "15px", fontWeight: 700 },
  wearableBtnSub: { color: "rgba(255,255,255,0.4)", fontSize: "11px", fontWeight: 500 },
  wearableBtnRight: { display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 },
  wearableComingSoon: { background: "linear-gradient(90deg, #F5A623, #FFD700)", borderRadius: "100px", padding: "3px 8px", fontSize: "10px", fontWeight: 900, color: "#1A1A1A", letterSpacing: "0.5px" },
  wearableBtnArrow: { color: "var(--color-accent)", fontSize: "20px", fontWeight: 300 },
  patternBtn: { display: "flex", alignItems: "center", gap: "12px", background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.25)", borderRadius: "12px", padding: "14px 16px", cursor: "pointer", width: "100%", textAlign: "left" as const },
  patternBtnIcon: { fontSize: "22px", flexShrink: 0 },
  patternBtnText: { flex: 1, display: "flex", flexDirection: "column" as const, gap: "2px" },
  patternBtnTitle: { color: "var(--color-text)", fontSize: "15px", fontWeight: 700 },
  patternBtnSub: { color: "rgba(255,255,255,0.4)", fontSize: "11px", fontWeight: 500 },
  patternBtnArrow: { color: "var(--color-accent)", fontSize: "20px", fontWeight: 300, flexShrink: 0 },
  telehealthDisclaimer: { display: "flex", alignItems: "flex-start", gap: "8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", padding: "12px 14px", marginBottom: "12px" },
  telehealthDisclaimerIcon: { fontSize: "14px", flexShrink: 0, marginTop: "1px" },
  telehealthDisclaimerText: { color: "rgba(255,255,255,0.4)", fontSize: "11px", fontWeight: 500, lineHeight: 1.55, margin: 0 },
  telehealthCard: { borderRadius: "16px", padding: "14px 14px 12px", display: "flex", flexDirection: "column" as const, gap: "12px", marginBottom: "10px" },
  telehealthCardTop: { display: "flex", alignItems: "flex-start", gap: "12px" },
  telehealthIconCircle: { width: "44px", height: "44px", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  telehealthIcon: { fontSize: "22px", lineHeight: 1 },
  telehealthCardBody: { flex: 1 },
  telehealthTitle: { color: "var(--color-text)", fontSize: "14px", fontWeight: 800, margin: "0 0 4px", lineHeight: 1.3 },
  telehealthDesc: { color: "rgba(255,255,255,0.45)", fontSize: "12px", fontWeight: 500, lineHeight: 1.5, margin: 0 },
  telehealthCta: { display: "block", borderRadius: "100px", color: "#fff", fontSize: "13px", fontWeight: 800, padding: "11px 18px", textAlign: "center" as const, textDecoration: "none", letterSpacing: "0.2px", boxShadow: "0 2px 12px rgba(0,0,0,0.3)" },
  shopBtn: { display: "flex", alignItems: "center", gap: "12px", background: "rgba(255,107,53,0.07)", border: "1px solid rgba(255,107,53,0.2)", borderRadius: "12px", padding: "13px 14px", cursor: "pointer", width: "100%", textAlign: "left" as const },
  shopBtnIcon: { fontSize: "22px", flexShrink: 0 },
  shopBtnText: { flex: 1, display: "flex", flexDirection: "column" as const, gap: "2px" },
  shopBtnTitle: { color: "var(--color-text)", fontSize: "14px", fontWeight: 700 },
  shopBtnSub: { color: "rgba(255,255,255,0.35)", fontSize: "11px", fontWeight: 500 },
  shopBtnRight: { display: "flex", flexDirection: "column" as const, alignItems: "flex-end", gap: "4px", flexShrink: 0 },
  shopDiscount: { background: "rgba(255,215,0,0.15)", border: "1px solid rgba(255,215,0,0.3)", borderRadius: "6px", color: "#FFD700", fontSize: "9px", fontWeight: 900, padding: "2px 7px", letterSpacing: "1px" },
  shopBtnArrow: { color: "var(--color-accent)", fontSize: "20px", fontWeight: 300 },
  howItWorksBtn: { display: "flex", alignItems: "center", gap: "12px", background: "rgba(245,166,35,0.07)", border: "1px solid rgba(245,166,35,0.2)", borderRadius: "12px", padding: "12px 14px", cursor: "pointer", width: "100%", textAlign: "left" as const, marginTop: "12px" },
  howItWorksIcon: { fontSize: "20px", flexShrink: 0 },
  howItWorksBtnText: { flex: 1, display: "flex", flexDirection: "column" as const, gap: "2px" },
  howItWorksBtnTitle: { color: "var(--color-text)", fontSize: "14px", fontWeight: 700 },
  howItWorksBtnSub: { color: "rgba(255,255,255,0.35)", fontSize: "11px", fontWeight: 500 },
  howItWorksBtnArrow: { color: "var(--color-accent)", fontSize: "20px", fontWeight: 300, flexShrink: 0 },
  aboutBox: { textAlign: "center" as const, padding: "8px 0" },
  aboutLine: { color: "var(--color-text)", fontSize: "18px", fontWeight: 800, letterSpacing: "1px", margin: "0 0 4px" },
  aboutSub: { color: "var(--color-text-muted)", fontSize: "13px", margin: 0 },
  brandSection: { background: "linear-gradient(135deg, rgba(192,57,43,0.06) 0%, rgba(142,68,173,0.05) 100%)", border: "1px solid rgba(192,57,43,0.2)", borderRadius: "18px", padding: "20px 16px", display: "flex", flexDirection: "column" as const, gap: "14px" },
  brandHeader: { display: "flex", alignItems: "center", gap: "12px" },
  brandHeaderEmoji: { fontSize: "28px", lineHeight: 1, flexShrink: 0 },
  brandHeaderText: { display: "flex", flexDirection: "column" as const, gap: "2px" },
  brandHeaderTitle: { color: "var(--color-text)", fontSize: "15px", fontWeight: 900, letterSpacing: "1px", margin: 0 },
  brandHeaderSub: { color: "rgba(255,255,255,0.4)", fontSize: "11px", fontWeight: 600, margin: 0 },
  brandTagline: { color: "rgba(255,255,255,0.55)", fontSize: "13px", fontStyle: "italic", lineHeight: 1.55, margin: 0, borderLeft: "3px solid var(--color-accent)", paddingLeft: "12px" },
  brandDesc: { color: "rgba(255,255,255,0.5)", fontSize: "12px", lineHeight: 1.6, margin: 0 },
  brandDivisionsLabel: { color: "rgba(255,255,255,0.3)", fontSize: "10px", fontWeight: 800, textTransform: "uppercase" as const, letterSpacing: "1.5px" },
  brandDivisions: { display: "flex", flexDirection: "column" as const, gap: "6px" },
  brandDivisionRow: { display: "flex", alignItems: "center", gap: "10px", background: "rgba(255,255,255,0.03)", borderRadius: "10px", padding: "10px 12px" },
  brandDivisionIcon: { fontSize: "18px", flexShrink: 0, width: "24px", textAlign: "center" as const },
  brandDivisionInfo: { display: "flex", flexDirection: "column" as const, gap: "1px" },
  brandDivisionName: { color: "var(--color-text)", fontSize: "13px", fontWeight: 700 },
  brandDivisionDesc: { color: "rgba(255,255,255,0.35)", fontSize: "11px", fontWeight: 500 },
  brandFounderRow: { display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(192,57,43,0.07)", border: "1px solid rgba(192,57,43,0.18)", borderRadius: "10px", padding: "10px 14px" },
  brandFounderLabel: { color: "rgba(255,255,255,0.35)", fontSize: "10px", fontWeight: 800, textTransform: "uppercase" as const, letterSpacing: "1px" },
  brandFounderName: { color: "var(--color-text)", fontSize: "13px", fontWeight: 700 },
  brandSocialRow: { display: "flex", gap: "8px" },
  brandSocialBtn: { flex: 1, display: "flex", flexDirection: "column" as const, alignItems: "center", gap: "4px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", padding: "10px 6px", textDecoration: "none", cursor: "pointer" },
  brandSocialIcon: { fontSize: "18px", lineHeight: 1 },
  brandSocialLabel: { color: "rgba(255,255,255,0.4)", fontSize: "9px", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.5px" },
  brandEmailLink: { color: "rgba(255,255,255,0.35)", fontSize: "12px", fontWeight: 500, textAlign: "center" as const, textDecoration: "none" },
  referralCodeBox: { background: "rgba(142,68,173,0.12)", border: "1px solid rgba(142,68,173,0.3)", borderRadius: "14px", padding: "14px 18px", display: "flex", flexDirection: "column" as const, alignItems: "center", gap: "4px" },
  referralCodeLabel: { color: "rgba(142,68,173,0.7)", fontSize: "10px", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "1.5px", margin: 0 },
  referralCodeText: { color: "#fff", fontSize: "28px", fontWeight: 900, letterSpacing: "6px", fontFamily: "'Courier New', monospace", margin: 0 },
  referralProgressWrap: { display: "flex", flexDirection: "column" as const, gap: "6px" },
  referralProgressHeader: { display: "flex", alignItems: "baseline", justifyContent: "space-between" },
  referralProgressLeft: { display: "flex", alignItems: "baseline", gap: "3px" },
  referralProgressCount: { color: "#fff", fontSize: "20px", fontWeight: 900 },
  referralProgressCountLabel: { color: "rgba(255,255,255,0.45)", fontSize: "12px", fontWeight: 600 },
  referralProgressTarget: { color: "rgba(142,68,173,0.8)", fontSize: "11px", fontWeight: 700 },
  referralProgressTrack: { height: "8px", borderRadius: "100px", background: "rgba(255,255,255,0.07)", overflow: "hidden" },
  referralProgressFill: { height: "100%", borderRadius: "100px", background: "linear-gradient(90deg, #8E44AD, #BDC3FF)", transition: "width 0.6s ease" },
  milestoneList: { display: "flex", flexDirection: "column" as const, gap: "8px" },
  milestoneRow: { display: "flex", alignItems: "center", gap: "10px", background: "rgba(255,255,255,0.03)", borderRadius: "10px", padding: "10px 10px" },
  milestoneDot: { width: "28px", height: "28px", borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" },
  milestoneDotInner: { color: "#fff", fontSize: "11px", fontWeight: 900 },
  milestoneInfo: { flex: 1, display: "flex", flexDirection: "column" as const, gap: "1px", minWidth: 0 },
  milestoneCount: { color: "rgba(255,255,255,0.45)", fontSize: "10px", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.5px" },
  milestoneRewardText: { color: "var(--color-text)", fontSize: "12px", fontWeight: 700 },
  milestoneCodePill: { background: "rgba(255,215,0,0.15)", border: "1px solid rgba(255,215,0,0.35)", borderRadius: "8px", color: "#FFD700", fontSize: "10px", fontWeight: 900, padding: "4px 10px", cursor: "pointer", letterSpacing: "1px", flexShrink: 0 },
  milestoneModalBackdrop: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100 },
  milestoneModalSheet: { background: "linear-gradient(180deg, #1C0B2E 0%, #0E0617 100%)", border: "1px solid rgba(142,68,173,0.35)", borderRadius: "24px 24px 0 0", padding: "32px 24px 48px", width: "100%", maxWidth: "480px", display: "flex", flexDirection: "column" as const, alignItems: "center", gap: "14px", boxShadow: "0 -8px 40px rgba(142,68,173,0.25)" },
  milestoneModalEmojiBubble: { width: "72px", height: "72px", borderRadius: "50%", background: "linear-gradient(135deg, rgba(142,68,173,0.3), rgba(108,52,131,0.2))", border: "1px solid rgba(142,68,173,0.4)", display: "flex", alignItems: "center", justifyContent: "center" },
  milestoneModalEmoji: { fontSize: "36px", lineHeight: 1 },
  milestoneModalTitle: { color: "#fff", fontSize: "22px", fontWeight: 900, margin: 0, textAlign: "center" as const },
  milestoneModalMilestone: { color: "rgba(142,68,173,0.8)", fontSize: "12px", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "1.5px", margin: 0 },
  milestoneModalSub: { color: "rgba(255,255,255,0.7)", fontSize: "15px", lineHeight: 1.5, textAlign: "center" as const, margin: 0 },
  milestoneCodeBox: { display: "flex", alignItems: "center", gap: "10px", background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.3)", borderRadius: "14px", padding: "12px 16px", width: "100%", justifyContent: "space-between" },
  milestoneCodeBoxText: { color: "#FFD700", fontSize: "24px", fontWeight: 900, letterSpacing: "4px", fontFamily: "'Courier New', monospace" },
  milestoneCodeCopyBtn: { background: "rgba(255,215,0,0.2)", border: "1px solid rgba(255,215,0,0.4)", borderRadius: "8px", color: "#FFD700", fontSize: "12px", fontWeight: 800, padding: "6px 14px", cursor: "pointer" },
  milestoneShopNowBtn: { width: "100%", border: "none", borderRadius: "14px", background: "linear-gradient(135deg, #FF4500, #C0392B)", color: "#fff", fontSize: "16px", fontWeight: 800, padding: "16px", cursor: "pointer", boxShadow: "0 4px 20px rgba(255,69,0,0.3)" },
  milestoneGotItBtn: { width: "100%", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "14px", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)", fontSize: "15px", fontWeight: 700, padding: "14px", cursor: "pointer" },
  shareBtn: { width: "100%", border: "none", borderRadius: "14px", color: "#fff", fontSize: "16px", fontWeight: 800, padding: "16px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", boxShadow: "0 4px 20px rgba(142,68,173,0.35)", transition: "opacity 0.2s ease, background 0.2s ease", fontFamily: "'Inter', sans-serif" },
  shareBtnIcon: { fontSize: "20px" },
  referralNote: { color: "rgba(255,255,255,0.3)", fontSize: "12px", lineHeight: 1.5, textAlign: "center" as const, margin: 0 },
  deleteSection: { display: "flex", flexDirection: "column" as const, gap: "10px", padding: "4px 0 0" },
  deleteSectionLabel: { color: "rgba(255,107,107,0.6)", fontSize: "10px", fontWeight: 800, textTransform: "uppercase" as const, letterSpacing: "1.5px", margin: 0 },
  deleteBtn: { display: "flex", alignItems: "center", gap: "14px", background: "rgba(192,57,43,0.07)", border: "1px solid rgba(192,57,43,0.25)", borderRadius: "14px", padding: "14px 16px", cursor: "pointer", width: "100%", textAlign: "left" as const, transition: "background 0.2s ease" },
  deleteBtnIcon: { fontSize: "22px", flexShrink: 0 },
  deleteBtnText: { flex: 1, display: "flex", flexDirection: "column" as const, gap: "2px" },
  deleteBtnTitle: { color: "#FF6B6B", fontSize: "15px", fontWeight: 700 },
  deleteBtnSub: { color: "rgba(255,107,107,0.5)", fontSize: "11px", fontWeight: 500 },
  modalBackdrop: { position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "flex-end", justifyContent: "center" },
  modalSheet: { background: "#1A1A1A", borderRadius: "28px 28px 0 0", padding: "28px 24px 44px", width: "100%", maxWidth: "480px", border: "1px solid rgba(192,57,43,0.3)", boxShadow: "0 -20px 60px rgba(0,0,0,0.7)", display: "flex", flexDirection: "column" as const, gap: "14px" },
  modalIconWrap: { width: "56px", height: "56px", borderRadius: "16px", background: "rgba(192,57,43,0.12)", border: "1px solid rgba(192,57,43,0.3)", display: "flex", alignItems: "center", justifyContent: "center", alignSelf: "center" },
  modalIcon: { fontSize: "28px", lineHeight: 1 },
  modalTitle: { color: "#fff", fontSize: "20px", fontWeight: 900, textAlign: "center" as const, margin: 0 },
  modalSub: { color: "rgba(255,255,255,0.45)", fontSize: "13px", textAlign: "center" as const, margin: 0, lineHeight: 1.5 },
  modalConfirmLabel: { color: "rgba(255,255,255,0.5)", fontSize: "13px", textAlign: "center" as const, margin: 0 },
  modalInput: { background: "rgba(255,255,255,0.06)", border: "1.5px solid rgba(255,255,255,0.12)", borderRadius: "12px", color: "#FF6B6B", fontSize: "18px", fontWeight: 800, fontFamily: "'Courier New', monospace", padding: "14px 16px", outline: "none", textAlign: "center" as const, letterSpacing: "4px", width: "100%", boxSizing: "border-box" as const },
  deleteErrMsg: { color: "#FF6B6B", fontSize: "12px", fontWeight: 600, textAlign: "center" as const, margin: 0 },
  modalDeleteBtn: { border: "none", borderRadius: "14px", fontSize: "15px", fontWeight: 800, padding: "17px", letterSpacing: "0.3px", transition: "all 0.2s ease", fontFamily: "'Inter', sans-serif", width: "100%" },
  modalCancelBtn: { background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "14px", color: "rgba(255,255,255,0.45)", fontSize: "14px", fontWeight: 600, padding: "14px", cursor: "pointer", fontFamily: "'Inter', sans-serif", width: "100%" },
  deletingState: { display: "flex", flexDirection: "column" as const, alignItems: "center", gap: "12px", padding: "20px 0" },
  deletingSpinner: { fontSize: "48px", lineHeight: 1, animation: "pulse 1.5s ease-in-out infinite" },
  deletingTitle: { color: "#fff", fontSize: "18px", fontWeight: 800, margin: 0 },
  deletingSub: { color: "rgba(255,255,255,0.4)", fontSize: "13px", textAlign: "center" as const, margin: 0, lineHeight: 1.5 },
  searchRow: { display: "flex", alignItems: "center", gap: "10px", padding: "10px 20px 0", background: "var(--color-bg)" },
  searchIcon: { fontSize: "16px", flexShrink: 0 },
  searchInput: { flex: 1, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", color: "#fff", fontSize: "14px", fontWeight: 500, padding: "10px 14px", outline: "none", fontFamily: "'Inter', sans-serif" },
  searchClear: { background: "transparent", border: "none", color: "rgba(255,255,255,0.35)", fontSize: "14px", cursor: "pointer", padding: "4px 6px", flexShrink: 0 },
  ambBadgeHero: { display: "flex", alignItems: "center", gap: "14px", padding: "4px 0 16px" },
  ambBadgeRing: { width: "68px", height: "68px", borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg, #FFD700, #B8860B)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 24px rgba(255,215,0,0.35), 0 0 48px rgba(255,215,0,0.12)" },
  ambTitle: { color: "#FFD700", fontSize: "15px", fontWeight: 900, margin: "0 0 3px", letterSpacing: "1px" },
  ambSubtitle: { color: "rgba(255,215,0,0.55)", fontSize: "12px", fontWeight: 700, letterSpacing: "0.5px", margin: 0 },
  ambDivider: { height: "1px", background: "linear-gradient(90deg, transparent, rgba(255,215,0,0.25), transparent)", margin: "4px 0 16px" },
  ambSectionLabel: { color: "rgba(255,215,0,0.75)", fontSize: "11px", fontWeight: 900, letterSpacing: "1px", textTransform: "uppercase" as const, margin: "0 0 10px" },
  ambVideoCard: { background: "rgba(255,215,0,0.05)", border: "1px solid rgba(255,215,0,0.2)", borderRadius: "16px", overflow: "hidden", display: "flex", flexDirection: "column" as const },
  ambVideoThumb: { height: "160px", background: "linear-gradient(160deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)", position: "relative" as const, display: "flex", alignItems: "center", justifyContent: "center" },
  ambVideoPlayBtn: { width: "56px", height: "56px", borderRadius: "50%", background: "rgba(255,215,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", color: "#0A0A0A", fontWeight: 900, boxShadow: "0 0 30px rgba(255,215,0,0.4)", position: "relative" as const, zIndex: 2 },
  ambVideoGrad: { position: "absolute" as const, inset: 0, background: "radial-gradient(circle at 30% 70%, rgba(255,215,0,0.08) 0%, transparent 60%)", zIndex: 1 },
  ambVideoOverlay: { position: "absolute" as const, bottom: "12px", left: "14px", zIndex: 2 },
  ambVideoTitle: { color: "#fff", fontSize: "13px", fontWeight: 800, margin: "0 0 2px" },
  ambVideoSub: { color: "rgba(255,255,255,0.5)", fontSize: "11px", fontWeight: 600, margin: 0 },
  ambVideoCaption: { color: "rgba(255,255,255,0.65)", fontSize: "13px", lineHeight: 1.65, fontStyle: "italic", margin: 0, padding: "14px 14px 4px" },
  ambVideoSig: { color: "rgba(255,215,0,0.6)", fontSize: "12px", fontWeight: 700, margin: 0, padding: "4px 14px 14px" },
  ambCodeCard: { background: "rgba(255,215,0,0.07)", border: "1.5px solid rgba(255,215,0,0.3)", borderRadius: "14px", padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" },
  ambCodeInner: { flex: 1 },
  ambCodeLabel: { color: "rgba(255,215,0,0.5)", fontSize: "11px", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.8px", margin: "0 0 3px" },
  ambCodeText: { color: "#FFD700", fontSize: "20px", fontWeight: 900, letterSpacing: "3px", fontFamily: "'Courier New', monospace", margin: 0 },
  ambCodeCopyBtn: { border: "1px solid", borderRadius: "10px", fontSize: "13px", fontWeight: 800, padding: "9px 16px", cursor: "pointer", fontFamily: "'Inter', sans-serif", flexShrink: 0 },
  ambCodeNote: { color: "rgba(255,255,255,0.3)", fontSize: "11px", lineHeight: 1.55, margin: "8px 0 0" },
  ambEarlyList: { display: "flex", flexDirection: "column" as const, gap: "8px" },
  ambEarlyItem: { display: "flex", alignItems: "center", gap: "12px", background: "rgba(255,215,0,0.04)", border: "1px solid rgba(255,215,0,0.12)", borderRadius: "12px", padding: "12px 12px" },
  ambEarlyIconCircle: { width: "38px", height: "38px", borderRadius: "10px", background: "rgba(255,215,0,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  ambEarlyLabel: { color: "#fff", fontSize: "13px", fontWeight: 800, margin: "0 0 2px" },
  ambEarlySub: { color: "rgba(255,255,255,0.4)", fontSize: "11px", lineHeight: 1.4, margin: 0 },
  ambEarlyPill: { background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.25)", borderRadius: "100px", color: "rgba(255,215,0,0.6)", fontSize: "9px", fontWeight: 900, padding: "4px 8px", letterSpacing: "0.5px", flexShrink: 0, whiteSpace: "nowrap" as const },
  ambCommunityCard: { background: "rgba(255,215,0,0.05)", border: "1px solid rgba(255,215,0,0.2)", borderRadius: "14px", padding: "14px", display: "flex", flexDirection: "column" as const, gap: "12px" },
  ambCommunityLeft: { display: "flex", gap: "12px", alignItems: "flex-start" },
  ambCommunityTitle: { color: "#FFD700", fontSize: "14px", fontWeight: 900, margin: "0 0 4px" },
  ambCommunitySub: { color: "rgba(255,255,255,0.5)", fontSize: "12px", lineHeight: 1.55, margin: 0 },
  ambCommunityBtn: { display: "block", width: "100%", background: "linear-gradient(135deg, rgba(255,215,0,0.25), rgba(184,134,11,0.2))", border: "1px solid rgba(255,215,0,0.4)", borderRadius: "12px", color: "#FFD700", fontSize: "14px", fontWeight: 900, padding: "13px", textAlign: "center" as const, textDecoration: "none", cursor: "pointer", fontFamily: "'Inter', sans-serif" },
  ambNlSuccessCard: { background: "rgba(255,215,0,0.06)", border: "1px solid rgba(255,215,0,0.2)", borderRadius: "14px", padding: "14px", display: "flex", gap: "12px", alignItems: "center" },
  ambNlSuccessTitle: { color: "#FFD700", fontSize: "14px", fontWeight: 900, margin: "0 0 3px" },
  ambNlSuccessSub: { color: "rgba(255,255,255,0.4)", fontSize: "12px", lineHeight: 1.5, margin: 0 },
  ambNlCard: { background: "rgba(255,215,0,0.05)", border: "1px solid rgba(255,215,0,0.18)", borderRadius: "14px", padding: "14px", display: "flex", flexDirection: "column" as const, gap: "12px" },
  ambNlCardText: { color: "rgba(255,255,255,0.55)", fontSize: "13px", lineHeight: 1.65, margin: 0 },
  ambNlBtn: { width: "100%", border: "none", borderRadius: "12px", background: "linear-gradient(135deg, #B8860B, #8B6914)", color: "#0A0A0A", fontSize: "14px", fontWeight: 900, padding: "14px", cursor: "pointer", fontFamily: "'Inter', sans-serif", boxShadow: "0 4px 20px rgba(184,134,11,0.35)" },
  ambTeaserHeader: { display: "flex", alignItems: "center", gap: "14px", padding: "4px 0 14px" },
  ambTeaserLock: { width: "56px", height: "56px", borderRadius: "50%", flexShrink: 0, background: "rgba(184,134,11,0.1)", border: "2px dashed rgba(184,134,11,0.35)", display: "flex", alignItems: "center", justifyContent: "center", filter: "grayscale(0.6) opacity(0.7)" },
  ambTeaserTitle: { color: "rgba(255,215,0,0.6)", fontSize: "14px", fontWeight: 900, margin: "0 0 3px", letterSpacing: "0.5px" },
  ambTeaserSub: { color: "rgba(255,255,255,0.35)", fontSize: "12px", fontWeight: 600, margin: 0 },
  ambTeaserProgress: { display: "flex", flexDirection: "column" as const, gap: "7px", marginBottom: "14px" },
  ambTeaserProgressHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  ambTeaserProgressLabel: { color: "rgba(255,215,0,0.5)", fontSize: "12px", fontWeight: 700 },
  ambTeaserProgressRight: { color: "rgba(255,255,255,0.3)", fontSize: "12px", fontWeight: 600 },
  ambTeaserTrack: { height: "6px", borderRadius: "100px", background: "rgba(255,215,0,0.1)", overflow: "hidden" },
  ambTeaserFill: { height: "100%", borderRadius: "100px", background: "linear-gradient(90deg, #8B6914, #FFD700)", transition: "width 0.6s ease" },
  ambTeaserPerksTitle: { color: "rgba(255,255,255,0.4)", fontSize: "12px", fontWeight: 700, margin: "0 0 10px", textTransform: "uppercase" as const, letterSpacing: "0.8px" },
  ambTeaserPerksList: { display: "flex", flexDirection: "column" as const, gap: "8px" },
  ambTeaserPerkRow: { display: "flex", alignItems: "flex-start", gap: "10px", background: "rgba(255,255,255,0.02)", borderRadius: "10px", padding: "10px 12px" },
  ambTeaserPerkText: { color: "rgba(255,255,255,0.35)", fontSize: "13px", lineHeight: 1.4, margin: 0 },
  signOutBtn: { background: "rgba(192,57,43,0.2)", border: "1px solid rgba(192,57,43,0.4)", borderRadius: "14px", color: "#FF6B6B", fontSize: "16px", fontWeight: 700, padding: "16px", cursor: "pointer", marginTop: "8px" },
  bottomNav: { display: "flex", borderTop: "1px solid rgba(255,255,255,0.1)", background: "var(--color-bg)", padding: "12px 0 20px" },
  navBtn: { flex: 1, background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", display: "flex", flexDirection: "column" as const, alignItems: "center", gap: "4px", cursor: "pointer", fontSize: "22px", padding: "4px 0" },
  navBtnActive: { color: "var(--color-accent)" },
  navLabel: { fontSize: "11px", fontWeight: 600 },
};