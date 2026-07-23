import { useState, useEffect, useRef, useCallback } from "react";
import { collection, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import type { Stage, StageEntry, Flash } from "@/types/flash";
import BodyAreaSelector from "@/components/BodyAreaSelector";
import { haptic } from "@/lib/haptic";
import { trackEvent, trackInternalEvent } from "@/lib/analytics";
import { saveJournalEntry } from "@/lib/journalStorage";

const ENCOURAGEMENT_LINES = [
  "You have gotten through every single one of these. This is no different.",
  "Your body is doing something hard right now. You are handling it beautifully.",
  "Breathe through it. You are stronger than you know.",
  "This moment will pass. It always does. You are in control.",
  "Every flash you survive makes you more powerful than before.",
  "You have done this before. You will do it again. You have got this.",
  "You are not alone in this. Millions of women are right there with you.",
  "Your resilience is remarkable. Keep going, you are almost through.",
  "This too shall pass. And it will. Very soon.",
  "You are handling this with grace, even when it does not feel that way.",
  "Take a deep breath. You are safe. You are strong. You are enough.",
  "Your body is not betraying you. It is going through a powerful change.",
  "You have survived one hundred percent of your difficult moments so far.",
  "Right now, in this moment, you are doing exactly what you need to do.",
  "The discomfort is temporary. Your strength is permanent.",
];

const COMPLETION_RESPONSES = [
  "You made it through. That is what you do. Every single time.",
  "Flash logged and done. You handled that like the powerhouse you are.",
  "And just like that, you conquered another one. I am proud of you.",
  "Flash complete. Your strength is not up for debate.",
  "That is a wrap. You showed up, you pushed through, you won.",
  "Done and logged. Another flash, another victory for you.",
  "You got through it. You always do. That is who you are.",
  "Flash over. Data saved. You? Absolutely undefeated.",
  "Another one handled with grace. You make this look easy.",
  "Logged and done. Nothing stops you. Not even this.",
  "That flash met its match today. And her name is you.",
  "You did the thing. Again. Because that is what legends do.",
  "Flash complete. Your body went through something hard. You made it.",
  "Done. Logged. Celebrated. You deserve all of it.",
  "And breathe. You are through it. I have got your data. You have got this.",
];

const STAGES: Stage[] = [
  "STARTED",
  "PEAK",
  "COOLING_DOWN",
  "FLASH_ENDED",
  "BACK_TO_NORMAL",
];

// ── CHANGE: "BLAZING" → "I'M MELTING" everywhere in labels ──
const STAGE_LABELS: Record<Stage, string> = {
  STARTED: "FLASH STARTED",
  PEAK: "I'M MELTING",
  COOLING_DOWN: "COOLING DOWN",
  FLASH_ENDED: "FLASH ENDED",
  BACK_TO_NORMAL: "BACK TO NORMAL 😊",
};

const STAGE_COLORS: Record<Stage, string> = {
  STARTED: "#FF0000",
  PEAK: "#FF6B35",
  COOLING_DOWN: "#2E86AB",
  FLASH_ENDED: "#26A69A",
  BACK_TO_NORMAL: "#87CEEB",
};

const STAGE_BG: Record<Stage, string> = {
  STARTED: "#D2691E",
  PEAK: "#8B0000",
  COOLING_DOWN: "#006994",
  FLASH_ENDED: "#1B6B5A",
  BACK_TO_NORMAL: "#0D2137",
};

// ── CHANGE: Added "i'm melting" / "melting" triggers for PEAK, kept blazing too ──
const VOICE_TRIGGERS: Record<string, Stage> = {
  started: "STARTED",
  begin: "STARTED",
  "flash started": "STARTED",
  "flash starting": "STARTED",
  "start flash": "STARTED",
  flashing: "STARTED",
  "i'm having a hot flash": "STARTED",
  "im having a hot flash": "STARTED",
  "having a hot flash": "STARTED",
  "hot flash starting": "STARTED",

  // Primary triggers — "i'm melting"
  melting: "PEAK",
  "i'm melting": "PEAK",
  "im melting": "PEAK",
  "i am melting": "PEAK",
  // Keep blazing as backup
  blazing: "PEAK",
  "it's blazing": "PEAK",
  "its blazing": "PEAK",
  "blazing hot": "PEAK",
  "im blazing": "PEAK",
  "i'm blazing": "PEAK",
  "fully blazing": "PEAK",
  "i'm on fire": "PEAK",
  "im on fire": "PEAK",
  intense: "PEAK",
  "hot flash": "PEAK",
  "i'm flashing": "PEAK",
  "im flashing": "PEAK",
  "flashing hard": "PEAK",

  cooling: "COOLING_DOWN",
  cooler: "COOLING_DOWN",
  better: "COOLING_DOWN",
  "cooling down": "COOLING_DOWN",
  "i'm cooling down": "COOLING_DOWN",
  "im cooling down": "COOLING_DOWN",
  "peak done": "COOLING_DOWN",
  "peak over": "COOLING_DOWN",
  "getting cooler": "COOLING_DOWN",
  "cooling off": "COOLING_DOWN",

  done: "FLASH_ENDED",
  finished: "FLASH_ENDED",
  ended: "FLASH_ENDED",
  "flash end": "FLASH_ENDED",
  "flash ended": "FLASH_ENDED",
  "flash over": "FLASH_ENDED",
  "flash stopped": "FLASH_ENDED",
  "i'm done with that flash": "FLASH_ENDED",
  "im done with that flash": "FLASH_ENDED",
  "done with that flash": "FLASH_ENDED",
  "it stopped": "FLASH_ENDED",

  normal: "BACK_TO_NORMAL",
  "back to normal": "BACK_TO_NORMAL",
  recovered: "BACK_TO_NORMAL",
  "i feel like myself": "BACK_TO_NORMAL",
  "i feel normal": "BACK_TO_NORMAL",
  "feeling normal": "BACK_TO_NORMAL",
  "i made it through": "BACK_TO_NORMAL",
  "made it through": "BACK_TO_NORMAL",
  "log flash": "BACK_TO_NORMAL",
  "all done": "BACK_TO_NORMAL",
  "all better": "BACK_TO_NORMAL",
  "feeling better": "BACK_TO_NORMAL",
};

const NOTE_TRIGGER_PHRASES = new Set([
  "take a note",
  "save a note",
  "make a note",
  "take note",
  "save note",
  "record a note",
  "note this",
  "remember this",
  "save this",
  "write this down",
  "log a note",
]);

// End-of-note triggers
const END_NOTE_PHRASES = new Set([
  "end note",
  "end the note",
  "done with note",
  "done",
  "that's it",
  "thats it",
  "stop note",
  "save it",
]);

const HEY_FLASHY_PHRASES = new Set(["hey flashy", "hey flash", "flashy"]);

// ── CHANGE: Voice confirmations updated — "I'm melting" instead of "Blazing" ──
const VOICE_CONFIRMATIONS: Record<Stage, string> = {
  STARTED: "Got you, flash started.",
  PEAK: "I got you. I'm melting logged.",
  COOLING_DOWN: "Good, cooling down.",
  FLASH_ENDED: "Flash ended.",
  BACK_TO_NORMAL: "Back to normal. Great job!",
};

const WAVE_AUDIO_URL =
  "https://assets.mixkit.co/sfx/preview/mixkit-ocean-waves-loop-1193.mp3";
const NOTIFICATION_DELAY_MS = 45 * 60 * 1000;

const PLOT_X = 30,
  PLOT_Y = 6,
  PLOT_W = 260,
  PLOT_H = 56;
const AXIS_BOTTOM = PLOT_Y + PLOT_H;

const GRAPH_INTENSITY: Record<Stage, number> = {
  STARTED: 78,
  PEAK: 98,
  COOLING_DOWN: 85,
  FLASH_ENDED: 15,
  BACK_TO_NORMAL: 6,
};

function gPt(timeS: number, intensity: number, maxTime: number) {
  return {
    x: PLOT_X + (timeS / maxTime) * PLOT_W,
    y: AXIS_BOTTOM - (intensity / 100) * PLOT_H,
  };
}

function smoothPath(pts: Array<{ x: number; y: number }>) {
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1],
      c = pts[i];
    const dx = (c.x - p.x) * 0.42;
    d += ` C ${(p.x + dx).toFixed(1)} ${p.y.toFixed(1)}, ${(c.x - dx).toFixed(1)} ${c.y.toFixed(1)}, ${c.x.toFixed(1)} ${c.y.toFixed(1)}`;
  }
  return d;
}

function computeLiveIntensity(
  elapsedS: number,
  stagesArr: StageEntry[],
): number {
  const last = stagesArr[stagesArr.length - 1];
  const stageElapsedS = (Date.now() - last.timestamp) / 1000;
  switch (last.stage) {
    case "STARTED":
      return Math.min(78, 5 + Math.min(1, elapsedS / 180) * 73);
    case "PEAK":
      return 98;
    case "COOLING_DOWN":
      return Math.max(12, 80 - Math.min(1, stageElapsedS / 120) * 68);
    case "FLASH_ENDED":
      return 15;
    case "BACK_TO_NORMAL":
      return 6;
  }
}

