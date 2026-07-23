import { useState, useEffect, useRef } from "react";

const COUNT_KEY = "flashyaf_open_count";
const DISMISSED_KEY = "flashyaf_install_dismissed";
const MIN_OPENS = 3;

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !("MSStream" in window);
}
function isAndroid(): boolean {
  return /android/i.test(navigator.userAgent);
}
function isStandalone(): boolean {
  return (
    (navigator as { standalone?: boolean }).standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function AddToHomescreenBanner() {
  const [show, setShow] = useState(false);
  const [canNativeInstall, setCanNativeInstall] = useState(false);
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone()) return;
    if (localStorage.getItem(DISMISSED_KEY)) return;

    const count = parseInt(localStorage.getItem(COUNT_KEY) || "0", 10) + 1;
    localStorage.setItem(COUNT_KEY, count.toString());
    if (count >= MIN_OPENS) setShow(true);

    function onPrompt(e: Event) {
      e.preventDefault();
      deferredRef.current = e as BeforeInstallPromptEvent;
      setCanNativeInstall(true);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setShow(false);
  }

  async function handleNativeInstall() {
    if (!deferredRef.current) return;
    await deferredRef.current.prompt();
    const { outcome } = await deferredRef.current.userChoice;
    if (outcome === "accepted") localStorage.setItem(DISMISSED_KEY, "1");
    deferredRef.current = null;
    setShow(false);
  }

  if (!show) return null;

  const ios = isIOS();
  const android = isAndroid();

  return (
    <div style={{
      position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
      width: "100%", maxWidth: "480px", zIndex: 998,
      background: "#161616",
      borderRadius: "20px 20px 0 0",
      padding: `20px 20px calc(20px + env(safe-area-inset-bottom))`,
      border: "1px solid rgba(255,107,53,0.25)",
      boxShadow: "0 -20px 60px rgba(0,0,0,0.75), 0 -4px 20px rgba(255,107,53,0.15)",
      animation: "slideUp 0.35s ease",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", marginBottom: "14px" }}>
        <span style={{ fontSize: "36px", flexShrink: 0, lineHeight: 1 }}>🔥</span>
        <div style={{ flex: 1 }}>
          <p style={{ color: "#fff", fontSize: "16px", fontWeight: 800, margin: "0 0 4px", letterSpacing: "-0.2px" }}>
            Add FLASHYAF™ to your home screen
          </p>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "13px", margin: 0, lineHeight: 1.5 }}>
            Instant access. Full screen. No browser bar. The real experience.
          </p>
        </div>
        <button
          onClick={dismiss}
          style={{
            background: "none", border: "none", color: "rgba(255,255,255,0.35)",
            fontSize: "18px", cursor: "pointer", padding: "2px", minHeight: "auto",
            flexShrink: 0, lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>

      {ios && (
        <div style={{
          background: "rgba(255,255,255,0.06)", borderRadius: "14px",
          padding: "14px 16px", marginBottom: "10px",
        }}>
          <p style={{ color: "rgba(255,255,255,0.9)", fontSize: "13px", fontWeight: 700, margin: "0 0 8px" }}>
            On iPhone or iPad:
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "13px", margin: 0, lineHeight: 1.5 }}>
              1. Tap the <strong style={{ color: "#fff" }}>Share ⬆️</strong> button at the bottom of Safari
            </p>
            <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "13px", margin: 0, lineHeight: 1.5 }}>
              2. Scroll down and tap <strong style={{ color: "#FF6B35" }}>"Add to Home Screen"</strong>
            </p>
            <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "13px", margin: 0, lineHeight: 1.5 }}>
              3. Tap <strong style={{ color: "#fff" }}>Add</strong> in the top right
            </p>
          </div>
        </div>
      )}

      {android && canNativeInstall && (
        <button
          onClick={handleNativeInstall}
          style={{
            width: "100%", background: "linear-gradient(135deg, #C0392B, #FF6B35)",
            border: "none", borderRadius: "100px", color: "#fff",
            fontSize: "16px", fontWeight: 800, padding: "16px 24px",
            cursor: "pointer", marginBottom: "10px",
            boxShadow: "0 4px 20px rgba(192,57,43,0.5)",
          }}
        >
          🔥 Install FLASHYAF™
        </button>
      )}

      {android && !canNativeInstall && (
        <div style={{
          background: "rgba(255,255,255,0.06)", borderRadius: "14px",
          padding: "14px 16px", marginBottom: "10px",
        }}>
          <p style={{ color: "rgba(255,255,255,0.9)", fontSize: "13px", fontWeight: 700, margin: "0 0 8px" }}>
            On Android (Chrome):
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "13px", margin: 0, lineHeight: 1.5 }}>
              1. Tap the <strong style={{ color: "#fff" }}>menu ⋮</strong> in the top right of Chrome
            </p>
            <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "13px", margin: 0, lineHeight: 1.5 }}>
              2. Tap <strong style={{ color: "#FF6B35" }}>"Add to Home screen"</strong>
            </p>
          </div>
        </div>
      )}

      {!ios && !android && (
        <div style={{
          background: "rgba(255,255,255,0.06)", borderRadius: "14px",
          padding: "14px 16px", marginBottom: "10px",
        }}>
          <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "13px", margin: 0, lineHeight: 1.5 }}>
            Open FLASHYAF™ in <strong style={{ color: "#fff" }}>Chrome or Safari on your phone</strong> for the full install experience.
          </p>
        </div>
      )}

      <button
        onClick={dismiss}
        style={{
          width: "100%", background: "none", border: "none",
          color: "rgba(255,255,255,0.3)", fontSize: "13px", fontWeight: 600,
          padding: "8px", cursor: "pointer",
        }}
      >
        Not now — I'll use it in the browser
      </button>
    </div>
  );
}
