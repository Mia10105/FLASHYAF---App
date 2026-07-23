import { useState, useEffect, useRef } from "react";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { DemoProvider } from "@/context/DemoContext";
import AuthScreen from "@/pages/AuthScreen";
import ConsentScreen from "@/pages/ConsentScreen";
import OnboardingScreen from "@/pages/OnboardingScreen";
import HomeScreen from "@/pages/HomeScreen";
import LiveFlashScreen from "@/pages/LiveFlashScreen";
import SummaryScreen from "@/pages/SummaryScreen";
import HistoryScreen from "@/pages/HistoryScreen";
import CommunityScreen from "@/pages/CommunityScreen";
import LearnScreen from "@/pages/LearnScreen";
import ShopScreen from "@/pages/ShopScreen";
import SettingsScreen from "@/pages/SettingsScreen";
import PatternIntelligenceScreen from "@/pages/PatternIntelligenceScreen";
import AdminDashboardScreen from "@/pages/AdminDashboardScreen";
import AffiliateScreen from "@/pages/AffiliateScreen";
import WearableScreen from "@/pages/WearableScreen";
import MonthlyReportScreen from "@/pages/MonthlyReportScreen";
import TutorialScreen from "@/pages/TutorialScreen";
import AboutScreen from "@/pages/AboutScreen";
import FeedbackScreen from "@/pages/FeedbackScreen";
import HeatLogScreen from "@/pages/HeatLogScreen";
import type { Flash } from "@/types/flash";

const CONSENT_KEY     = "flashyaf_consent_done";
const ONBOARDING_KEY  = "flashyaf_onboarding_done";
// 30-second privacy-sleep window (spec: "30-Second Privacy Sleep Protocols")
const COMMAND_WINDOW_MS = 30_000;

type Screen =
  | "home" | "live-flash" | "summary"
  | "history" | "community" | "learn" | "shop" | "settings"
  | "pattern-intelligence" | "admin" | "affiliate" | "wearable"
  | "monthly-report" | "tutorial" | "about" | "feedback" | "heat-log";

// ── Wake-word routing tables ──────────────────────────────────────────────
// Emergency: bypass window, go straight to live-flash
const EMERGENCY_TRIGGERS = [
  "blazing", "i'm blazing", "im blazing",
  "hey flashy i'm blazing", "hey flashy blazing",
  "i'm on fire", "im on fire",
];
const NOTE_TRIGGERS    = ["take a note", "write this down", "add a note", "log this"];
const JOKE_TRIGGERS    = ["tell me a joke", "need a laugh", "make me laugh", "something funny"];
const BREATHE_TRIGGERS = ["breathe with me", "i can't breathe", "i cant breathe", "help me breathe", "breathing"];

const HUMOR_BANK = [
  "Hot flash or just naturally hot? Both, obviously.",
  "My body said: skip the sauna, I'll handle it myself.",
  "Who needs central heating when you've got menopause, honey?",
  "Scientists call it a vasomotor event. I call it my personal summer.",
  "The thermostat and I have a complicated relationship.",
  "I'm not sweating. I'm sparkling.",
  "My superpower? Generating heat on demand. Totally on demand.",
];

function pickFemaleVoice() {
  const vs = window.speechSynthesis?.getVoices() ?? [];
  return vs.find((v) =>
    ["samantha","karen","moira","tessa","victoria","fiona","zira","aria","female"]
      .some((n) => v.name.toLowerCase().includes(n)) && v.lang.startsWith("en")
  ) || vs.find((v) => v.lang.startsWith("en")) || null;
}

function speakGlobal(text: string) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.0; u.pitch = 1.1; u.volume = 1;
  const doSpeak = () => {
    const v = pickFemaleVoice();
    if (v) u.voice = v;
    window.speechSynthesis.speak(u);
  };
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) doSpeak();
  else window.speechSynthesis.addEventListener("voiceschanged", doSpeak, { once: true });
}

