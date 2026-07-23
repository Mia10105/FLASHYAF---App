import { useState, useEffect } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { trackEvent } from "@/lib/analytics";
import { attributeReferral, getReferralCode } from "@/lib/referral";

export default function AuthScreen() {
  const [isSignUp, setIsSignUp] = useState(false);

  // Capture referral code from URL on mount (?ref=CODE)
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) sessionStorage.setItem("flashyaf_pending_ref", ref.toUpperCase());
  }, []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isSignUp) {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        trackEvent("user_signup", { method: "email" });
        if (displayName.trim()) {
          await updateProfile(cred.user, { displayName: displayName.trim() });
        }
        await setDoc(doc(db, "users", cred.user.uid), {
          email: cred.user.email,
          displayName: displayName.trim() || null,
          createdAt: serverTimestamp(),
          lastActiveAt: serverTimestamp(),
          referralCode: getReferralCode(cred.user.uid),
          referralCount: 0,
        });
        // Attribute referral if the user came via a referral link
        const pendingRef = sessionStorage.getItem("flashyaf_pending_ref");
        if (pendingRef && pendingRef !== getReferralCode(cred.user.uid)) {
          try {
            await attributeReferral(pendingRef, cred.user.uid);
            sessionStorage.removeItem("flashyaf_pending_ref");
          } catch { /* silent */ }
        }
      } else {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", cred.user.uid), {
          email: cred.user.email,
          displayName: cred.user.displayName || null,
          lastActiveAt: serverTimestamp(),
        }, { merge: true });
      }
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message.replace("Firebase: ", ""));
      else setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logoArea}>
          <div style={styles.flame}>🔥</div>
          <h1 style={styles.appName}>FLASHYAF™</h1>
          <p style={styles.tagline}>Your hot flash. Your data. Your power.</p>
        </div>

        <h2 style={styles.formTitle}>{isSignUp ? "Create Account" : "Welcome Back"}</h2>

        <form onSubmit={handleSubmit} style={styles.form}>
          {isSignUp && (
            <input
              style={styles.input}
              type="text"
              placeholder="Your name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          )}
          <input
            style={styles.input}
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            style={styles.input}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p style={styles.error}>{error}</p>}
          <button style={styles.submitBtn} type="submit" disabled={loading}>
            {loading ? "Please wait..." : isSignUp ? "Sign Up" : "Log In"}
          </button>
        </form>

        <button style={styles.switchBtn} onClick={() => { setIsSignUp(!isSignUp); setError(""); }}>
          {isSignUp ? "Already have an account? Log in" : "New here? Sign up"}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    background: "var(--color-bg)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    fontFamily: "'Inter', sans-serif",
  },
  card: {
    background: "var(--color-card)",
    backdropFilter: "blur(12px)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "24px",
    padding: "40px 32px",
    width: "100%",
    maxWidth: "420px",
    boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
  },
  logoArea: {
    textAlign: "center",
    marginBottom: "32px",
  },
  flame: {
    fontSize: "56px",
    display: "block",
    marginBottom: "8px",
  },
  appName: {
    color: "var(--color-accent)",
    fontSize: "32px",
    fontWeight: 900,
    letterSpacing: "2px",
    margin: "0 0 6px 0",
  },
  tagline: {
    color: "var(--color-text-muted)",
    fontSize: "13px",
    margin: 0,
  },
  formTitle: {
    color: "var(--color-text)",
    fontSize: "20px",
    fontWeight: 700,
    marginBottom: "20px",
    textAlign: "center",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  input: {
    background: "rgba(255,255,255,0.1)",
    border: "1px solid rgba(255,255,255,0.2)",
    borderRadius: "12px",
    padding: "14px 16px",
    color: "var(--color-text)",
    fontSize: "16px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  error: {
    color: "#FF6B6B",
    fontSize: "13px",
    margin: 0,
    background: "rgba(255,107,107,0.1)",
    padding: "8px 12px",
    borderRadius: "8px",
  },
  submitBtn: {
    background: "var(--color-primary)",
    color: "var(--color-text)",
    border: "none",
    borderRadius: "14px",
    padding: "16px",
    fontSize: "16px",
    fontWeight: 700,
    cursor: "pointer",
    marginTop: "4px",
    letterSpacing: "0.5px",
  },
  switchBtn: {
    background: "transparent",
    border: "none",
    color: "var(--color-text-muted)",
    fontSize: "14px",
    cursor: "pointer",
    marginTop: "20px",
    display: "block",
    width: "100%",
    textAlign: "center",
    textDecoration: "underline",
  },
};