// ── Animated flame background for PEAK/melting screen ────────────────────────
function FlameBackground() {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: "52%",
        overflow: "hidden",
        zIndex: 0,
        pointerEvents: "none",
      }}
    >
      <svg
        viewBox="0 0 400 300"
        preserveAspectRatio="xMidYMax slice"
        style={{ width: "100%", height: "100%", opacity: 0.55 }}
      >
        <defs>
          <radialGradient id="fg1" cx="50%" cy="100%" r="60%">
            <stop offset="0%" stopColor="#FF4500" stopOpacity="1" />
            <stop offset="100%" stopColor="#8B0000" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="fg2" cx="50%" cy="100%" r="40%">
            <stop offset="0%" stopColor="#FFD700" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#FF4500" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* Flame shapes — animated via CSS keyframes */}
        <g style={{ animation: "flameDance1 2.1s ease-in-out infinite" }}>
          <path
            d="M200,300 C160,240 120,200 140,140 C160,80 200,60 200,60 C200,60 240,80 260,140 C280,200 240,240 200,300Z"
            fill="url(#fg1)"
          />
        </g>
        <g style={{ animation: "flameDance2 1.7s ease-in-out infinite" }}>
          <path
            d="M200,300 C175,255 150,220 165,175 C180,130 200,110 200,110 C200,110 220,130 235,175 C250,220 225,255 200,300Z"
            fill="url(#fg2)"
          />
        </g>
        <g style={{ animation: "flameDance3 2.4s ease-in-out infinite" }}>
          <path
            d="M130,300 C100,250 80,210 100,160 C115,120 140,105 140,105 C140,105 165,120 170,165 C175,210 155,255 130,300Z"
            fill="url(#fg1)"
            opacity="0.6"
          />
        </g>
        <g
          style={{ animation: "flameDance1 1.9s ease-in-out infinite reverse" }}
        >
          <path
            d="M270,300 C240,250 230,210 240,165 C250,120 270,108 270,108 C270,108 295,122 305,162 C315,210 300,255 270,300Z"
            fill="url(#fg1)"
            opacity="0.6"
          />
        </g>
      </svg>
      <style>{`
        @keyframes flameDance1 {
          0%, 100% { transform: scaleX(1) translateY(0); }
          33% { transform: scaleX(1.04) translateY(-6px); }
          66% { transform: scaleX(0.96) translateY(-2px); }
        }
        @keyframes flameDance2 {
          0%, 100% { transform: scaleX(1) translateY(0); }
          50% { transform: scaleX(1.06) translateY(-8px); }
        }
        @keyframes flameDance3 {
          0%, 100% { transform: scaleX(1) translateY(0) rotate(-2deg); }
          40% { transform: scaleX(1.05) translateY(-5px) rotate(2deg); }
          80% { transform: scaleX(0.97) translateY(-3px) rotate(-1deg); }
        }
      `}</style>
    </div>
  );
}

type DrawerType = "breathe" | "encourage" | null;
type MicStatus =
  | "starting"
  | "listening"
  | "triggered"
  | "unsupported"
  | "denied";
type NoteMode = "idle" | "listening" | "saved" | "readback";

interface Props {
  onComplete: (flash: Flash) => void;
}

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

const ACTIVE_FLASH_STATE_KEY = "flashyaf_active_flash_state";