function AppInner() {
  const { user, loading } = useAuth();
  const [screen, setScreen]               = useState<Screen>("home");
  const [lastFlash, setLastFlash]         = useState<Flash | null>(null);
  const [consentDone, setConsentDone]     = useState(() => !!localStorage.getItem(CONSENT_KEY));
  const [onboardingDone, setOnboardingDone] = useState(() => !!localStorage.getItem(ONBOARDING_KEY));
  const [globalMicEnabled, setGlobalMicEnabled] = useState(true);

  // ── Flash Forecast Alarm™ — increments every time a flash completes ───────
  // HomeScreen uses this number to know when to re-fetch forecast data.
  const [flashJustCompleted, setFlashJustCompleted] = useState(0);

  // ── Wake-word state ───────────────────────────────────────────────────────
  // micSleeping: recognition is stopped; re-activates on next "Hey Flashy"
  // wakeWindowActive: within the 30-sec command window; HomeScreen shows glow ring
  const [micSleeping, setMicSleeping]           = useState(false);
  const [wakeWindowActive, setWakeWindowActive] = useState(false);

  const globalRecRef = useRef<SpeechRecognition | null>(null);
  // Stale-closure-safe mirrors for state accessed inside the recognition callback
  const micSleepingRef     = useRef(false);
  const wakeWindowRef      = useRef(false);
  const screenRef          = useRef<Screen>("home");
  const globalMicEnabledRef = useRef(true);

  useEffect(() => { micSleepingRef.current = micSleeping; },       [micSleeping]);
  useEffect(() => { wakeWindowRef.current = wakeWindowActive; },   [wakeWindowActive]);
  useEffect(() => { screenRef.current = screen; },                 [screen]);
  useEffect(() => { globalMicEnabledRef.current = globalMicEnabled; }, [globalMicEnabled]);

  // ── Global background wake-word listener ─────────────────────────────────
  //
  // Spec compliance:
  //  1. "Hey Flashy" detected → play personalized greeting, open 30-sec window
  //  2. Secondary command within 30 sec → route to the right screen / action
  //  3. No command within 30 sec → recognition.stop(), "Mic Sleeping" badge
  //  4. Next "Hey Flashy" while sleeping → restart mic, clear sleep state
  //  5. Emergency phrases ("blazing" etc.) → bypass window entirely
  //  6. continuous=true, interimResults=false → no native mobile beep
  //  7. Restart ONLY from onend — never stop+start rapidly
  useEffect(() => {
    const onTrackingScreen = screen === "live-flash" || screen === "summary";
    if (!user || onTrackingScreen || !globalMicEnabled) {
      try { globalRecRef.current?.stop(); } catch {}
      globalRecRef.current = null;
      return;
    }

    const SRAPI = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SRAPI) return;

    const rec: SpeechRecognition = new SRAPI();
    rec.continuous      = true;   // keeps session alive, prevents native beep on mobile
    rec.interimResults  = false;  // only final results — no interim-event beep
    rec.lang            = "en-US";
    globalRecRef.current = rec;

    const alive         = { current: true };
    const pending       = { current: false };
    let commandTimer: ReturnType<typeof setTimeout> | null = null;

    function clearCommandWindow() {
      if (commandTimer) { clearTimeout(commandTimer); commandTimer = null; }
      setWakeWindowActive(false);
      wakeWindowRef.current = false;
    }

    // Restart ONLY from onend — avoids double-start beep
    function restart(ms: number) {
      if (!alive.current || pending.current) return;
      pending.current = true;
      setTimeout(() => {
        pending.current = false;
        if (!alive.current) return;
        try { rec.start(); } catch { restart(Math.min(ms * 2, 4_000)); }
      }, ms);
    }

    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") return;
      // Let onend fire naturally — no manual stop/start
    };
    // When sleeping: onend fires and we do NOT restart. Mic stays quiet.
    rec.onend = () => {
      if (alive.current && !micSleepingRef.current) restart(400);
    };

    rec.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (!event.results[i].isFinal) continue;
        const text = event.results[i][0].transcript.toLowerCase().trim();

        // ── 0. If sleeping, only a new wake word can wake us up ──
        if (micSleepingRef.current) {
          const isWake = text.includes("hey flashy") || text.includes("hey flash") || text === "flashy";
          if (!isWake) continue;
          // Wake from sleep
          setMicSleeping(false);
          micSleepingRef.current = false;
          const name = user.displayName?.split(" ")[0] || user.email?.split("@")[0] || "girlfriend";
          speakGlobal(`Hey girlfriend, I'm here. I've got you, ${name}. Tell me what you need.`);
          setWakeWindowActive(true);
          wakeWindowRef.current = true;
          commandTimer = setTimeout(() => {
            clearCommandWindow();
            speakGlobal("I'm still here whenever you need me.");
          }, COMMAND_WINDOW_MS);
          return;
        }

        // ── 1. Emergency triggers — bypass window, immediate navigation ──
        if (EMERGENCY_TRIGGERS.some((t) => text.includes(t))) {
          clearCommandWindow();
          setScreen("live-flash");
          return;
        }

        // ── 2. Inside the 30-sec command window — process secondary command ──
        if (wakeWindowRef.current) {
          clearCommandWindow();
          if (NOTE_TRIGGERS.some((t) => text.includes(t))) { setScreen("heat-log"); return; }
          if (JOKE_TRIGGERS.some((t) => text.includes(t))) {
            speakGlobal(HUMOR_BANK[Math.floor(Math.random() * HUMOR_BANK.length)]); return;
          }
          if (BREATHE_TRIGGERS.some((t) => text.includes(t))) { setScreen("learn"); return; }
          // Unrecognised command — go to live-flash
          setScreen("live-flash");
          return;
        }

        // ── 3. Wake word detection ──
        const isWakeWord =
          text.includes("hey flashy") || text.includes("hey flash") || text === "flashy";

        if (isWakeWord) {
          // Check for inline command with wake word
          if (NOTE_TRIGGERS.some((t) => text.includes(t)))    { setScreen("heat-log"); return; }
          if (JOKE_TRIGGERS.some((t) => text.includes(t)))    {
            speakGlobal(HUMOR_BANK[Math.floor(Math.random() * HUMOR_BANK.length)]); return;
          }
          if (BREATHE_TRIGGERS.some((t) => text.includes(t))) { setScreen("learn"); return; }

          // Wake word alone → personalized greeting + 30-sec window
          const name = user.displayName?.split(" ")[0] || user.email?.split("@")[0] || "girlfriend";
          speakGlobal(`Hey girlfriend, I'm here. I've got you, ${name}. Tell me what you need.`);

          setWakeWindowActive(true);
          wakeWindowRef.current = true;

          commandTimer = setTimeout(() => {
            // 30 sec expired — privacy sleep mode
            clearCommandWindow();
            try { rec.stop(); } catch {}           // triggers onend which does NOT restart (sleeping)
            setMicSleeping(true);
            micSleepingRef.current = true;
          }, COMMAND_WINDOW_MS);
          return;
        }
      }
    };

    try { rec.start(); } catch {}

    return () => {
      alive.current = false;
      clearCommandWindow();
      try { rec.stop(); } catch {}
      globalRecRef.current = null;
    };
    // Re-run when screen changes (live-flash/summary need the mic paused)
    // or when user toggles the global mic on/off
  }, [user, screen, globalMicEnabled]); // eslint-disable-line

  // Re-register service worker for PWA background tab support
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  // ── Page visibility: restart mic when tab/app comes back to foreground ──
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== "visible") return;
      if (!user || !globalMicEnabled || micSleepingRef.current) return;
      const onTracking = screenRef.current === "live-flash" || screenRef.current === "summary";
      if (onTracking) return;
      // Gently restart if the mic session died in the background
      setTimeout(() => {
        try { globalRecRef.current?.start(); } catch {}
      }, 800);
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [user, globalMicEnabled]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0A0A0A", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#C0392B", fontSize: "22px", fontWeight: 900, letterSpacing: "3px", margin: 0 }}>
          FLASHYAF™
        </p>
      </div>
    );
  }

  if (!user) return <AuthScreen />;

  if (!consentDone) {
    return (
      <ConsentScreen
        onComplete={() => {
          localStorage.setItem(CONSENT_KEY, "1");
          setConsentDone(true);
        }}
      />
    );
  }

  if (!onboardingDone) {
    return (
      <OnboardingScreen
        onComplete={() => {
          localStorage.setItem(ONBOARDING_KEY, "1");
          setOnboardingDone(true);
        }}
      />
    );
  }

  function navigate(s: string) { setScreen(s as Screen); }

  const hideFAB = screen === "live-flash" || screen === "summary";

  if (screen === "live-flash") {
    return (
      <LiveFlashScreen
        onComplete={(flash) => {
          setLastFlash(flash);
          // ── Flash Forecast Alarm™ — signal that a new flash just completed ──
          setFlashJustCompleted((n) => n + 1);
          setScreen("summary");
        }}
      />
    );
  }

  if (screen === "summary" && lastFlash) {
    return (
      <SummaryScreen
        flash={lastFlash}
        onLogAnother={() => setScreen("live-flash")}
        onSeeHistory={() => setScreen("history")}
        onGoHome={() => setScreen("home")}
      />
    );
  }

  if (screen === "history")   return <>{renderFAB()}<HistoryScreen onNavigate={navigate} /></>;
  if (screen === "community") return <>{renderFAB()}<CommunityScreen onNavigate={navigate} /></>;
  if (screen === "learn")     return <>{renderFAB()}<LearnScreen onNavigate={navigate} /></>;
  if (screen === "shop")      return <>{renderFAB()}<ShopScreen onNavigate={navigate} /></>;
  if (screen === "settings")  return <>{renderFAB()}<SettingsScreen onNavigate={navigate} /></>;
  if (screen === "feedback")  return <>{renderFAB()}<FeedbackScreen onNavigate={navigate} /></>;
  if (screen === "heat-log")  return <>{renderFAB()}<HeatLogScreen onNavigate={navigate} /></>;

  if (screen === "pattern-intelligence") return <PatternIntelligenceScreen onBack={() => setScreen("settings")} />;
  if (screen === "admin")     return <AdminDashboardScreen onBack={() => setScreen("home")} />;
  if (screen === "affiliate") return <AffiliateScreen onBack={() => setScreen("settings")} />;
  if (screen === "wearable")  return <WearableScreen onBack={() => setScreen("settings")} />;
  if (screen === "monthly-report") return <MonthlyReportScreen onBack={() => setScreen("history")} />;
  if (screen === "tutorial")  return <TutorialScreen onDone={() => setScreen("settings")} />;
  if (screen === "about")     return <AboutScreen onBack={() => setScreen("settings")} />;

  // Default: home
  return (
    <>
      {renderFAB()}
      <HomeScreen
        onStartTracking={() => setScreen("live-flash")}
        onNavigate={navigate}
        wakeWindowActive={wakeWindowActive}
        micSleeping={micSleeping}
        flashJustCompleted={flashJustCompleted}
      />
    </>
  );

  // ── Floating mic FAB ──────────────────────────────────────────────────────
  function renderFAB() {
    if (hideFAB) return null;
    const isActive = globalMicEnabled && !micSleeping;
    return (
      <button
        onClick={() => setScreen("live-flash")}
        onContextMenu={(e) => { e.preventDefault(); setGlobalMicEnabled((v) => !v); }}
        title="Tap to start tracking · Hold to toggle wake-word mic"
        aria-label="Start Flash Tracking"
        style={{
          position: "fixed", bottom: "90px", right: "18px",
          width: "56px", height: "56px", borderRadius: "50%",
          background: isActive
            ? "linear-gradient(135deg, #C0392B 0%, #FF4500 100%)"
            : micSleeping
              ? "rgba(30,40,60,0.9)"
              : "rgba(60,60,60,0.9)",
          border: isActive
            ? "2px solid rgba(255,69,0,0.7)"
            : micSleeping
              ? "2px solid rgba(100,150,255,0.3)"
              : "2px solid rgba(255,255,255,0.15)",
          color: "#fff", fontSize: "22px", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 9999,
          boxShadow: isActive
            ? "0 0 22px rgba(192,57,43,0.55), 0 4px 16px rgba(0,0,0,0.5)"
            : "0 4px 16px rgba(0,0,0,0.4)",
          transition: "all 0.25s ease",
        }}
      >
        {micSleeping ? "😴" : globalMicEnabled ? "🔴" : "🎤"}
      </button>
    );
  }
}

export default function App() {
  return (
    <AuthProvider>
      <DemoProvider>
        <AppInner />
      </DemoProvider>
    </AuthProvider>
  );
}