// ── FIX: real session resume — previously only the start time was saved,
// so leaving and returning had no way to restore stage progress and always
// silently started a brand-new flash. Now the whole in-progress state is
// saved and restored, so returning picks up exactly where you left off. ──
interface SavedFlashState {
  startTime: number;
  currentStageIdx: number;
  stages: StageEntry[];
  bodyAreas: string[];
}
function loadSavedFlashState(): SavedFlashState | null {
  try {
    const raw = localStorage.getItem(ACTIVE_FLASH_STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedFlashState;
  } catch {
    return null;
  }
}

export default function LiveFlashScreen({ onComplete }: Props) {
  const { user } = useAuth();
  const savedFlashState = useRef(loadSavedFlashState()).current;
  const startTimeRef = useRef(savedFlashState?.startTime ?? Date.now());

  useEffect(() => {
    trackInternalEvent("flash_started");
  }, []);

  const [elapsed, setElapsed] = useState(0);
  const [timerFrozen, setTimerFrozen] = useState(false);
  const frozenElapsedRef = useRef(0);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [currentStageIdx, setCurrentStageIdx] = useState(
    savedFlashState?.currentStageIdx ?? 0,
  );
  const [stages, setStages] = useState<StageEntry[]>(
    savedFlashState?.stages ?? [
      { stage: "STARTED", timestamp: startTimeRef.current },
    ],
  );
  const currentStageIdxRef = useRef(0);
  const stagesRef = useRef(stages);

  // ── CHANGE: Summary stays up 6 seconds after rating before navigating ──
  const [showSummaryHold, setShowSummaryHold] = useState(false);

  const [showRatingOverlay, setShowRatingOverlay] = useState(false);
  const pendingPeakTargetRef = useRef(1);
  const peakRatingRef = useRef(0);

  const endTimeRef = useRef(0);
  const speechShouldContinueRef = useRef(false);

  const [drawer, setDrawer] = useState<DrawerType>(null);
  const drawerRef = useRef<DrawerType>(null);
  useEffect(() => {
    drawerRef.current = drawer;
  }, [drawer]);
  const blazingAutoTriggerRef = useRef(false);
  const [encourageLine, setEncourageLine] = useState("");
  const [breathePhase, setBreathePhase] = useState<
    "inhale" | "hold" | "exhale"
  >("inhale");

  const waveAudioRef = useRef<HTMLAudioElement | null>(null);
  const [saving, setSaving] = useState(false);
  const [emergencyCooldown, setEmergencyCooldown] = useState(false);

  const NOTES_DRAFT_KEY = "flashyaf_notes_draft";
  const [notes, setNotes] = useState(() => {
    // ── FIX: restore any typed note that didn't make it into a saved flash
    // (e.g. app closed mid-flash before this was fixed) ──
    try {
      return localStorage.getItem(NOTES_DRAFT_KEY) || "";
    } catch {
      return "";
    }
  });
  const notesRef = useRef("");
  const [notesSavedFlash, setNotesSavedFlash] = useState(false);
  const notesSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [bodyAreas, setBodyAreas] = useState<string[]>(
    savedFlashState?.bodyAreas ?? [],
  );
  const bodyAreasRef = useRef<string[]>([]);
  useEffect(() => {
    bodyAreasRef.current = bodyAreas;
  }, [bodyAreas]);

  const [noteMode, setNoteMode] = useState<NoteMode>("idle");
  const noteModeRef = useRef<NoteMode>("idle");
  useEffect(() => {
    noteModeRef.current = noteMode;
  }, [noteMode]);

  const [voiceNotes, setVoiceNotes] = useState<
    { text: string; timestamp: number; stage: Stage }[]
  >([]);
  const voiceNotesRef = useRef<
    { text: string; timestamp: number; stage: Stage }[]
  >([]);
  const isCapturingNoteRef = useRef(false);
  const noteCaptureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [showNoteJournal, setShowNoteJournal] = useState(false);
  // Buffer for accumulating spoken note content
  const noteBufferRef = useRef("");

  const [micStatus, setMicStatus] = useState<MicStatus>("starting");
  const [voiceToast, setVoiceToast] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");
  const voiceToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isWaitingForCommandRef = useRef(false);
  const commandTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPulsing, setIsPulsing] = useState(false);

  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const recognitionRestartRef = useRef<((ms: number) => void) | null>(null);
  const isTTSSpeakingRef = useRef(false);

  const [stealthMode, setStealthMode] = useState(false);

  async function requestWakeLock() {
    if (!("wakeLock" in navigator)) return;
    try {
      const lock = await (navigator as any).wakeLock.request("screen");
      wakeLockRef.current = lock;
      lock.addEventListener("release", () => {
        requestWakeLock();
      });
    } catch {}
  }

  function releaseWakeLock() {
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
  }

  useEffect(() => {
    requestWakeLock();
    const onVis = () => {
      if (document.visibilityState === "visible") requestWakeLock();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      releaseWakeLock();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  useEffect(() => {
    currentStageIdxRef.current = currentStageIdx;
  }, [currentStageIdx]);
  useEffect(() => {
    try {
      const state: SavedFlashState = {
        startTime: startTimeRef.current,
        currentStageIdx,
        stages,
        bodyAreas,
      };
      localStorage.setItem(ACTIVE_FLASH_STATE_KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable */
    }
  }, [currentStageIdx, stages, bodyAreas]);
  useEffect(() => {
    stagesRef.current = stages;
  }, [stages]);
  useEffect(() => {
    notesRef.current = notes;
    // ── FIX: silently keep an up-to-date draft copy so nothing is lost if
    // the app closes before the flash officially ends ──
    try {
      if (notes.trim()) localStorage.setItem(NOTES_DRAFT_KEY, notes);
      else localStorage.removeItem(NOTES_DRAFT_KEY);
    } catch {
      /* storage unavailable */
    }
  }, [notes]);

  function handleSaveNotesTap() {
    try {
      localStorage.setItem(NOTES_DRAFT_KEY, notes);
    } catch {
      /* storage unavailable */
    }
    setNotesSavedFlash(true);
    if (notesSaveTimerRef.current) clearTimeout(notesSaveTimerRef.current);
    notesSaveTimerRef.current = setTimeout(
      () => setNotesSavedFlash(false),
      2000,
    );
  }
  useEffect(() => {
    voiceNotesRef.current = voiceNotes;
  }, [voiceNotes]);

  // ── I'm melting intervention timeline (was blazing) ───────────────────────
  useEffect(() => {
    if (STAGES[currentStageIdx] !== "PEAK") return;
    const peakEntry = stagesRef.current.find((s) => s.stage === "PEAK");
    if (!peakEntry) return;
    const now = Date.now();
    const d60 = Math.max(500, 60_000 - (now - peakEntry.timestamp));
    const d120 = Math.max(500, 120_000 - (now - peakEntry.timestamp));

    const t60 = setTimeout(() => {
      if (localStorage.getItem("flashyaf_auto_breathing") !== "true") return;
      if (drawerRef.current === "breathe") return;
      blazingAutoTriggerRef.current = true;
      setDrawer("breathe");
    }, d60);

    const t120 = setTimeout(() => {
      if (!window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(
        "You are doing amazing, girlfriend. Just hang in there, take deep breaths, it is almost over.",
      );
      u.rate = 0.85;
      u.pitch = 1.15;
      const vs = window.speechSynthesis.getVoices();
      const fv =
        vs.find(
          (v) =>
            [
              "samantha",
              "karen",
              "moira",
              "tessa",
              "victoria",
              "aria",
              "female",
            ].some((n) => v.name.toLowerCase().includes(n)) &&
            v.lang.startsWith("en"),
        ) || vs.find((v) => v.lang.startsWith("en"));
      if (fv) u.voice = fv;
      window.speechSynthesis.speak(u);
    }, d120);

    return () => {
      clearTimeout(t60);
      clearTimeout(t120);
    };
  }, [currentStageIdx]); // eslint-disable-line

  useEffect(() => {
    if (drawer !== "breathe" || !blazingAutoTriggerRef.current) return;
    blazingAutoTriggerRef.current = false;
    const today = new Date();
    const key = `flashyaf_breathe_done_${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    localStorage.setItem(key, "1");
    startWaves(0.6);
    startBreatheSequence();
  }, [drawer]); // eslint-disable-line

  const rafRef = useRef<number>(0);
  const [, setGraphTick] = useState(0);
  useEffect(() => {
    if (timerFrozen) return;
    let running = true;
    function tick() {
      if (!running) return;
      setGraphTick((t) => t + 1);
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [timerFrozen]);

  useEffect(() => {
    localStorage.setItem("activeFlash", startTimeRef.current.toString()); // kept for the HomeScreen banner check
    const t = setTimeout(() => {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Hey! Did your flash end?", {
          body: "Tap here to log Flash Ended.",
          icon: "/favicon.ico",
        });
      }
    }, NOTIFICATION_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  function speak(text: string, onEnd?: () => void) {
    if (!window.speechSynthesis) {
      onEnd?.();
      return;
    }
    window.speechSynthesis.cancel();
    isTTSSpeakingRef.current = true;
    try {
      recognitionRef.current?.stop();
    } catch {}
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.85;
    utter.pitch = 1.15;
    utter.onend = () => {
      isTTSSpeakingRef.current = false;
      recognitionRestartRef.current?.(300);
      onEnd?.();
    };
    function pickVoiceAndSpeak() {
      const voices = window.speechSynthesis.getVoices();
      const femaleVoice =
        voices.find(
          (v) =>
            (v.name.toLowerCase().includes("samantha") ||
              v.name.toLowerCase().includes("karen") ||
              v.name.toLowerCase().includes("moira") ||
              v.name.toLowerCase().includes("tessa") ||
              v.name.toLowerCase().includes("victoria") ||
              v.name.toLowerCase().includes("fiona") ||
              v.name.toLowerCase().includes("zira") ||
              v.name.toLowerCase().includes("aria") ||
              v.name.toLowerCase().includes("female")) &&
            v.lang.startsWith("en"),
        ) || voices.find((v) => v.lang.startsWith("en"));
      if (femaleVoice) utter.voice = femaleVoice;
      window.speechSynthesis.speak(utter);
    }
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) pickVoiceAndSpeak();
    else
      window.speechSynthesis.addEventListener(
        "voiceschanged",
        pickVoiceAndSpeak,
        { once: true },
      );
  }

  // ── CHANGE: saveVoiceNote now also writes to the shared journal localStorage ──
  function saveVoiceNote(text: string) {
    const currentStage = STAGES[currentStageIdxRef.current];
    const newNote = {
      text: text.trim(),
      timestamp: Date.now(),
      stage: currentStage,
    };
    setVoiceNotes((prev) => [...prev, newNote]);
    voiceNotesRef.current = [...voiceNotesRef.current, newNote];
    setNotes(
      (prev) =>
        prev + (prev.trim() ? "\n" : "") + `[Voice note] ${text.trim()}`,
    );

    // ── Save to shared journal so HomeScreen journal shows this note ──
    // FIX: now respects the user's cloud vs. phone-only choice instead of
    // always writing to local device storage.
    if (user?.uid) {
      const now = new Date();
      const journalEntry = {
        id: `vn_${Date.now()}`,
        userId: user.uid,
        date: now.toISOString().split("T")[0],
        time: now.toTimeString().slice(0, 5),
        stage: currentStage,
        notes: text.trim(),
        createdAt: Date.now(),
      };
      saveJournalEntry(journalEntry).catch(() => {
        /* already falls back internally */
      });
    }

    setNoteMode("saved");
    noteModeRef.current = "saved";
    showVoiceToast("📝 Note saved to your journal!");
    // ── CHANGE: Flashy confirms note saved, asks if readback wanted ──
    speak(
      "Got it, your note is saved in the journal. Want me to read it back? Say yes or no.",
      () => {
        setNoteMode("readback");
        noteModeRef.current = "readback";
        noteCaptureTimerRef.current = setTimeout(() => {
          setNoteMode("idle");
          noteModeRef.current = "idle";
        }, 8000);
      },
    );
  }

  const handleCompleteRef = useRef<(completedStages: StageEntry[]) => void>(
    async () => {},
  );

  handleCompleteRef.current = async (completedStages: StageEntry[]) => {
    if (!user) return;
    setSaving(true);
    localStorage.removeItem("activeFlash");
    localStorage.removeItem(ACTIVE_FLASH_STATE_KEY);

    const endTime = endTimeRef.current || Date.now();
    const durationSeconds = Math.floor((endTime - startTimeRef.current) / 1000);
    trackInternalEvent("flash_completed", {
      duration_seconds: durationSeconds,
    });
    try {
      localStorage.removeItem(NOTES_DRAFT_KEY);
    } catch {
      /* storage unavailable */
    }

    const allNotes = [
      notesRef.current.trim(),
      ...voiceNotesRef.current.map(
        (n) => `[${n.stage} - Voice note] ${n.text}`,
      ),
    ]
      .filter(Boolean)
      .join("\n");

    const flash: Flash = {
      userId: user.uid,
      startTime: startTimeRef.current,
      endTime,
      durationSeconds,
      stages: completedStages,
      ...(peakRatingRef.current > 0 && { peakRating: peakRatingRef.current }),
      ...(allNotes && { notes: allNotes }),
      ...(bodyAreasRef.current.length > 0 && {
        bodyAreas: bodyAreasRef.current,
      }),
    };

    try {
      const ref = await addDoc(
        collection(db, "users", user.uid, "flashes"),
        flash,
      );
      flash.id = ref.id;
    } catch {
      try {
        const PENDING_KEY = "flashyaf_pending_flashes";
        const pending = JSON.parse(localStorage.getItem(PENDING_KEY) || "[]");
        pending.push({ flashData: flash, userId: user.uid });
        localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
      } catch {}
    }

    setSaving(false);

    const lastIdx = parseInt(
      localStorage.getItem("flashyaf_last_completion_idx") || "-1",
    );
    let newIdx = Math.floor(Math.random() * COMPLETION_RESPONSES.length);
    if (newIdx === lastIdx) newIdx = (newIdx + 1) % COMPLETION_RESPONSES.length;
    localStorage.setItem("flashyaf_last_completion_idx", newIdx.toString());

    speechShouldContinueRef.current = true;
    let navigated = false;

    // ── CHANGE: Hold summary screen for 6 seconds after speech ends ──
    function doNavigate() {
      if (!navigated) {
        navigated = true;
        setShowSummaryHold(true);
        setTimeout(() => onComplete(flash), 6000);
      }
    }

    speak(COMPLETION_RESPONSES[newIdx], () => setTimeout(doNavigate, 800));
    setTimeout(doNavigate, 16000);
  };

  const jumpToStage = useCallback(
    (targetIdx: number, finalTimestamp?: number) => {
      const currentIdx = currentStageIdxRef.current;
      if (targetIdx <= currentIdx || targetIdx >= STAGES.length) return;
      const now = Date.now();
      const newEntries: StageEntry[] = [];
      for (let i = currentIdx + 1; i <= targetIdx; i++) {
        newEntries.push({
          stage: STAGES[i],
          timestamp: i === targetIdx && finalTimestamp ? finalTimestamp : now,
        });
      }
      const finalStage = STAGES[targetIdx];
      setCurrentStageIdx(targetIdx);
      setStages((prev) => {
        const updated = [...prev, ...newEntries];
        stagesRef.current = updated;
        if (finalStage === "BACK_TO_NORMAL") handleCompleteRef.current(updated);
        return updated;
      });
    },
    [],
  );

  function handleStageBtn(targetIdx: number) {
    if (targetIdx <= currentStageIdxRef.current) return;
    trackInternalEvent("stage_tapped", { stage: STAGES[targetIdx] });
    if (STAGES[targetIdx] === "BACK_TO_NORMAL") {
      const exactEnd = Date.now();
      endTimeRef.current = exactEnd;
      frozenElapsedRef.current = Math.floor(
        (exactEnd - startTimeRef.current) / 1000,
      );
      setTimerFrozen(true);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      pendingPeakTargetRef.current = targetIdx;
      setShowRatingOverlay(true);
      return;
    }
    jumpToStage(targetIdx);
  }

  function handleRatingTap(rating: number) {
    peakRatingRef.current = rating;
    setShowRatingOverlay(false);
    jumpToStage(
      STAGES.indexOf("BACK_TO_NORMAL"),
      endTimeRef.current || Date.now(),
    );
  }
  function handleSkipRating() {
    setShowRatingOverlay(false);
    jumpToStage(
      STAGES.indexOf("BACK_TO_NORMAL"),
      endTimeRef.current || Date.now(),
    );
  }

  useEffect(() => {
    const interval = setInterval(() => {
      if (!timerFrozen)
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    timerIntervalRef.current = interval;
    return () => clearInterval(interval);
  }, [timerFrozen]);

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setIsOnline(true),
      off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    if (!user || !isOnline) return;
    const PENDING_KEY = "flashyaf_pending_flashes";
    const pending: { flashData: Flash; userId: string }[] = JSON.parse(
      localStorage.getItem(PENDING_KEY) || "[]",
    );
    if (!pending.length) return;
    (async () => {
      const remaining: typeof pending = [];
      for (const item of pending) {
        if (item.userId !== user.uid) {
          remaining.push(item);
          continue;
        }
        try {
          await addDoc(
            collection(db, "users", user.uid, "flashes"),
            item.flashData,
          );
        } catch {
          remaining.push(item);
        }
      }
      localStorage.setItem(PENDING_KEY, JSON.stringify(remaining));
    })();
  }, [user, isOnline]);

  const breatheSeqRef = useRef<{ cancel: () => void } | null>(null);

  function startBreatheSequence() {
    breatheSeqRef.current?.cancel();
    const alive = { current: true };
    const timers: ReturnType<typeof setTimeout>[] = [];
    const STEPS: {
      text: string;
      phase: "inhale" | "hold" | "exhale";
      silenceMs: number;
    }[] = [
      {
        text: "Breathe in slowly through your nose",
        phase: "inhale",
        silenceMs: 4000,
      },
      { text: "Hold your breath gently", phase: "hold", silenceMs: 4000 },
      {
        text: "Now exhale slowly through your mouth",
        phase: "exhale",
        silenceMs: 6000,
      },
    ];
    let stepIdx = 0,
      roundsDone = 0;
    function nextStep() {
      if (!alive.current || roundsDone >= 4) return;
      const step = STEPS[stepIdx];
      setBreathePhase(step.phase);
      speak(step.text, () => {
        if (!alive.current) return;
        timers.push(
          setTimeout(() => {
            stepIdx++;
            if (stepIdx >= STEPS.length) {
              stepIdx = 0;
              roundsDone++;
            }
            nextStep();
          }, step.silenceMs),
        );
      });
    }
    nextStep();
    breatheSeqRef.current = {
      cancel: () => {
        alive.current = false;
        timers.forEach(clearTimeout);
        window.speechSynthesis?.cancel();
      },
    };
  }

  function startWaves(vol = 0.6) {
    if (!waveAudioRef.current) {
      waveAudioRef.current = new Audio(WAVE_AUDIO_URL);
      waveAudioRef.current.loop = true;
    }
    waveAudioRef.current.volume = vol;
    waveAudioRef.current.play().catch(() => {});
  }
  function stopWaves() {
    if (waveAudioRef.current) {
      waveAudioRef.current.pause();
      waveAudioRef.current.currentTime = 0;
    }
  }

  function openDrawer(type: DrawerType) {
    if (drawer === type) {
      breatheSeqRef.current?.cancel();
      breatheSeqRef.current = null;
      stopWaves();
      setDrawer(null);
      return;
    }
    trackInternalEvent("support_drawer_opened", {
      drawer_type: type ?? "unknown",
    });
    stopWaves();
    if (type === "breathe") {
      const today = new Date();
      const key = `flashyaf_breathe_done_${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      localStorage.setItem(key, "1");
      startWaves(0.6);
      startBreatheSequence();
    } else if (type === "encourage") {
      const line =
        ENCOURAGEMENT_LINES[
          Math.floor(Math.random() * ENCOURAGEMENT_LINES.length)
        ];
      setEncourageLine(line);
      speak(line);
    }
    setDrawer(type);
  }

  function triggerEmergencyCooldown() {
    const today = new Date();
    const key = `flashyaf_breathe_done_${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    localStorage.setItem(key, "1");
    setEmergencyCooldown(true);
    startWaves(0.6);
    setDrawer("breathe");
    setBreathePhase("inhale");
    speak(
      "I have got you. Let us cool this down together. Follow my breath.",
      () => startBreatheSequence(),
    );
  }

  function exitEmergencyCooldown() {
    setEmergencyCooldown(false);
    breatheSeqRef.current?.cancel();
    breatheSeqRef.current = null;
    stopWaves();
    setDrawer(null);
  }

  function showVoiceToast(msg: string) {
    setVoiceToast(msg);
    setMicStatus("triggered");
    if (voiceToastTimerRef.current) clearTimeout(voiceToastTimerRef.current);
    voiceToastTimerRef.current = setTimeout(() => {
      setVoiceToast("");
      setMicStatus("listening");
    }, 2500);
  }

  function triggerVisualPulse() {
    setIsPulsing(true);
    setTimeout(() => setIsPulsing(false), 8000);
  }

  useEffect(() => {
    const SpeechRecognitionAPI =
      window.webkitSpeechRecognition || window.SpeechRecognition;
    if (!SpeechRecognitionAPI) {
      setMicStatus("unsupported");
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognitionRef.current = recognition;

    const shouldRunRef = { current: true };
    const restartPendingRef = { current: false };

    function restartRecognition(delayMs: number) {
      if (!shouldRunRef.current || restartPendingRef.current) return;
      restartPendingRef.current = true;
      const backoff = Math.min(delayMs, 4000);
      setTimeout(() => {
        restartPendingRef.current = false;
        if (!shouldRunRef.current) return;
        try {
          recognition.start();
        } catch {
          restartRecognition(Math.min(backoff * 2, 4000));
        }
      }, backoff);
    }

    recognitionRestartRef.current = restartRecognition;

    recognition.onstart = () => setMicStatus("listening");
    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setMicStatus("denied");
        setTimeout(() => {
          if (!shouldRunRef.current) return;
          setMicStatus("starting");
          restartRecognition(2000);
        }, 2000);
        return;
      }
      restartRecognition(800);
    };
    recognition.onend = () => {
      if (!isTTSSpeakingRef.current) restartRecognition(300);
    };

    const handleVisForMic = () => {
      if (document.visibilityState === "visible" && shouldRunRef.current) {
        setTimeout(() => {
          if (!shouldRunRef.current) return;
          setMicStatus("starting");
          restartRecognition(500);
        }, 1500);
      }
    };
    document.addEventListener("visibilitychange", handleVisForMic);

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let allText = "";
      for (let i = 0; i < event.results.length; i++)
        allText += event.results[i][0].transcript;
      setLiveTranscript(allText.trim());

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const rawText = event.results[i][0].transcript.toLowerCase().trim();
        const words = rawText.split(/\s+/);
        const currentIdx = currentStageIdxRef.current;
        const isFinal = event.results[i].isFinal;

        // ── Note readback response ──
        if (noteModeRef.current === "readback") {
          if (
            rawText.includes("yes") ||
            rawText.includes("yeah") ||
            rawText.includes("sure") ||
            rawText.includes("please")
          ) {
            if (noteCaptureTimerRef.current)
              clearTimeout(noteCaptureTimerRef.current);
            setNoteMode("idle");
            noteModeRef.current = "idle";
            const lastNote =
              voiceNotesRef.current[voiceNotesRef.current.length - 1];
            if (lastNote) speak(`Here is your note: ${lastNote.text}`);
            continue;
          } else if (
            rawText.includes("no") ||
            rawText.includes("nope") ||
            rawText.includes("skip")
          ) {
            if (noteCaptureTimerRef.current)
              clearTimeout(noteCaptureTimerRef.current);
            setNoteMode("idle");
            noteModeRef.current = "idle";
            speak("Got it. Note is saved in your journal.");
            continue;
          }
        }

        // ── CHANGE: Capture note content — accumulate until "end note" / "done" ──
        if (isCapturingNoteRef.current) {
          // Check for end-of-note phrase
          const isEndNote = Array.from(END_NOTE_PHRASES).some((p) =>
            rawText.includes(p),
          );
          if (isEndNote && noteBufferRef.current.trim()) {
            if (noteCaptureTimerRef.current)
              clearTimeout(noteCaptureTimerRef.current);
            isCapturingNoteRef.current = false;
            const finalText = noteBufferRef.current.trim();
            noteBufferRef.current = "";
            saveVoiceNote(finalText);
            continue;
          }
          // Accumulate interim + final into buffer
          if (isFinal) {
            // Filter out the end-note phrase itself from the buffer
            const cleaned = rawText
              .replace(
                /end note|end the note|done with note|that's it|thats it|stop note|save it/gi,
                "",
              )
              .trim();
            if (cleaned)
              noteBufferRef.current +=
                (noteBufferRef.current ? " " : "") + cleaned;
          }
          continue;
        }

        // ── Wake word ──
        const isWake =
          HEY_FLASHY_PHRASES.has(rawText) ||
          words.some(
            (_w: string, j: number) =>
              j < words.length - 1 &&
              HEY_FLASHY_PHRASES.has(`${words[j]} ${words[j + 1]}`),
          );
        if (isWake) {
          isWaitingForCommandRef.current = true;
          if (commandTimeoutRef.current)
            clearTimeout(commandTimeoutRef.current);
          commandTimeoutRef.current = setTimeout(() => {
            isWaitingForCommandRef.current = false;
            setIsPulsing(false);
          }, 8000);
          // ── CHANGE: Shorter response — just "How can I help?" ──
          speak("How can I help?");
          triggerVisualPulse();
          showVoiceToast("👂 Ready — say your command");
          continue;
        }

        if (!isWaitingForCommandRef.current) continue;

        // ── Note-taking command ──
        let isNoteCommand = false;
        for (const phrase of NOTE_TRIGGER_PHRASES) {
          if (rawText.includes(phrase)) {
            isNoteCommand = true;
            break;
          }
        }
        if (isNoteCommand) {
          isWaitingForCommandRef.current = false;
          setIsPulsing(false);
          if (commandTimeoutRef.current)
            clearTimeout(commandTimeoutRef.current);
          isCapturingNoteRef.current = true;
          noteBufferRef.current = "";
          setNoteMode("listening");
          noteModeRef.current = "listening";
          // ── CHANGE: Flashy says "I'm ready, go ahead with your note" ──
          speak(
            "I am ready, go ahead with your note. Say end note when you are done.",
            () => {
              noteCaptureTimerRef.current = setTimeout(() => {
                if (isCapturingNoteRef.current) {
                  // Auto-save whatever was captured
                  if (noteBufferRef.current.trim()) {
                    isCapturingNoteRef.current = false;
                    const finalText = noteBufferRef.current.trim();
                    noteBufferRef.current = "";
                    saveVoiceNote(finalText);
                  } else {
                    isCapturingNoteRef.current = false;
                    noteBufferRef.current = "";
                    setNoteMode("idle");
                    noteModeRef.current = "idle";
                    speak(
                      "I did not catch anything. You can type your note below.",
                    );
                  }
                }
              }, 20000);
            },
          );
          showVoiceToast("📝 Say your note, then say end note...");
          continue;
        }

        // ── Stage trigger matching ──
        let targetStage: Stage | null = null;
        for (const word of words) {
          if (VOICE_TRIGGERS[word]) {
            targetStage = VOICE_TRIGGERS[word];
            break;
          }
        }
        if (!targetStage) {
          for (let j = 0; j < words.length - 1; j++) {
            const bigram = `${words[j]} ${words[j + 1]}`;
            if (VOICE_TRIGGERS[bigram]) {
              targetStage = VOICE_TRIGGERS[bigram];
              break;
            }
          }
        }
        if (!targetStage) {
          for (let j = 0; j < words.length - 2; j++) {
            const trigram = `${words[j]} ${words[j + 1]} ${words[j + 2]}`;
            if (VOICE_TRIGGERS[trigram]) {
              targetStage = VOICE_TRIGGERS[trigram];
              break;
            }
          }
        }
        if (!targetStage) {
          for (const phrase of Object.keys(VOICE_TRIGGERS)) {
            if (rawText.includes(phrase)) {
              targetStage = VOICE_TRIGGERS[phrase];
              break;
            }
          }
        }
        if (!targetStage) continue;

        const targetIdx = STAGES.indexOf(targetStage);
        if (targetIdx <= currentIdx) continue;

        isWaitingForCommandRef.current = false;
        setIsPulsing(false);
        if (commandTimeoutRef.current) clearTimeout(commandTimeoutRef.current);

        speak(VOICE_CONFIRMATIONS[targetStage]);
        showVoiceToast(
          `"${event.results[i][0].transcript.trim()}" → ${STAGE_LABELS[targetStage]}`,
        );

        if (targetStage === "BACK_TO_NORMAL") {
          const exactEnd = Date.now();
          endTimeRef.current = exactEnd;
          frozenElapsedRef.current = Math.floor(
            (exactEnd - startTimeRef.current) / 1000,
          );
          setTimerFrozen(true);
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
          pendingPeakTargetRef.current = targetIdx;
          setTimeout(() => setShowRatingOverlay(true), 150);
        } else {
          setTimeout(() => jumpToStage(targetIdx), 100);
        }
        break;
      }
    };

    try {
      recognition.start();
    } catch {
      restartRecognition(500);
    }

    return () => {
      shouldRunRef.current = false;
      document.removeEventListener("visibilitychange", handleVisForMic);
      try {
        recognition.stop();
      } catch {}
      if (!speechShouldContinueRef.current) window.speechSynthesis?.cancel();
      stopWaves();
      if (voiceToastTimerRef.current) clearTimeout(voiceToastTimerRef.current);
      if (commandTimeoutRef.current) clearTimeout(commandTimeoutRef.current);
      if (noteCaptureTimerRef.current)
        clearTimeout(noteCaptureTimerRef.current);
      isWaitingForCommandRef.current = false;
      isCapturingNoteRef.current = false;
      noteBufferRef.current = "";
    };
  }, [jumpToStage]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const currentStage = STAGES[currentStageIdx];
  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const displayElapsed = timerFrozen ? frozenElapsedRef.current : elapsed;
  const isPeakStage = currentStage === "PEAK";

  // ── CHANGE: Top half keeps stage color; bottom half is always dark ──
  // Top gradient: stage color → transparent; container itself is dark
  const topGradient = isPeakStage
    ? "linear-gradient(180deg, #8B0000 0%, #5C0000 45%, transparent 100%)"
    : currentStage === "STARTED"
      ? "linear-gradient(180deg, #D2691E 0%, #A0522D 45%, transparent 100%)"
      : currentStage === "COOLING_DOWN"
        ? "linear-gradient(180deg, #006994 0%, #004D6E 45%, transparent 100%)"
        : currentStage === "FLASH_ENDED"
          ? "linear-gradient(180deg, #1B6B5A 0%, #124D41 45%, transparent 100%)"
          : "linear-gradient(180deg, #0D2137 0%, #071525 45%, transparent 100%)";

  const micIcon =
    micStatus === "triggered" ? "🎙️" : micStatus === "listening" ? "🎤" : "🚫";
  const micLabel =
    micStatus === "triggered"
      ? "Heard you!"
      : micStatus === "listening"
        ? "Listening..."
        : micStatus === "denied"
          ? "Restarting mic..."
          : micStatus === "unsupported"
            ? "Voice off"
            : "Starting...";

  const startMs = startTimeRef.current;
  const isFlashComplete = stages[stages.length - 1].stage === "BACK_TO_NORMAL";
  const lastStageRelS =
    stages.length > 1
      ? Math.max(...stages.map((s) => (s.timestamp - startMs) / 1000))
      : displayElapsed;
  const maxTime = Math.max(displayElapsed, lastStageRelS, 30);
  const liveIntensityVal = computeLiveIntensity(displayElapsed, stages);
  const rawPoints: Array<{ x: number; y: number }> = [gPt(0, 0, maxTime)];
  for (const s of stages) {
    if (s.stage === "STARTED") continue;
    rawPoints.push(
      gPt((s.timestamp - startMs) / 1000, GRAPH_INTENSITY[s.stage], maxTime),
    );
  }
  if (!isFlashComplete)
    rawPoints.push(gPt(displayElapsed, liveIntensityVal, maxTime));
  const gPoints = rawPoints
    .sort((a, b) => a.x - b.x)
    .filter((pt, i, arr) => i === 0 || pt.x - arr[i - 1].x > 2);
  const gLinePath = smoothPath(gPoints);
  const gLastPt = gPoints[gPoints.length - 1];
  const gAreaPath =
    gPoints.length >= 2
      ? `${gLinePath} L ${gLastPt.x.toFixed(1)} ${AXIS_BOTTOM} L ${PLOT_X} ${AXIS_BOTTOM} Z`
      : "";
  const lineColor = STAGE_COLORS[currentStage];

  const xTicks: number[] = [0];
  const tickStep = maxTime <= 120 ? 30 : maxTime <= 300 ? 60 : 120;
  for (let t = tickStep; t < maxTime; t += tickStep) xTicks.push(t);
  xTicks.push(maxTime);

  // ── Summary hold screen ────────────────────────────────────────────────────
  if (showSummaryHold) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0A0A0A",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px 24px",
          maxWidth: "480px",
          margin: "0 auto",
        }}
      >
        <div style={{ textAlign: "center", width: "100%" }}>
          <div
            style={{
              width: "64px",
              height: "64px",
              background: "#87CEEB",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "28px",
              color: "#0A0A0A",
              fontWeight: 900,
              margin: "0 auto 20px",
            }}
          >
            ✓
          </div>
          <p
            style={{
              color: "#fff",
              fontSize: "26px",
              fontWeight: 900,
              margin: "0 0 6px",
            }}
          >
            Flash logged!
          </p>
          <p
            style={{
              color: "rgba(255,255,255,0.5)",
              fontSize: "15px",
              margin: "0 0 28px",
            }}
          >
            You made it through. Again.
          </p>
          <div
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "16px",
              padding: "20px",
              marginBottom: "20px",
            }}
          >
            <p
              style={{
                color: "rgba(255,255,255,0.45)",
                fontSize: "11px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "1px",
                margin: "0 0 6px",
              }}
            >
              Duration
            </p>
            <p
              style={{
                color: "#fff",
                fontSize: "36px",
                fontWeight: 900,
                margin: "0 0 10px",
              }}
            >
              {Math.floor(frozenElapsedRef.current / 60)}m{" "}
              {frozenElapsedRef.current % 60}s
            </p>
            {peakRatingRef.current > 0 && (
              <p
                style={{
                  color: "#FF6B35",
                  fontSize: "14px",
                  fontWeight: 700,
                  margin: 0,
                }}
              >
                Peak intensity: {"★".repeat(peakRatingRef.current)}
                {"☆".repeat(5 - peakRatingRef.current)}
              </p>
            )}
          </div>
          <div
            style={{
              background: "rgba(135,206,235,0.1)",
              border: "1px solid rgba(135,206,235,0.3)",
              borderRadius: "12px",
              padding: "12px 18px",
              marginBottom: "16px",
            }}
          >
            <p
              style={{
                color: "#87CEEB",
                fontSize: "13px",
                fontWeight: 600,
                margin: 0,
              }}
            >
              Flash logged and saved ✓ · Returning to home shortly
            </p>
          </div>
          <div
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "14px",
              padding: "14px 18px",
              textAlign: "left",
            }}
          >
            <p
              style={{
                color: "rgba(255,255,255,0.4)",
                fontSize: "10px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "1px",
                margin: "0 0 10px",
              }}
            >
              Stage Breakdown
            </p>
            {stages.map((s, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "6px 0",
                  borderBottom:
                    i < stages.length - 1
                      ? "1px solid rgba(255,255,255,0.05)"
                      : "none",
                }}
              >
                <div
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: STAGE_COLORS[s.stage],
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    color: "#fff",
                    fontSize: "13px",
                    fontWeight: 600,
                    flex: 1,
                  }}
                >
                  {STAGE_LABELS[s.stage]}
                </span>
                <span
                  style={{ color: "rgba(255,255,255,0.35)", fontSize: "11px" }}
                >
                  {new Date(s.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ── FIX: Stealth Mode exit — rendered OUTSIDE the darkened container
          below, so the brightness filter can never dim it out of view. This
          is the real, always-findable way out of Stealth Mode. ── */}
      {stealthMode && (
        <button
          onClick={() => setStealthMode(false)}
          style={{
            position: "fixed",
            top: "16px",
            right: "16px",
            zIndex: 9999,
            background: "#F5A623",
            color: "#000",
            border: "none",
            borderRadius: "100px",
            padding: "10px 18px",
            fontSize: "13px",
            fontWeight: 800,
            letterSpacing: "0.5px",
            cursor: "pointer",
            boxShadow: "0 2px 14px rgba(0,0,0,0.6)",
          }}
        >
          👁 EXIT STEALTH
        </button>
      )}
      <div
        style={
          {
            ...styles.container,
            background: "#0A0A0A",
            filter: stealthMode ? "brightness(0.08) saturate(0.2)" : "none",
            transition: "filter 0.4s ease",
            position: "relative",
          } as React.CSSProperties
        }
      >
        {/* ── CHANGE: Top half colored overlay + flame for PEAK ── */}
        {isPeakStage && <FlameBackground />}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "50%",
            zIndex: 0,
            pointerEvents: "none",
            background: topGradient,
            animation: isPeakStage
              ? "peakPulse 1.2s ease-in-out infinite"
              : "none",
          }}
        />

        {/* All content sits above the overlay */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
            flex: 1,
          }}
        >
          {showRatingOverlay && (
            <div style={styles.ratingOverlay}>
              <div style={styles.ratingCard}>
                <p style={styles.ratingEmoji}>🌡️</p>
                <p style={styles.ratingTitle}>How bad was it?</p>
                <p style={styles.ratingSubtitle}>
                  Now that the peak has passed — how intense was it? 1 to 5
                  stars. Totally optional.
                </p>
                <div style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      style={styles.starBtn}
                      onClick={() => handleRatingTap(star)}
                    >
                      ★<span style={styles.starLabel}>{star}</span>
                    </button>
                  ))}
                </div>
                <p style={styles.ratingHint}>Tap a star or skip</p>
                <button style={styles.skipRatingBtn} onClick={handleSkipRating}>
                  Skip
                </button>
              </div>
            </div>
          )}

          {/* Header */}
          <div style={styles.header}>
            <p style={styles.appName}>FLASHYAF™</p>
            <button
              onClick={() => setStealthMode((v) => !v)}
              title={stealthMode ? "Exit stealth mode" : "Stealth mode"}
              style={{
                background: stealthMode
                  ? "rgba(245,166,35,0.2)"
                  : "rgba(255,255,255,0.08)",
                border: stealthMode
                  ? "1px solid rgba(245,166,35,0.6)"
                  : "1px solid rgba(255,255,255,0.15)",
                borderRadius: "100px",
                color: stealthMode ? "#F5A623" : "rgba(255,255,255,0.55)",
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "0.5px",
                padding: "4px 10px",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              {stealthMode ? "👁 EXIT STEALTH" : "🌑 STEALTH"}
            </button>
            <div style={styles.headerRight}>
              <div
                style={{
                  ...styles.micPill,
                  background: isPulsing
                    ? "rgba(245,166,35,0.35)"
                    : noteMode === "listening"
                      ? "rgba(100,200,100,0.35)"
                      : micStatus === "triggered"
                        ? "rgba(26,188,156,0.3)"
                        : micStatus === "listening"
                          ? "rgba(255,255,255,0.18)"
                          : "rgba(255,80,80,0.25)",
                  border: isPulsing
                    ? "1px solid rgba(245,166,35,0.8)"
                    : noteMode === "listening"
                      ? "1px solid rgba(100,200,100,0.8)"
                      : micStatus === "listening" || micStatus === "triggered"
                        ? "1px solid rgba(255,255,255,0.35)"
                        : "1px solid rgba(255,80,80,0.4)",
                  boxShadow: isPulsing
                    ? "0 0 12px rgba(245,166,35,0.5)"
                    : noteMode === "listening"
                      ? "0 0 12px rgba(100,200,100,0.5)"
                      : "none",
                  transition: "all 0.25s ease",
                }}
              >
                <span
                  style={{
                    ...styles.micDot,
                    background: isPulsing
                      ? "#F5A623"
                      : noteMode === "listening"
                        ? "#64C864"
                        : micStatus === "triggered"
                          ? "#1ABC9C"
                          : micStatus === "listening"
                            ? "#fff"
                            : "#ff6b6b",
                    animation:
                      isPulsing || noteMode === "listening"
                        ? "micPulse 0.8s ease-in-out infinite"
                        : micStatus === "listening"
                          ? "micPulse 1.4s ease-in-out infinite"
                          : "none",
                  }}
                />
                <span style={styles.micLabel}>
                  {noteMode === "listening"
                    ? "Say your note... say end note when done"
                    : noteMode === "readback"
                      ? "Say yes or no"
                      : isPulsing
                        ? "Say command"
                        : micLabel}
                </span>
                <span style={{ fontSize: "13px" }}>
                  {noteMode === "listening" ? "📝" : isPulsing ? "🟡" : micIcon}
                </span>
              </div>
              <p style={styles.liveLabel}>LIVE</p>
            </div>
          </div>

          {!isOnline && (
            <div style={styles.offlineBanner}>
              <span style={styles.offlineDot} />
              <span style={styles.offlineText}>
                Offline — your flash will sync when connection returns
              </span>
            </div>
          )}

          {voiceToast && <div style={styles.voiceToast}>{voiceToast}</div>}

          {micStatus !== "unsupported" && micStatus !== "denied" && (
            <div style={styles.debugBar}>
              <span style={styles.debugBarLabel}>MIC</span>
              <span style={styles.debugBarWords}>
                {liveTranscript
                  ? liveTranscript.trim().split(/\s+/).slice(-5).join(" ")
                  : micStatus === "listening"
                    ? "listening…"
                    : "starting…"}
              </span>
            </div>
          )}

          {micStatus === "denied" && (
            <div style={styles.micDeniedBanner}>
              <span>
                🎤 Mic restarting — tap the screen if it does not recover
              </span>
            </div>
          )}

          {/* Timer */}
          <div style={styles.timerArea}>
            <p style={styles.timerLabel}>Flash Duration</p>
            <p style={styles.timer}>{formatTime(displayElapsed)}</p>
            {peakRatingRef.current > 0 && currentStageIdx >= 1 && (
              <div style={styles.peakRatingBadge}>
                {"★".repeat(peakRatingRef.current)}
                {"☆".repeat(5 - peakRatingRef.current)} intensity
              </div>
            )}
            <div
              style={{
                ...styles.stageBadge,
                background: STAGE_COLORS[currentStage],
              }}
            >
              {STAGE_LABELS[currentStage]}
            </div>
          </div>

          {/* Graph */}
          <div style={styles.graphPanel}>
            <svg
              viewBox="0 0 300 88"
              style={{ width: "100%", overflow: "visible" }}
              aria-label="Flash intensity over time"
            >
              <defs>
                <linearGradient id="flashAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={lineColor} stopOpacity={0.7} />
                  <stop offset="100%" stopColor={lineColor} stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <text
                x={10}
                y={PLOT_Y + PLOT_H / 2}
                textAnchor="middle"
                fontSize={7}
                fill="rgba(255,255,255,0.4)"
                transform={`rotate(-90, 10, ${PLOT_Y + PLOT_H / 2})`}
              >
                Intensity
              </text>
              {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                const y = AXIS_BOTTOM - t * PLOT_H;
                return (
                  <g key={t}>
                    <line
                      x1={PLOT_X - 3}
                      y1={y}
                      x2={PLOT_X + PLOT_W}
                      y2={y}
                      stroke="rgba(255,255,255,0.07)"
                      strokeWidth={1}
                    />
                    <text
                      x={PLOT_X - 5}
                      y={y + 2.5}
                      textAnchor="end"
                      fontSize={6.5}
                      fill="rgba(255,255,255,0.3)"
                    >
                      {Math.round(t * 100)}
                    </text>
                  </g>
                );
              })}
              {xTicks.map((t) => {
                const x = gPt(t, 0, maxTime).x;
                return (
                  <g key={t}>
                    <line
                      x1={x}
                      y1={AXIS_BOTTOM}
                      x2={x}
                      y2={AXIS_BOTTOM + 3}
                      stroke="rgba(255,255,255,0.3)"
                      strokeWidth={1}
                    />
                    <text
                      x={x}
                      y={AXIS_BOTTOM + 10}
                      textAnchor="middle"
                      fontSize={6.5}
                      fill="rgba(255,255,255,0.35)"
                    >
                      {t}s
                    </text>
                  </g>
                );
              })}
              <text
                x={PLOT_X + PLOT_W / 2}
                y={88}
                textAnchor="middle"
                fontSize={7}
                fill="rgba(255,255,255,0.35)"
              >
                Time (seconds)
              </text>
              {gAreaPath && <path d={gAreaPath} fill="url(#flashAreaGrad)" />}
              {gLinePath && (
                <path
                  d={gLinePath}
                  fill="none"
                  stroke={lineColor}
                  strokeWidth={3.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {stages.map((s, i) => {
                if (i === 0) return null;
                const pt = gPt(
                  (s.timestamp - startMs) / 1000,
                  GRAPH_INTENSITY[s.stage],
                  maxTime,
                );
                return (
                  <circle
                    key={i}
                    cx={pt.x}
                    cy={pt.y}
                    r={5}
                    fill={STAGE_COLORS[s.stage]}
                    stroke="#fff"
                    strokeWidth={1.5}
                  />
                );
              })}
              {gLinePath && (
                <>
                  <circle
                    cx={gLastPt.x}
                    cy={gLastPt.y}
                    r={5}
                    fill={lineColor}
                    opacity={0.25}
                  />
                  <circle
                    cx={gLastPt.x}
                    cy={gLastPt.y}
                    r={3}
                    fill={lineColor}
                  />
                </>
              )}
            </svg>
          </div>

          {/* Stage buttons */}
          <div style={styles.stageButtons}>
            {STAGES.map((stage, i) => {
              const isActive = i === currentStageIdx;
              const isPast = i < currentStageIdx;
              return (
                <button
                  key={stage}
                  style={{
                    ...styles.stageBtn,
                    background: isActive
                      ? STAGE_COLORS[stage]
                      : isPast
                        ? "rgba(255,255,255,0.05)"
                        : "rgba(255,255,255,0.08)",
                    color: isActive
                      ? "#fff"
                      : isPast
                        ? "rgba(255,255,255,0.4)"
                        : "rgba(255,255,255,0.85)",
                    border: isActive
                      ? "none"
                      : i > currentStageIdx
                        ? `1px solid ${STAGE_COLORS[stage]}88`
                        : "1px solid rgba(255,255,255,0.1)",
                    fontWeight: isActive ? 800 : 600,
                    boxShadow: isActive ? "0 4px 20px rgba(0,0,0,0.3)" : "none",
                  }}
                  onClick={() => {
                    haptic(i === STAGES.length - 1 ? 200 : 100);
                    handleStageBtn(i);
                  }}
                  disabled={saving}
                >
                  {isPast && (
                    <span style={{ marginRight: "5px", opacity: 0.6 }}>✓</span>
                  )}
                  {STAGE_LABELS[stage]}
                  {isActive && saving && (
                    <span
                      style={{
                        marginLeft: "8px",
                        opacity: 0.7,
                        fontSize: "12px",
                      }}
                    >
                      Saving...
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <BodyAreaSelector selected={bodyAreas} onChange={setBodyAreas} />

          {/* Notes + Voice Journal */}
          <div style={styles.notesArea}>
            <div style={styles.notesHeader}>
              <span style={styles.notesHeaderLabel}>📝 Flash Notes</span>
              <button
                style={styles.notesJournalBtn}
                onClick={() => setShowNoteJournal(!showNoteJournal)}
              >
                {voiceNotes.length > 0
                  ? `🎙️ ${voiceNotes.length} voice note${voiceNotes.length > 1 ? "s" : ""}`
                  : "Voice Journal"}
              </button>
            </div>
            <textarea
              style={styles.notesInput}
              placeholder='Type a note, or say "Hey Flashy, take a note"'
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              rows={2}
            />
            {notes.length > 0 && (
              <span style={styles.notesCount}>{notes.length}/500</span>
            )}
            {notes.trim().length > 0 && (
              <button
                onClick={handleSaveNotesTap}
                style={{
                  marginTop: "6px",
                  background: notesSavedFlash
                    ? "rgba(46,204,113,0.25)"
                    : "rgba(255,255,255,0.1)",
                  border: notesSavedFlash
                    ? "1px solid rgba(46,204,113,0.7)"
                    : "1px solid rgba(255,255,255,0.2)",
                  borderRadius: "100px",
                  color: notesSavedFlash ? "#2ECC71" : "rgba(255,255,255,0.75)",
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: "6px 14px",
                  cursor: "pointer",
                }}
              >
                {notesSavedFlash ? "✓ Saved" : "💾 Save Note"}
              </button>
            )}
            {showNoteJournal && (
              <div style={styles.journalPanel}>
                <p style={styles.journalTitle}>🎙️ Voice Note Journal</p>
                {voiceNotes.length === 0 ? (
                  <p style={styles.journalEmpty}>
                    No voice notes yet. Say "Hey Flashy, take a note" to add
                    one.
                  </p>
                ) : (
                  voiceNotes.map((n, i) => (
                    <div key={i} style={styles.journalNote}>
                      <div style={styles.journalNoteMeta}>
                        <span style={styles.journalNoteStage}>{n.stage}</span>
                        <span style={styles.journalNoteTime}>
                          {new Date(n.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p style={styles.journalNoteText}>{n.text}</p>
                      <button
                        style={styles.journalReadBtn}
                        onClick={() => speak(n.text)}
                      >
                        ▶ Read back
                      </button>
                    </div>
                  ))
                )}
                <p style={styles.journalSaveNote}>
                  Notes save with your flash log and appear in your Home
                  journal.
                </p>
              </div>
            )}
          </div>

          {/* Emergency Cooldown overlay */}
          {emergencyCooldown && (
            <div style={styles.emergencyOverlay}>
              <div style={styles.emergencyContent}>
                <div style={styles.emergencySnowflake}>❄️</div>
                <p style={styles.emergencyTitle}>EMERGENCY COOL DOWN</p>
                <p style={styles.emergencySubtitle}>
                  Ocean waves playing. Follow my breath.
                </p>
                <p style={styles.emergencyBreatheLabel}>
                  {breathePhase === "inhale" && "Breathe in slowly..."}
                  {breathePhase === "hold" && "Hold gently..."}
                  {breathePhase === "exhale" && "Exhale slowly..."}
                </p>
                <div
                  style={{
                    ...styles.emergencyBreatheCircle,
                    transform:
                      breathePhase === "inhale"
                        ? "scale(1.4)"
                        : breathePhase === "exhale"
                          ? "scale(0.7)"
                          : "scale(1.15)",
                  }}
                />
                <p style={styles.emergencyWaveNote}>
                  🌊 Ocean waves playing · 4 rounds
                </p>
                <button
                  style={styles.emergencyExitBtn}
                  onClick={() => {
                    haptic(50);
                    exitEmergencyCooldown();
                  }}
                >
                  I'm feeling better
                </button>
              </div>
            </div>
          )}

          {/* Support drawer */}
          <div style={styles.supportArea}>
            <p style={styles.supportTitle}>Need support?</p>
            <div style={styles.supportBtns}>
              <button
                style={styles.supportBtn}
                onClick={() => openDrawer("breathe")}
              >
                🫁 Breathe With Me
              </button>
              <button
                style={styles.supportBtn}
                onClick={() => openDrawer("encourage")}
              >
                💪 Encourage Me
              </button>
            </div>
            <button
              style={styles.emergencyBtn}
              onClick={triggerEmergencyCooldown}
            >
              ❄️ EMERGENCY COOL DOWN
            </button>
            {drawer && (
              <div style={styles.drawerContent}>
                {drawer === "breathe" && (
                  <div style={styles.breatheBox}>
                    <p style={styles.breatheLabel}>
                      {breathePhase === "inhale" && "Breathe in slowly..."}
                      {breathePhase === "hold" && "Hold gently..."}
                      {breathePhase === "exhale" && "Exhale slowly..."}
                    </p>
                    <div
                      style={{
                        ...styles.breatheCircle,
                        transform:
                          breathePhase === "inhale"
                            ? "scale(1.3)"
                            : breathePhase === "exhale"
                              ? "scale(0.8)"
                              : "scale(1.15)",
                      }}
                    />
                    <p style={styles.waveNote}>🌊 Ocean waves playing</p>
                  </div>
                )}
                {drawer === "encourage" && (
                  <p style={styles.randomLine}>&ldquo;{encourageLine}&rdquo;</p>
                )}
              </div>
            )}
          </div>
        </div>
        {/* end zIndex:1 wrapper */}
      </div>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    maxWidth: "480px",
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    fontFamily: "'Inter', sans-serif",
    position: "relative",
    overflow: "hidden",
  },
  ratingOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.85)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
    padding: "24px",
  },
  ratingCard: {
    background: "#1A1A1A",
    borderRadius: "28px",
    padding: "36px 28px",
    width: "100%",
    maxWidth: "380px",
    textAlign: "center",
    border: "1px solid rgba(255,107,53,0.4)",
    boxShadow: "0 20px 60px rgba(255,107,53,0.3)",
  },
  ratingEmoji: { fontSize: "48px", margin: "0 0 12px" },
  ratingTitle: {
    color: "#FF6B35",
    fontSize: "22px",
    fontWeight: 900,
    margin: "0 0 6px",
    letterSpacing: "1px",
    textTransform: "uppercase",
  },
  ratingSubtitle: {
    color: "rgba(255,255,255,0.65)",
    fontSize: "15px",
    margin: "0 0 28px",
  },
  starsRow: {
    display: "flex",
    gap: "8px",
    justifyContent: "center",
    marginBottom: "20px",
  },
  starBtn: {
    background: "rgba(255,107,53,0.15)",
    border: "2px solid rgba(255,107,53,0.5)",
    borderRadius: "14px",
    color: "#FF6B35",
    fontSize: "30px",
    fontWeight: 900,
    width: "54px",
    height: "64px",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "2px",
    flexShrink: 0,
  },
  starLabel: {
    fontSize: "11px",
    fontWeight: 700,
    color: "rgba(255,107,53,0.8)",
  },
  ratingHint: {
    color: "rgba(255,255,255,0.35)",
    fontSize: "12px",
    margin: "0 0 14px",
  },
  skipRatingBtn: {
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: "100px",
    color: "rgba(255,255,255,0.5)",
    fontSize: "14px",
    fontWeight: 600,
    padding: "10px 28px",
    cursor: "pointer",
    width: "100%",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "18px 18px 0",
    gap: "8px",
  },
  appName: {
    color: "var(--color-accent, #FF4500)",
    fontWeight: 900,
    fontSize: "15px",
    letterSpacing: "2px",
    margin: 0,
    flexShrink: 0,
  },
  headerRight: { display: "flex", alignItems: "center", gap: "8px" },
  micPill: {
    display: "flex",
    alignItems: "center",
    gap: "5px",
    borderRadius: "100px",
    padding: "4px 9px 4px 7px",
    transition: "all 0.4s ease",
  },
  micDot: { width: "6px", height: "6px", borderRadius: "50%", flexShrink: 0 },
  micLabel: {
    color: "#fff",
    fontSize: "10px",
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  liveLabel: {
    background: "rgba(255,255,255,0.25)",
    color: "#fff",
    borderRadius: "20px",
    padding: "3px 9px",
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "2px",
    margin: 0,
    flexShrink: 0,
  },
  offlineBanner: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    margin: "6px 14px 0",
    background: "rgba(231,76,60,0.18)",
    border: "1px solid rgba(231,76,60,0.45)",
    borderRadius: "10px",
    padding: "7px 12px",
  },
  offlineDot: {
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    background: "#E74C3C",
    flexShrink: 0,
    animation: "micPulse 1.4s ease-in-out infinite",
  },
  offlineText: { color: "#fff", fontSize: "11px", fontWeight: 600, flex: 1 },
  micDeniedBanner: {
    margin: "4px 14px 0",
    background: "rgba(255,100,100,0.2)",
    border: "1px solid rgba(255,100,100,0.4)",
    borderRadius: "10px",
    padding: "7px 12px",
    color: "#fff",
    fontSize: "11px",
    fontWeight: 600,
    textAlign: "center",
  },
  voiceToast: {
    margin: "6px 14px 0",
    background: "rgba(26,188,156,0.25)",
    border: "1px solid rgba(26,188,156,0.5)",
    borderRadius: "10px",
    padding: "7px 12px",
    color: "#fff",
    fontSize: "11px",
    fontWeight: 600,
    textAlign: "center",
  },
  debugBar: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    margin: "4px 14px 0",
    background: "rgba(0,0,0,0.3)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "8px",
    padding: "3px 10px",
  },
  debugBarLabel: {
    color: "rgba(255,255,255,0.4)",
    fontSize: "9px",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "1px",
    flexShrink: 0,
  },
  debugBarWords: {
    color: "#fff",
    fontSize: "10px",
    fontWeight: 600,
    fontStyle: "italic",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    flex: 1,
  },
  timerArea: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    padding: "10px 18px 4px",
  },
  timerLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "1px",
    textTransform: "uppercase",
    margin: 0,
  },
  timer: {
    color: "#fff",
    fontSize: "58px",
    fontWeight: 900,
    margin: 0,
    letterSpacing: "-2px",
    textShadow: "0 4px 20px rgba(0,0,0,0.2)",
  },
  peakRatingBadge: {
    color: "#FF6B35",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "1px",
  },
  stageBadge: {
    borderRadius: "100px",
    padding: "7px 20px",
    fontSize: "11px",
    fontWeight: 800,
    letterSpacing: "1px",
    textTransform: "uppercase",
    color: "#fff",
  },
  graphPanel: { padding: "4px 14px 0" },
  stageButtons: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    padding: "8px 14px 8px",
  },
  stageBtn: {
    border: "none",
    borderRadius: "12px",
    fontSize: "13px",
    padding: "12px 16px",
    cursor: "pointer",
    letterSpacing: "0.5px",
    textTransform: "uppercase",
    textAlign: "left",
    transition: "all 0.2s ease",
    display: "flex",
    alignItems: "center",
  },
  notesArea: { position: "relative", padding: "0 14px 8px" },
  notesHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "6px",
  },
  notesHeaderLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: "11px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "1px",
  },
  notesJournalBtn: {
    background: "rgba(255,255,255,0.1)",
    border: "1px solid rgba(255,255,255,0.2)",
    borderRadius: "100px",
    color: "rgba(255,255,255,0.7)",
    fontSize: "10px",
    fontWeight: 600,
    padding: "4px 10px",
    cursor: "pointer",
  },
  notesInput: {
    width: "100%",
    boxSizing: "border-box",
    background: "rgba(0,0,0,0.35)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: "14px",
    color: "#fff",
    fontSize: "13px",
    fontWeight: 500,
    fontFamily: "'Inter', sans-serif",
    padding: "12px 14px",
    resize: "none",
    outline: "none",
    lineHeight: 1.5,
  },
  notesCount: {
    position: "absolute",
    bottom: "18px",
    right: "24px",
    color: "rgba(255,255,255,0.25)",
    fontSize: "10px",
    fontWeight: 600,
    pointerEvents: "none",
  },
  journalPanel: {
    marginTop: "10px",
    background: "rgba(0,0,0,0.4)",
    borderRadius: "14px",
    border: "1px solid rgba(255,255,255,0.1)",
    padding: "12px",
  },
  journalTitle: {
    color: "rgba(255,255,255,0.7)",
    fontSize: "12px",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "1px",
    margin: "0 0 10px",
  },
  journalEmpty: {
    color: "rgba(255,255,255,0.4)",
    fontSize: "11px",
    fontStyle: "italic",
    textAlign: "center",
    margin: "8px 0",
  },
  journalNote: {
    background: "rgba(255,255,255,0.06)",
    borderRadius: "10px",
    padding: "10px",
    marginBottom: "8px",
  },
  journalNoteMeta: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "4px",
  },
  journalNoteStage: {
    color: "#FF6B35",
    fontSize: "9px",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "1px",
  },
  journalNoteTime: { color: "rgba(255,255,255,0.35)", fontSize: "9px" },
  journalNoteText: {
    color: "#fff",
    fontSize: "12px",
    margin: "0 0 8px",
    lineHeight: 1.5,
  },
  journalReadBtn: {
    background: "rgba(255,255,255,0.1)",
    border: "1px solid rgba(255,255,255,0.2)",
    borderRadius: "100px",
    color: "rgba(255,255,255,0.7)",
    fontSize: "10px",
    padding: "4px 12px",
    cursor: "pointer",
  },
  journalSaveNote: {
    color: "rgba(255,255,255,0.3)",
    fontSize: "9px",
    fontStyle: "italic",
    textAlign: "center",
    margin: "8px 0 0",
  },
  supportArea: {
    background: "rgba(0,0,0,0.5)",
    backdropFilter: "blur(10px)",
    borderRadius: "24px 24px 0 0",
    padding: "14px",
    marginTop: "auto",
  },
  supportTitle: {
    color: "rgba(255,255,255,0.5)",
    fontSize: "10px",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "1px",
    margin: "0 0 8px",
    textAlign: "center",
  },
  supportBtns: {
    display: "flex",
    gap: "8px",
    justifyContent: "center",
    flexWrap: "wrap",
  },
  supportBtn: {
    background: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.2)",
    borderRadius: "100px",
    color: "#fff",
    fontSize: "12px",
    fontWeight: 600,
    padding: "9px 16px",
    cursor: "pointer",
  },
  drawerContent: {
    marginTop: "10px",
    padding: "12px",
    background: "rgba(0,0,0,0.3)",
    borderRadius: "12px",
  },
  breatheBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "10px",
  },
  breatheLabel: {
    color: "#fff",
    fontSize: "17px",
    fontWeight: 700,
    margin: 0,
    textAlign: "center",
  },
  breatheCircle: {
    width: "60px",
    height: "60px",
    borderRadius: "50%",
    background: "rgba(255,255,255,0.2)",
    border: "3px solid rgba(255,255,255,0.5)",
    transition: "transform 1s ease-in-out",
  },
  waveNote: {
    color: "rgba(255,255,255,0.4)",
    fontSize: "11px",
    margin: 0,
    fontStyle: "italic",
  },
  randomLine: {
    color: "#fff",
    fontSize: "14px",
    fontWeight: 600,
    fontStyle: "italic",
    textAlign: "center",
    lineHeight: 1.5,
    margin: 0,
  },
  emergencyBtn: {
    marginTop: "10px",
    width: "100%",
    boxSizing: "border-box",
    background: "linear-gradient(135deg, #87CEEB 0%, #4A90D9 100%)",
    border: "2px solid rgba(135,206,235,0.9)",
    borderRadius: "100px",
    color: "#0A2540",
    fontSize: "15px",
    fontWeight: 900,
    padding: "15px 24px",
    cursor: "pointer",
    letterSpacing: "1.5px",
    textTransform: "uppercase",
    boxShadow: "0 0 24px rgba(135,206,235,0.5), 0 4px 20px rgba(0,0,0,0.3)",
  },
  emergencyOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 300,
    background: "rgba(135,206,235,0.94)",
    backdropFilter: "blur(8px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  emergencyContent: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "16px",
    padding: "48px 32px",
    textAlign: "center",
    maxWidth: "380px",
    width: "100%",
  },
  emergencySnowflake: {
    fontSize: "80px",
    lineHeight: 1,
    filter: "drop-shadow(0 0 16px rgba(255,255,255,0.9))",
  },
  emergencyTitle: {
    color: "#0A2540",
    fontSize: "20px",
    fontWeight: 900,
    letterSpacing: "2.5px",
    textTransform: "uppercase",
    margin: 0,
  },
  emergencySubtitle: {
    color: "rgba(10,37,64,0.65)",
    fontSize: "14px",
    margin: 0,
    lineHeight: 1.5,
  },
  emergencyBreatheLabel: {
    color: "#0A2540",
    fontSize: "24px",
    fontWeight: 800,
    margin: 0,
    minHeight: "32px",
  },
  emergencyBreatheCircle: {
    width: "100px",
    height: "100px",
    borderRadius: "50%",
    background: "rgba(255,255,255,0.55)",
    border: "4px solid rgba(10,37,64,0.35)",
    transition: "transform 1s ease-in-out",
    boxShadow: "0 0 30px rgba(255,255,255,0.6)",
  },
  emergencyWaveNote: {
    color: "rgba(10,37,64,0.5)",
    fontSize: "13px",
    fontStyle: "italic",
    margin: 0,
  },
  emergencyExitBtn: {
    marginTop: "8px",
    background: "rgba(10,37,64,0.85)",
    border: "none",
    borderRadius: "100px",
    color: "#fff",
    fontSize: "17px",
    fontWeight: 700,
    padding: "18px 44px",
    cursor: "pointer",
    boxShadow: "0 4px 20px rgba(10,37,64,0.3)",
  },
};
