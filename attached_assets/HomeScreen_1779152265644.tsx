import { useEffect, useRef, useState } from "react";
import { collection, query, orderBy, limit, getDocs, getDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useDemo } from "@/context/DemoContext";
import { DEMO_USER_NAME } from "@/lib/demoData";
import DailyCheckInModal from "@/pages/DailyCheckInModal";
import FlashForecastCard from "@/components/FlashForecastCard";
import FlashForecastAlarm from "@/components/FlashForecastAlarm";
import BodyBatteryGauge from "@/components/BodyBatteryGauge";
import FlashyafScoreCard from "@/components/FlashyafScoreCard";
import CarePackageModal from "@/components/CarePackageModal";
import type { Flash } from "@/types/flash";
import TimeCapsuleModal from "@/components/TimeCapsuleModal";

const ADMIN_EMAIL = "iva@brownworks4u2.com";
const HOME_TRIGGERS = ["flashy", "hey flash", "flash me", "start", "started", "begin"];

const TIPS: { category: string; tip: string }[] = [
  { category: "Hydration", tip: "Keep a chilled water bottle within arm's reach. Sipping cold water at the first sign of a flash can cut its intensity — your body is listening." },
  { category: "Hydration", tip: "Try cucumber-infused water. It's cooling, hydrating, and honestly feels a little luxurious. You deserve luxurious." },
  { category: "Hydration", tip: "Aim for at least 8 glasses of water today. Every cell in your body is doing overtime right now — hydration is your most powerful free tool." },
  { category: "Cooling", tip: "Keep a small personal fan on your nightstand and desk. Immediate airflow is the fastest flash de-escalator you have." },
  { category: "Cooling", tip: "Layer your clothing. Loose, breathable layers you can peel off quickly are your secret weapon. Natural fabrics like cotton and linen are your friends." },
  { category: "Cooling", tip: "Cold water on your wrists and the back of your neck cools your whole body fast — pulse points are your shortcut to relief." },
  { category: "Breathing", tip: "Try paced breathing: inhale for 4 counts, hold for 4, exhale for 6. Studies show slow breathing can reduce flash frequency by up to 50%." },
  { category: "Breathing", tip: "When a flash hits, slow everything down. Your breath is the one thing you can always control — and it controls your body temperature more than you think." },
  { category: "Breathing", tip: "Box breathing (4-4-4-4) activates your parasympathetic nervous system. It tells your brain to stop panicking. Practice it before you need it." },
  { category: "Sleep", tip: "Keep your bedroom between 60–67°F. A cooler sleep environment is one of the most evidence-backed ways to reduce night sweats." },
  { category: "Sleep", tip: "Consider a cooling mattress topper or moisture-wicking sheets. Your bedding shouldn't fight you — it should be on your side." },
  { category: "Sleep", tip: "Avoid alcohol within 3 hours of bedtime. It fragments your sleep and can trigger night sweats even hours after your last sip." },
  { category: "Nutrition", tip: "Spicy foods, caffeine, and alcohol are the most common flash triggers. Try cutting one for a week and see if things calm down. Data > guesswork." },
  { category: "Nutrition", tip: "Soy contains phytoestrogens that may help reduce flash frequency for some women. Edamame, tofu, and soy milk are easy additions." },
  { category: "Nutrition", tip: "Flaxseeds are a natural source of lignans — plant compounds with mild estrogen-like effects. Add a tablespoon to your morning smoothie." },
  { category: "Exercise", tip: "Regular cardio exercise can reduce hot flash frequency by up to 55%. Even a 20-minute brisk walk counts. Every step is working for you." },
  { category: "Exercise", tip: "Yoga has strong evidence for reducing menopause symptoms — not just flexibility. The breathing, the movement, the stillness. It all helps." },
  { category: "Exercise", tip: "Strength training preserves bone density, boosts mood, and helps regulate body temperature. Lifting things is literally medicine right now." },
  { category: "Stress", tip: "Stress is one of the most overlooked flash triggers. Even 5 minutes of mindfulness per day can lower your cortisol levels meaningfully." },
  { category: "Stress", tip: "Identify your personal flash triggers with your tracking data. Patterns will emerge — and patterns give you control back." },
  { category: "Stress", tip: "Talk to someone you trust about what you're going through. Isolation amplifies every symptom. Connection is biological medicine." },
];

const todayTip = TIPS[Math.floor(Date.now() / 86400000) % TIPS.length];

const FEATURED_MERCH = [
  { emoji: "🧊", name: "Cooling Towels", tagline: "Stay cool on the go", color: "#0BC5EA", bg: "rgba(11,197,234,0.1)", border: "rgba(11,197,234,0.25)" },
  { emoji: "🔥", name: "FLASHYAF™ Tees", tagline: "Wear your power", color: "#FF6B35", bg: "rgba(255,107,53,0.1)", border: "rgba(255,107,53,0.25)" },
  { emoji: "💧", name: "Insulated Water Bottles", tagline: "Hydration is everything", color: "#2980B9", bg: "rgba(41,128,185,0.1)", border: "rgba(41,128,185,0.25)" },
  { emoji: "❄️", name: "Cooling Neck Wraps", tagline: "Instant relief anywhere", color: "#16A085", bg: "rgba(22,160,133,0.1)", border: "rgba(22,160,133,0.25)" },
  { emoji: "📓", name: "Journal & Planner", tagline: "Track everything analog too", color: "#8E44AD", bg: "rgba(142,68,173,0.1)", border: "rgba(142,68,173,0.25)" },
  { emoji: "🎁", name: "Gift Sets", tagline: "For the woman who needs this", color: "#B8860B", bg: "rgba(184,134,11,0.1)", border: "rgba(184,134,11,0.25)" },
];

const HOME_OPENS_KEY = "flashyaf_home_opens";
const TODAY_INDEX = Math.floor(Date.now() / 86400000);
const STREAK_KEY = "flashyaf_streak_dates";
const RATING_DISMISSED_KEY = "flashyaf_rating_dismissed_at";
const MILESTONE_DAYS = [3, 7, 14, 30, 60, 90];

const GREETINGS = [
  "You showed up. That's what matters.",
  "Flashy is here — what do you need today?",
  "How are you feeling right now?",
  "You're not alone in this.",
  "Ready to track and ready to support you.",
  "Your data, your power — let's go.",
  "Another day, another flash — you handle it every time.",
];

const DAY_NAMES = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];

function getTodayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function computeStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const dateSet = new Set(dates);
  let streak = 0;
  const dt = new Date(getTodayKey() + "T00:00:00");
  while (true) {
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    if (dateSet.has(key)) {
      streak++;
      dt.setDate(dt.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function addStreakDateToStorage(): number {
  const today = getTodayKey();
  const dates: string[] = JSON.parse(localStorage.getItem(STREAK_KEY) || "[]");
  if (!dates.includes(today)) {
    dates.push(today);
    localStorage.setItem(STREAK_KEY, JSON.stringify(dates));
  }
  return computeStreak(dates);
}

function checkMilestoneAndNotify(streak: number) {
  if (!MILESTONE_DAYS.includes(streak)) return;
  const notifiedKey = `flashyaf_streak_milestone_${streak}`;
  if (localStorage.getItem(notifiedKey)) return;
  localStorage.setItem(notifiedKey, "1");
  const body = `You've been showing up for ${streak} days straight. That is real commitment. 🔥`;
  if ("Notification" in window) {
    if (Notification.permission === "granted") {
      new Notification("FLASHYAF™", { body, icon: "/favicon.ico" });
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((perm) => {
        if (perm === "granted") new Notification("FLASHYAF™", { body, icon: "/favicon.ico" });
      });
    }
  }
}

function shouldShowRatingPrompt(flashCount: number): boolean {
  if (flashCount < 5) return false;
  const lastDismissed = parseInt(localStorage.getItem(RATING_DISMISSED_KEY) || "0", 10);
  if (!lastDismissed) return true;
  return (Date.now() - lastDismissed) / 86400000 >= 7;
}

function hourRangeLabel(h: number): string {
  if (h >= 5 && h < 8) return "in the early morning";
  if (h >= 8 && h < 12) return "in the morning";
  if (h === 12) return "around noon";
  if (h >= 13 && h < 17) return "in the afternoon";
  if (h >= 17 && h < 20) return "in the evening";
  if (h >= 20 && h < 23) return "at night";
  return "in the late-night hours";
}

function timeOfDayLabel(h: number): string {
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}

function buildInsights(flashes: Flash[]): { icon: string; text: string }[] {
  const insights: { icon: string; text: string }[] = [];
  const byHour = Array(24).fill(0) as number[];
  flashes.forEach((f) => { byHour[new Date(f.startTime).getHours()]++; });
  const peakH = byHour.indexOf(Math.max(...byHour));
  insights.push({ icon: "🕐", text: `Your flashes tend to peak ${hourRangeLabel(peakH)}. Knowing when to expect them gives you a real edge — you can prepare, not just react.` });
  const avgSec = flashes.reduce((s, f) => s + f.durationSeconds, 0) / flashes.length;
  const avgMin = (avgSec / 60).toFixed(1);
  const diff = avgSec / 60 - 4.0;
  const comparison = Math.abs(diff) < 0.6 ? "right on par with" : diff > 0 ? "a bit longer than" : "shorter than";
  insights.push({ icon: "⏱️", text: `Your average flash lasts ${avgMin} minutes — ${comparison} the typical 4-minute flash. Every body runs on its own schedule.` });
  const firstTs = flashes[flashes.length - 1].startTime;
  const daysSince = Math.max(1, Math.round((Date.now() - firstTs) / 86400000));
  insights.push({ icon: "📅", text: `You've been tracking for ${daysSince} day${daysSince !== 1 ? "s" : ""} — ${flashes.length} flash${flashes.length !== 1 ? "es" : ""} logged. That kind of consistency is rare.` });
  const ratedFlashes = flashes.filter((f) => f.peakRating && f.peakRating > 0);
  if (ratedFlashes.length >= 3) {
    const byDay = Array(7).fill(null).map(() => ({ sum: 0, count: 0 }));
    ratedFlashes.forEach((f) => { const d = new Date(f.startTime).getDay(); byDay[d].sum += f.peakRating!; byDay[d].count++; });
    const peak = byDay.map((d, i) => ({ day: i, avg: d.count > 0 ? d.sum / d.count : 0 })).reduce((a, b) => a.avg >= b.avg ? a : b);
    insights.push({ icon: "📊", text: `Your most intense flashes tend to happen on ${DAY_NAMES[peak.day]}. A lighter schedule on ${DAY_NAMES[peak.day]} could help.` });
  } else {
    const byDayCount = Array(7).fill(0) as number[];
    flashes.forEach((f) => { byDayCount[new Date(f.startTime).getDay()]++; });
    const busiestDay = byDayCount.indexOf(Math.max(...byDayCount));
    insights.push({ icon: "📊", text: `${DAY_NAMES[busiestDay]} tend to be your highest-flash days. A little extra self-care on ${DAY_NAMES[busiestDay]} goes a long way.` });
  }
  const tod = timeOfDayLabel(peakH);
  insights.push({ icon: "💡", text: `Pattern tip: Keep a cold drink and a small fan nearby in the ${tod} — that's when your body tends to need it most.` });
  return insights;
}

interface Props {
  onStartTracking: () => void;
  onNavigate: (screen: string) => void;
  /** True while the 30-sec wake-word command window is open → show glow ring */
  wakeWindowActive?: boolean;
  /** True after 30-sec silence → mic is sleeping, show badge */
  micSleeping?: boolean;
  /** Increments every time a flash completes → triggers FlashForecastAlarm to recalculate */
  flashJustCompleted?: number;
}

export default function HomeScreen({ onStartTracking, onNavigate, wakeWindowActive = false, micSleeping = false, flashJustCompleted = 0 }: Props) {
  const { user } = useAuth();
  const { isDemo, enterDemo, demoFlashes } = useDemo();
  const [stats, setStats] = useState({ lastFlash: "—", todayCount: 0, weekCount: 0, avgDuration: "—" });
  const [flashes, setFlashes] = useState<Flash[]>([]);
  const [activeFlashBanner, setActiveFlashBanner] = useState(false);
  const [homeListening, setHomeListening] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [todayCheckinCount, setTodayCheckinCount] = useState(0);
  const [logoTaps, setLogoTaps] = useState(0);
  const logoTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showMerchCallout, setShowMerchCallout] = useState(false);
  const [featuredMerchIdx, setFeaturedMerchIdx] = useState(0);
  const [greetingIndex, setGreetingIndex] = useState(0);
  const [streak, setStreak] = useState(0);
  const [showRatingPrompt, setShowRatingPrompt] = useState(false);
  const [displayTodayCount, setDisplayTodayCount] = useState(0);
  const [displayWeekCount, setDisplayWeekCount] = useState(0);
  const [todayCountAnim, setTodayCountAnim] = useState(false);
  const [weekCountAnim, setWeekCountAnim] = useState(false);
  const [flashyToast, setFlashyToast] = useState("");
  const flashyToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [supportStyle, setSupportStyle] = useState<"warm" | "direct" | "mindful">("warm");
  const [prefersHumor, setPrefersHumor] = useState(false);
  const [showCarePackage, setShowCarePackage] = useState(false);
  const [partnerMsg, setPartnerMsg] = useState<{ id: string; name: string; message: string } | null>(null);
  const [partnerMsgDismissed, setPartnerMsgDismissed] = useState(false);
  const [capsuleMilestone, setCapsuleMilestone] = useState<30 | 60 | 90 | null>(null);
  const [showCapsule, setShowCapsule] = useState(false);
  const [capsuleBannerDismissed, setCapsuleBannerDismissed] = useState(false);
  const onStartTrackingRef = useRef(onStartTracking);
  useEffect(() => { onStartTrackingRef.current = onStartTracking; }, [onStartTracking]);

  // ── Feature 4: Breathe with Me auto-run toggle ────────────────────────────
  const AUTO_BREATHE_KEY = "flashyaf_auto_breathing";
  const [autoRunBreathing, setAutoRunBreathing] = useState(() =>
    localStorage.getItem(AUTO_BREATHE_KEY) === "true"
  );
  function toggleAutoBreathing() {
    const next = !autoRunBreathing;
    setAutoRunBreathing(next);
    localStorage.setItem(AUTO_BREATHE_KEY, String(next));
  }

  // ── Feature 5: Flash Journal Log Notebook ─────────────────────────────────
  const [showJournal, setShowJournal] = useState(false);
  interface JournalEntry { id: string; userId: string; date: string; time: string; stage: string; notes: string; createdAt: number; }
  const JOURNAL_LS_KEY = "flashyaf_heat_log";
  const JOURNAL_STAGE_LABELS: Record<string, string> = {
    STARTED: "🌡 Started", BLAZING: "🔥 Blazing", COOLING_DOWN: "🌊 Cooling Down",
    FLASH_ENDED: "✅ Flash Ended", BACK_TO_NORMAL: "😌 Back to Normal", OBSERVATION: "📝 Observation",
  };
  const JOURNAL_STAGE_COLORS: Record<string, string> = {
    STARTED: "#F5A623", BLAZING: "#FF4500", COOLING_DOWN: "#00BCD4",
    FLASH_ENDED: "#1ABC9C", BACK_TO_NORMAL: "#8BC34A", OBSERVATION: "#9B59B6",
  };
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [journalSpeakingId, setJournalSpeakingId] = useState<string | null>(null);
  const [journalDeleteId, setJournalDeleteId] = useState<string | null>(null);

  function loadJournalEntries() {
    try {
      const uid = user?.uid;
      if (!uid) return [];
      const all: JournalEntry[] = JSON.parse(localStorage.getItem(JOURNAL_LS_KEY) || "[]");
      return all.filter((e) => e.userId === uid).sort((a, b) => b.createdAt - a.createdAt);
    } catch { return []; }
  }
  function openJournal() {
    setJournalEntries(loadJournalEntries());
    setJournalDeleteId(null);
    setShowJournal(true);
  }
  function deleteJournalEntry(id: string) {
    try {
      const all: JournalEntry[] = JSON.parse(localStorage.getItem(JOURNAL_LS_KEY) || "[]");
      localStorage.setItem(JOURNAL_LS_KEY, JSON.stringify(all.filter((e) => e.id !== id)));
      setJournalEntries((prev) => prev.filter((e) => e.id !== id));
    } catch {}
    setJournalDeleteId(null);
  }
  function speakJournalEntry(entry: JournalEntry) {
    if (!("speechSynthesis" in window)) return;
    const stLabel = (JOURNAL_STAGE_LABELS[entry.stage] || entry.stage).replace(/^[^\w]+/, "");
    const dt = new Date(`${entry.date}T${entry.time}:00`);
    const dtStr = dt.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    const text = `${dtStr}. Stage: ${stLabel}. ${entry.notes ? "Note: " + entry.notes : "No notes recorded."}`;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.0; u.pitch = 1.1;
    window.speechSynthesis.speak(u);
    setJournalSpeakingId(entry.id);
    const dur = Math.min(4000, 1200 + entry.notes.length * 55);
    setTimeout(() => setJournalSpeakingId(null), dur);
  }

  function handleLogoTap() {
    if (isDemo) return;
    const next = logoTaps + 1;
    if (next >= 5) {
      setLogoTaps(0);
      if (logoTapTimer.current) clearTimeout(logoTapTimer.current);
      enterDemo();
      return;
    }
    setLogoTaps(next);
    if (logoTapTimer.current) clearTimeout(logoTapTimer.current);
    logoTapTimer.current = setTimeout(() => setLogoTaps(0), 2500);
  }

  // Merch callout — show every 3rd home open; also set greeting index
  useEffect(() => {
    const count = parseInt(localStorage.getItem(HOME_OPENS_KEY) || "0", 10) + 1;
    localStorage.setItem(HOME_OPENS_KEY, count.toString());
    setGreetingIndex((count - 1) % GREETINGS.length);
    if (count % 3 === 0) {
      setShowMerchCallout(true);
      setFeaturedMerchIdx(Math.floor(count / 3 - 1) % FEATURED_MERCH.length);
    }
  }, []);

  // Streak — load from localStorage on mount
  useEffect(() => {
    const dates: string[] = JSON.parse(localStorage.getItem(STREAK_KEY) || "[]");
    setStreak(computeStreak(dates));
  }, []);

  // Check localStorage for unfinished flash
  useEffect(() => {
    const stored = localStorage.getItem("activeFlash");
    if (stored) {
      const startTime = parseInt(stored, 10);
      if (Date.now() - startTime > 2 * 60 * 1000) setActiveFlashBanner(true);
    }
  }, []);

  // Load today's check-in count from localStorage
  useEffect(() => {
    const count = parseInt(localStorage.getItem(`flashyaf_checkin_count_${getTodayKey()}`) || "0", 10);
    setTodayCheckinCount(count);
  }, []);

  // Load latest unread partner message
  useEffect(() => {
    if (!user || isDemo) return;
    import("firebase/firestore").then(({ collection, query, where, orderBy, limit, getDocs, updateDoc, doc }) => {
      getDocs(query(
        collection(db, "partnerMessages"),
        where("userId", "==", user.uid),
        where("read", "==", false),
        orderBy("timestamp", "desc"),
        limit(1)
      )).then((snap) => {
        if (!snap.empty) {
          const d = snap.docs[0];
          setPartnerMsg({ id: d.id, name: d.data().name, message: d.data().message });
        }
      }).catch(() => {});
    });
  }, [user, isDemo]);

  // Voice recognition
  useEffect(() => {
    const SpeechRecognitionAPI =
      (window as Window & { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition ||
      window.SpeechRecognition;
    if (!SpeechRecognitionAPI) return;
    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true; recognition.interimResults = true; recognition.lang = "en-US";
    const shouldRun = { current: true };
    recognition.onstart = () => setHomeListening(true);
    recognition.onend = () => { if (shouldRun.current) setTimeout(() => { try { recognition.start(); } catch {} }, 400); };
    recognition.onerror = () => { if (shouldRun.current) setTimeout(() => { try { recognition.start(); } catch {} }, 800); };
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript.toLowerCase().trim();
        if (HOME_TRIGGERS.some((w) => t.includes(w))) {
          shouldRun.current = false; setHomeListening(false);
          try { recognition.stop(); } catch {}
          onStartTrackingRef.current(); return;
        }
      }
    };
    try { recognition.start(); } catch {}
    return () => { shouldRun.current = false; try { recognition.stop(); } catch {}; };
  }, []);

  // Load stats + flashes
  useEffect(() => {
    function computeStats(loaded: Flash[]) {
      if (loaded.length === 0) return;
      const last = loaded[0]; const lastDate = new Date(last.startTime); const now = new Date();
      const sameDay = (d: Date) => d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay()); startOfWeek.setHours(0, 0, 0, 0);
      const todayFlashes = loaded.filter((f) => sameDay(new Date(f.startTime)));
      const weekFlashes = loaded.filter((f) => f.startTime >= startOfWeek.getTime());
      const avgSec = loaded.reduce((sum, f) => sum + f.durationSeconds, 0) / loaded.length;
      const avgMin = Math.floor(avgSec / 60); const avgRemSec = Math.round(avgSec % 60);
      const isToday = sameDay(lastDate);
      const lastStr = isToday
        ? `Today ${lastDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
        : lastDate.toLocaleDateString([], { month: "short", day: "numeric" });
      setStats({ lastFlash: lastStr, todayCount: todayFlashes.length, weekCount: weekFlashes.length, avgDuration: `${avgMin}m ${avgRemSec}s` });
    }
    if (isDemo) {
      setFlashes(demoFlashes);
      computeStats(demoFlashes);
      return;
    }
    if (!user) return;
    async function loadStats() {
      const [snap, userSnap] = await Promise.all([
        getDocs(query(collection(db, "users", user!.uid, "flashes"), orderBy("startTime", "desc"), limit(500))),
        getDoc(doc(db, "users", user!.uid)),
      ]);
      const loaded: Flash[] = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Flash));
      setFlashes(loaded);
      computeStats(loaded);
      if (shouldShowRatingPrompt(loaded.length)) setShowRatingPrompt(true);

      // Time capsule milestone check
      if (loaded.length > 0 && user) {
        const firstTs = Math.min(...loaded.map((f) => f.startTime));
        const daysSince = Math.floor((Date.now() - firstTs) / (86400 * 1000));
        const milestone = daysSince >= 90 ? 90 : daysSince >= 60 ? 60 : daysSince >= 30 ? 30 : null;
        if (milestone) {
          const capsuleKey = `flashyaf_capsule_shown_${user.uid}_day${milestone}`;
          if (!localStorage.getItem(capsuleKey)) {
            import("firebase/firestore").then(({ doc, getDoc }) => {
              getDoc(doc(db, "users", user!.uid, "timeCapsules", `day${milestone}`))
                .then((snap) => {
                  if (!snap.exists()) {
                    setCapsuleMilestone(milestone);
                    localStorage.setItem(capsuleKey, "1");
                  }
                })
                .catch(() => {});
            });
          }
        }
      }
      if (userSnap.exists()) {
        const data = userSnap.data();
        if (data.supportStyle) setSupportStyle(data.supportStyle as "warm" | "direct" | "mindful");
        if (typeof data.prefersHumor === "boolean") setPrefersHumor(data.prefersHumor);
      }
    }
    loadStats();
  }, [user, isDemo, demoFlashes]);

  // ── Counter animations ────────────────────────────────────────────────────
  useEffect(() => {
    const target = stats.todayCount;
    const from = displayTodayCount;
    if (from === target) return;
    const startTime = performance.now();
    const dur = 650;
    function tick(now: number) {
      const p = Math.min((now - startTime) / dur, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setDisplayTodayCount(Math.round(from + (target - from) * ease));
      if (p < 1) requestAnimationFrame(tick);
      else setTodayCountAnim(true);
    }
    requestAnimationFrame(tick);
    const t = setTimeout(() => setTodayCountAnim(false), 500);
    return () => clearTimeout(t);
  }, [stats.todayCount]); // eslint-disable-line

  useEffect(() => {
    const target = stats.weekCount;
    const from = displayWeekCount;
    if (from === target) return;
    const startTime = performance.now();
    const dur = 800;
    function tick(now: number) {
      const p = Math.min((now - startTime) / dur, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setDisplayWeekCount(Math.round(from + (target - from) * ease));
      if (p < 1) requestAnimationFrame(tick);
      else setWeekCountAnim(true);
    }
    requestAnimationFrame(tick);
    const t = setTimeout(() => setWeekCountAnim(false), 500);
    return () => clearTimeout(t);
  }, [stats.weekCount]); // eslint-disable-line

  // ── Care Package trigger ───────────────────────────────────────────────────
  useEffect(() => {
    if (stats.todayCount < 5) return;
    const key = `flashyaf_care_pkg_${getTodayKey()}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");
    const t = setTimeout(() => setShowCarePackage(true), 600);
    return () => clearTimeout(t);
  }, [stats.todayCount]);

  // ── Flashy personality phrases ─────────────────────────────────────────────
  const FLASHY_PHRASES = [
    "I see you handling business. 🔥",
    "Not today, hot flash. Not today.",
    "You are literally built different.",
    "We move. Logged and sealed.",
    "That flash did not know who it was dealing with.",
  ];
  function showFlashyToast() {
    const phrase = FLASHY_PHRASES[Math.floor(Math.random() * FLASHY_PHRASES.length)];
    setFlashyToast(phrase);
    if (flashyToastTimer.current) clearTimeout(flashyToastTimer.current);
    flashyToastTimer.current = setTimeout(() => setFlashyToast(""), 3200);
  }

  const firstName = isDemo ? DEMO_USER_NAME : (user?.displayName?.split(" ")[0] || user?.email?.split("@")[0] || "there");

  // AI Insights
  const showInsights = flashes.length >= 10;
  const ascFlashes = showInsights ? [...flashes].reverse() : [];
  const insights = showInsights ? buildInsights(ascFlashes) : [];
  const insightIndex = showInsights ? TODAY_INDEX % insights.length : 0;
  const todayInsight = insights[insightIndex];

  return (
    <div style={styles.container}>
      {activeFlashBanner && (
        <div style={styles.activeBanner}>
          <span style={styles.bannerText}>🔥 You have an active flash — did it end?</span>
          <div style={styles.bannerActions}>
            <button style={styles.bannerResumeBtn} onClick={() => { localStorage.removeItem("activeFlash"); setActiveFlashBanner(false); onStartTracking(); }}>Go end it</button>
            <button style={styles.bannerDismissBtn} onClick={() => { localStorage.removeItem("activeFlash"); setActiveFlashBanner(false); }}>✕</button>
          </div>
        </div>
      )}

      <div style={styles.header}>
        <h1
          style={{ ...styles.appName, cursor: "pointer", userSelect: "none" }}
          onClick={handleLogoTap}
        >
          FLASHYAF™
          {logoTaps > 0 && logoTaps < 5 && (
            <span style={{ fontSize: "9px", opacity: 0.35, marginLeft: "6px", fontWeight: 600 }}>
              ({5 - logoTaps} more)
            </span>
          )}
        </h1>
        {homeListening && (
          <div style={styles.homeMicPill}>
            <span style={styles.homeMicDot} />
            <span style={styles.homeMicLabel}>Say "Flashy" to start</span>
          </div>
        )}
        {/* Mic sleeping badge — shown when 30-sec privacy window expired */}
        {micSleeping && (
          <div style={{
            display: "flex", alignItems: "center", gap: "6px",
            background: "rgba(30,40,70,0.85)", border: "1px solid rgba(100,150,255,0.3)",
            borderRadius: "100px", padding: "4px 12px",
          }}>
            <span style={{ fontSize: "13px" }}>😴</span>
            <span style={{ color: "rgba(150,180,255,0.75)", fontSize: "11px", fontWeight: 600 }}>
              Mic Sleeping · say "Hey Flashy" to wake
            </span>
          </div>
        )}
        {/* Wake-word active — 30-sec glow ring indicator */}
        {wakeWindowActive && (
          <div style={{
            display: "flex", alignItems: "center", gap: "6px",
            background: "rgba(255,69,0,0.12)", border: "1px solid rgba(255,69,0,0.55)",
            borderRadius: "100px", padding: "4px 14px",
            animation: "micPulse 1.4s ease-in-out infinite",
            boxShadow: "0 0 16px rgba(255,69,0,0.35)",
          }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#FF4500", display: "inline-block", animation: "micPulse 1.4s ease-in-out infinite" }} />
            <span style={{ color: "#FF7043", fontSize: "11px", fontWeight: 700 }}>
              Listening… tell me what you need
            </span>
          </div>
        )}
      </div>

      <div style={styles.content}>
        {/* Partner message banner */}
        {partnerMsg && !partnerMsgDismissed && (
          <div style={{
            background: "linear-gradient(135deg, rgba(233,30,140,0.12), rgba(142,68,173,0.10))",
            border: "1px solid rgba(233,30,140,0.35)",
            borderRadius: "18px", padding: "16px 16px 14px",
            display: "flex", flexDirection: "column", gap: "10px",
            marginBottom: "4px",
            boxShadow: "0 0 28px rgba(233,30,140,0.1)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "20px" }}>💜</span>
                <p style={{ color: "#E91E8C", fontSize: "12px", fontWeight: 900, margin: 0, letterSpacing: "0.5px", textTransform: "uppercase" as const }}>
                  A message from {partnerMsg.name}
                </p>
              </div>
              <button
                style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.3)", fontSize: "16px", cursor: "pointer", padding: "4px", lineHeight: 1 }}
                onClick={() => {
                  setPartnerMsgDismissed(true);
                  import("firebase/firestore").then(({ doc, updateDoc }) => {
                    updateDoc(doc(db, "partnerMessages", partnerMsg.id), { read: true }).catch(() => {});
                  });
                }}
              >✕</button>
            </div>
            <p style={{ color: "rgba(255,255,255,0.88)", fontSize: "14px", fontWeight: 500, lineHeight: 1.65, margin: 0, fontStyle: "italic" }}>
              "{partnerMsg.message}"
            </p>
          </div>
        )}

        {/* Time Capsule ready banner */}
        {capsuleMilestone && !capsuleBannerDismissed && !showCapsule && (
          <div style={{
            background: "linear-gradient(135deg, rgba(255,107,53,0.12), rgba(192,57,43,0.08))",
            border: "1px solid rgba(255,107,53,0.4)",
            borderRadius: "18px", padding: "14px 16px",
            display: "flex", alignItems: "center", gap: "12px",
            marginBottom: "4px",
            boxShadow: "0 0 28px rgba(255,107,53,0.1)",
            cursor: "pointer",
          }} onClick={() => setShowCapsule(true)}>
            <span style={{ fontSize: "28px", flexShrink: 0 }}>🕰️</span>
            <div style={{ flex: 1 }}>
              <p style={{ color: "#FF6B35", fontSize: "12px", fontWeight: 900, margin: "0 0 2px", letterSpacing: "0.5px", textTransform: "uppercase" as const }}>
                Your {capsuleMilestone}-Day Time Capsule is Ready
              </p>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "12px", fontWeight: 500, lineHeight: 1.45, margin: 0 }}>
                Tap to see your journey since day one →
              </p>
            </div>
            <button style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.25)", fontSize: "15px", cursor: "pointer", padding: "4px", lineHeight: 1 }}
              onClick={(e) => { e.stopPropagation(); setCapsuleBannerDismissed(true); }}>✕</button>
          </div>
        )}

        <p style={styles.greeting}>Hey {firstName}!</p>
        <p style={styles.subGreeting}>{GREETINGS[greetingIndex]}</p>

        {/* Glow ring pulses while 30-sec wake-word command window is open */}
        <div style={wakeWindowActive ? {
          borderRadius: "100px",
          boxShadow: "0 0 0 6px rgba(255,69,0,0.25), 0 0 0 12px rgba(255,69,0,0.12), 0 0 40px rgba(255,69,0,0.5)",
          animation: "pulse 1.2s infinite",
          display: "inline-block",
        } : undefined}>
          <button style={styles.trackBtn} onClick={onStartTracking}>
            <span style={styles.trackBtnIcon}>🧠</span>
            <span>FLASH STARTED</span>
          </button>
        </div>

        {/* Streak badge */}
        {streak > 0 && (
          <div style={styles.streakBadge}>
            <span style={styles.streakFlame}>🔥</span>
            <div style={styles.streakText}>
              <span style={styles.streakCount}>{streak}-day streak</span>
              <span style={styles.streakSub}>Keep showing up</span>
            </div>
            {MILESTONE_DAYS.includes(streak) && (
              <span style={styles.streakMilestone}>🎯 Milestone!</span>
            )}
          </div>
        )}

        {/* Stats grid */}
        <div style={styles.statsGrid}>
          <div style={styles.statBox}><span style={styles.statLabel}>Last Flash</span><span style={styles.statValue}>{stats.lastFlash}</span></div>
          <div style={styles.statBox}>
            <span style={styles.statLabel}>Today</span>
            <span
              key={`today-${displayTodayCount}`}
              style={{ ...styles.statValueLarge, animation: todayCountAnim ? "countPop 0.45s ease" : undefined }}
            >{displayTodayCount}</span>
          </div>
          <div style={styles.statBox}>
            <span style={styles.statLabel}>This Week</span>
            <span
              key={`week-${displayWeekCount}`}
              style={{ ...styles.statValueLarge, animation: weekCountAnim ? "countPop 0.45s ease" : undefined }}
            >{displayWeekCount}</span>
          </div>
          <div style={styles.statBox}><span style={styles.statLabel}>Avg Duration</span><span style={styles.statValue}>{stats.avgDuration}</span></div>
        </div>

        {/* ── Differentiation Stack ── */}
        <FlashyafScoreCard flashes={flashes} />
        <BodyBatteryGauge flashes={flashes} />
        <FlashForecastCard flashes={flashes} />

        {/* ── Flash Forecast Alarm™ ── */}
        {user && !isDemo && (
          <FlashForecastAlarm
            userId={user.uid}
            flashJustCompleted={flashJustCompleted}
            flashInProgress={false}
          />
        )}

        {/* Daily Check-In card */}
        <button
          style={{
            ...styles.checkinCard,
            border: todayCheckinCount > 0
              ? "1px solid rgba(26,188,156,0.35)"
              : "1px solid rgba(255,107,53,0.4)",
            background: todayCheckinCount > 0
              ? "rgba(26,188,156,0.06)"
              : "rgba(255,107,53,0.07)",
          }}
          onClick={() => setShowCheckIn(true)}
        >
          <span style={styles.checkinIcon}>📋</span>
          <div style={styles.checkinText}>
            <span style={styles.checkinTitle}>Daily Check-In</span>
            <span style={styles.checkinSub}>
              {todayCheckinCount > 0
                ? `Logged ${todayCheckinCount}x today · tap to add another`
                : "How are you feeling today? · 30 sec"}
            </span>
          </div>
          <div style={styles.checkinRight}>
            {todayCheckinCount > 0 ? (
              <span style={styles.checkinDone}>✓</span>
            ) : (
              <span style={styles.checkinDot} />
            )}
            <span style={styles.checkinArrow}>›</span>
          </div>
        </button>

        {/* ── Feature 4: Breathe with Me auto-run toggle card ───────────────── */}
        <button
          style={{
            display: "flex", alignItems: "center", gap: "12px",
            borderRadius: "16px", padding: "14px 16px",
            cursor: "pointer", width: "100%", textAlign: "left",
            background: autoRunBreathing ? "rgba(0,188,212,0.08)" : "rgba(255,255,255,0.04)",
            border: autoRunBreathing ? "1px solid rgba(0,188,212,0.4)" : "1px solid rgba(255,255,255,0.1)",
          } as React.CSSProperties}
          onClick={toggleAutoBreathing}
        >
          <span style={{ fontSize: "24px", flexShrink: 0 }}>🫁</span>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "3px" }}>
            <span style={{ color: "#fff", fontSize: "15px", fontWeight: 800 }}>Breathe with Me</span>
            <span style={{ color: "rgba(255,255,255,0.45)", fontSize: "12px", fontWeight: 500 }}>
              {autoRunBreathing
                ? "Auto-breathing ON · jumps in 60 s when blazing"
                : "Auto-breathing OFF · tap to enable"}
            </span>
          </div>
          {/* Toggle knob */}
          <div style={{
            width: "46px", height: "26px", borderRadius: "13px", flexShrink: 0,
            background: autoRunBreathing ? "#00BCD4" : "rgba(255,255,255,0.15)",
            position: "relative", transition: "background 0.25s ease",
          }}>
            <div style={{
              position: "absolute", top: "3px",
              left: autoRunBreathing ? "23px" : "3px",
              width: "20px", height: "20px", borderRadius: "50%",
              background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
              transition: "left 0.25s ease",
            }} />
          </div>
        </button>

        {/* ── Feature 5: Flash Journal Log Notebook card ────────────────────── */}
        <button
          style={{
            display: "flex", alignItems: "center", gap: "12px",
            borderRadius: "16px", padding: "14px 16px",
            cursor: "pointer", width: "100%", textAlign: "left",
            background: "rgba(142,68,173,0.07)",
            border: "1px solid rgba(142,68,173,0.3)",
          } as React.CSSProperties}
          onClick={openJournal}
        >
          <span style={{ fontSize: "24px", flexShrink: 0 }}>📓</span>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "3px" }}>
            <span style={{ color: "#fff", fontSize: "15px", fontWeight: 800 }}>Flash Journal Log Notebook</span>
            <span style={{ color: "rgba(255,255,255,0.45)", fontSize: "12px", fontWeight: 500 }}>
              Your personal heat-log notes · tap to review
            </span>
          </div>
          <span style={{ color: "rgba(142,68,173,0.8)", fontSize: "22px", fontWeight: 300 }}>›</span>
        </button>

        {/* AI Insights card */}
        {showInsights && todayInsight && (
          <div style={styles.insightCard}>
            <div style={styles.insightHeader}>
              <div style={styles.insightIconWrap}>
                <span style={styles.insightIconEmoji}>{todayInsight.icon}</span>
              </div>
              <div style={styles.insightMeta}>
                <span style={styles.insightBadge}>✦ AI INSIGHT</span>
                <span style={styles.insightSub}>Personalized for you</span>
              </div>
            </div>
            <p style={styles.insightText}>{todayInsight.text}</p>
            <div style={styles.insightFooter}>
              <div style={styles.insightDots}>
                {insights.map((_, i) => (
                  <div key={i} style={{ ...styles.insightDot, background: i === insightIndex ? "rgba(142,68,173,0.9)" : "rgba(255,255,255,0.15)", width: i === insightIndex ? "16px" : "6px" }} />
                ))}
              </div>
              <span style={styles.insightRotate}>Updates daily · {insightIndex + 1} of {insights.length}</span>
            </div>
          </div>
        )}

        {/* Daily tip */}
        <div style={styles.tipCard}>
          <div style={styles.tipHeader}>
            <span style={styles.tipBulb}>💡</span>
            <div style={styles.tipMeta}>
              <span style={styles.tipLabel}>FLASHY TIP</span>
              <span style={styles.tipCategory}>{todayTip.category}</span>
            </div>
          </div>
          <p style={styles.tipText}>{todayTip.tip}</p>
          <p style={styles.tipRotateNote}>New tip every day</p>
        </div>

        {/* Merch callout — rotates, shows every 3rd open */}
        {showMerchCallout && (() => {
          const merch = FEATURED_MERCH[featuredMerchIdx];
          return (
            <div style={{ ...styles.merchCallout, background: merch.bg, border: `1px solid ${merch.border}` }}>
              <div style={styles.merchCalloutLeft}>
                <span style={{ fontSize: "32px", lineHeight: 1 }}>{merch.emoji}</span>
                <div style={styles.merchCalloutText}>
                  <p style={{ ...styles.merchCalloutName, color: merch.color }}>{merch.name}</p>
                  <p style={styles.merchCalloutTagline}>{merch.tagline}</p>
                </div>
              </div>
              <div style={styles.merchCalloutRight}>
                <button
                  style={{ ...styles.merchShopBtn, background: merch.color }}
                  onClick={() => onNavigate("shop")}
                >
                  Shop →
                </button>
                <button
                  style={styles.merchDismissBtn}
                  onClick={() => setShowMerchCallout(false)}
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })()}

        {user?.email === ADMIN_EMAIL && (
          <button style={styles.adminBtn} onClick={() => onNavigate("admin")}>🔬 Research Dashboard</button>
        )}
      </div>

      {/* 6-tab nav */}
      <div style={styles.bottomNav}>
        <button style={{ ...styles.navBtn, ...styles.navBtnActive }} onClick={() => onNavigate("home")}><span>🏠</span><span style={styles.navLabel}>Home</span></button>
        <button style={styles.navBtn} onClick={() => onNavigate("history")}><span>📋</span><span style={styles.navLabel}>History</span></button>
        <button style={styles.navBtn} onClick={() => onNavigate("community")}><span>💬</span><span style={styles.navLabel}>Community</span></button>
        <button style={styles.navBtn} onClick={() => onNavigate("learn")}><span>📚</span><span style={styles.navLabel}>Learn</span></button>
        <button style={styles.navBtn} onClick={() => onNavigate("shop")}><span>🛍️</span><span style={styles.navLabel}>Shop</span></button>
        <button style={styles.navBtn} onClick={() => onNavigate("settings")}><span>⚙️</span><span style={styles.navLabel}>Settings</span></button>
      </div>

      {showCheckIn && (
        <DailyCheckInModal
          onClose={() => setShowCheckIn(false)}
          onSaved={() => {
            const next = todayCheckinCount + 1;
            setTodayCheckinCount(next);
            localStorage.setItem(`flashyaf_checkin_count_${getTodayKey()}`, String(next));
            const newStreak = addStreakDateToStorage();
            setStreak(newStreak);
            checkMilestoneAndNotify(newStreak);
            setShowCheckIn(false);
            showFlashyToast();
          }}
        />
      )}

      {/* Flashy personality toast */}
      {flashyToast !== "" && (
        <div style={{
          position: "fixed", bottom: "90px", left: "50%", transform: "translateX(-50%)",
          zIndex: 800, maxWidth: "340px", width: "calc(100% - 48px)",
          background: "rgba(13,27,42,0.97)", backdropFilter: "blur(12px)",
          border: "1px solid rgba(255,69,0,0.45)",
          borderRadius: "100px", padding: "13px 22px",
          display: "flex", alignItems: "center", gap: "10px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,69,0,0.12)",
          animation: "slideUp 0.3s ease",
        }}>
          <span style={{ fontSize: "18px", flexShrink: 0 }}>💬</span>
          <span style={{ color: "#fff", fontSize: "13px", fontWeight: 700, lineHeight: 1.4 }}>
            {flashyToast}
          </span>
        </div>
      )}

      {/* ── Feature 5: Flash Journal Log Notebook bottom-sheet modal ────── */}
      {showJournal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 900,
          background: "rgba(0,0,0,0.72)", backdropFilter: "blur(10px)",
          display: "flex", alignItems: "flex-end", justifyContent: "center",
        }} onClick={() => setShowJournal(false)}>
          <div
            style={{
              width: "100%", maxWidth: "480px", maxHeight: "82vh",
              background: "linear-gradient(180deg, #0F1623 0%, #0A0A0A 100%)",
              border: "1px solid rgba(142,68,173,0.35)",
              borderRadius: "24px 24px 0 0",
              display: "flex", flexDirection: "column",
              boxShadow: "0 -12px 48px rgba(0,0,0,0.7)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sheet handle + header */}
            <div style={{ padding: "14px 20px 12px", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
              <div style={{ width: "40px", height: "4px", borderRadius: "2px", background: "rgba(255,255,255,0.18)", margin: "0 auto 14px" }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "20px" }}>📓</span>
                  <div>
                    <p style={{ color: "#fff", fontSize: "15px", fontWeight: 900, margin: 0 }}>Flash Journal Log Notebook</p>
                    <p style={{ color: "rgba(142,68,173,0.7)", fontSize: "11px", fontWeight: 600, margin: 0 }}>
                      {journalEntries.length} entr{journalEntries.length === 1 ? "y" : "ies"} · your personal log
                    </p>
                  </div>
                </div>
                <button
                  style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "50%", width: "30px", height: "30px", color: "rgba(255,255,255,0.5)", fontSize: "14px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                  onClick={() => setShowJournal(false)}
                >✕</button>
              </div>
            </div>

            {/* Scrollable entries */}
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px 24px", display: "flex", flexDirection: "column", gap: "10px" }}>
              {journalEntries.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 20px" }}>
                  <p style={{ fontSize: "32px", margin: "0 0 10px" }}>📭</p>
                  <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px", fontWeight: 600, margin: 0 }}>No notes logged yet.</p>
                  <p style={{ color: "rgba(255,255,255,0.25)", fontSize: "12px", margin: "6px 0 0" }}>Say "Hey Flashy, take a note" during a flash.</p>
                </div>
              ) : journalEntries.map((entry) => {
                const stLabel = (JOURNAL_STAGE_LABELS[entry.stage] || entry.stage);
                const stColor = JOURNAL_STAGE_COLORS[entry.stage] || "#FF4500";
                const isDeleting = journalDeleteId === entry.id;
                const isSpeaking = journalSpeakingId === entry.id;
                return (
                  <div key={entry.id} style={{
                    background: "rgba(255,255,255,0.03)",
                    border: `1px solid ${stColor}40`,
                    borderRadius: "16px", padding: "14px 16px",
                    display: "flex", flexDirection: "column", gap: "8px",
                  }}>
                    {/* Date / Time / Stage row */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <span style={{ color: "rgba(255,255,255,0.55)", fontSize: "11px", fontWeight: 600 }}>{entry.date}</span>
                      <span style={{ color: "rgba(255,255,255,0.25)", fontSize: "11px" }}>|</span>
                      <span style={{ color: "rgba(255,255,255,0.55)", fontSize: "11px", fontWeight: 600 }}>{entry.time}</span>
                      <span style={{ color: "rgba(255,255,255,0.25)", fontSize: "11px" }}>|</span>
                      <span style={{
                        background: `${stColor}22`, border: `1px solid ${stColor}55`,
                        borderRadius: "100px", padding: "2px 8px",
                        color: stColor, fontSize: "10px", fontWeight: 800, letterSpacing: "0.4px",
                      }}>{stLabel}</span>
                    </div>
                    {/* Note text */}
                    {entry.notes ? (
                      <p style={{ color: "rgba(255,255,255,0.82)", fontSize: "13px", fontWeight: 500, lineHeight: 1.6, margin: 0 }}>
                        {entry.notes}
                      </p>
                    ) : (
                      <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "13px", fontStyle: "italic", margin: 0 }}>No note text.</p>
                    )}
                    {/* Action buttons */}
                    <div style={{ display: "flex", gap: "8px", marginTop: "2px" }}>
                      <button
                        style={{
                          flex: 1, background: isSpeaking ? "rgba(245,166,35,0.18)" : "rgba(255,255,255,0.06)",
                          border: isSpeaking ? "1px solid rgba(245,166,35,0.55)" : "1px solid rgba(255,255,255,0.12)",
                          borderRadius: "10px", color: isSpeaking ? "#F5A623" : "rgba(255,255,255,0.7)",
                          fontSize: "12px", fontWeight: 700, padding: "9px 12px", cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: "5px",
                        }}
                        onClick={() => speakJournalEntry(entry)}
                      >
                        {isSpeaking ? "🔊 Playing…" : "🔊 Listen to Note"}
                      </button>
                      {isDeleting ? (
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            style={{ background: "rgba(192,57,43,0.2)", border: "1px solid rgba(192,57,43,0.6)", borderRadius: "10px", color: "#C0392B", fontSize: "12px", fontWeight: 900, padding: "9px 14px", cursor: "pointer" }}
                            onClick={() => deleteJournalEntry(entry.id)}
                          >Delete</button>
                          <button
                            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "10px", color: "rgba(255,255,255,0.55)", fontSize: "12px", fontWeight: 700, padding: "9px 12px", cursor: "pointer" }}
                            onClick={() => setJournalDeleteId(null)}
                          >Cancel</button>
                        </div>
                      ) : (
                        <button
                          style={{
                            background: "rgba(192,57,43,0.08)", border: "1px solid rgba(192,57,43,0.3)",
                            borderRadius: "10px", color: "rgba(192,57,43,0.8)",
                            fontSize: "12px", fontWeight: 700, padding: "9px 12px", cursor: "pointer",
                            display: "flex", alignItems: "center", gap: "5px",
                          }}
                          onClick={() => setJournalDeleteId(entry.id)}
                        >
                          🗑 Delete Entry
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showCapsule && capsuleMilestone && user && (
        <TimeCapsuleModal
          flashes={flashes}
          milestone={capsuleMilestone}
          user={user}
          onClose={() => setShowCapsule(false)}
          onSealed={() => { setCapsuleMilestone(null); setCapsuleBannerDismissed(true); }}
        />
      )}

      {showCarePackage && (() => {
        const now = new Date();
        const todayFlashes = flashes.filter((f) => {
          const d = new Date(f.startTime);
          return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });
        return (
          <CarePackageModal
            supportStyle={supportStyle}
            prefersHumor={prefersHumor}
            todayFlashes={todayFlashes}
            onClose={() => setShowCarePackage(false)}
          />
        );
      })()}

      {showRatingPrompt && (
        <div style={styles.ratingPromptOverlay}>
          <div style={styles.ratingPromptCard}>
            <button
              style={styles.ratingPromptClose}
              onClick={() => {
                localStorage.setItem(RATING_DISMISSED_KEY, String(Date.now()));
                setShowRatingPrompt(false);
              }}
            >✕</button>
            <p style={styles.ratingPromptEmoji}>⭐</p>
            <p style={styles.ratingPromptTitle}>
              You've been with us through {flashes.length} flash{flashes.length !== 1 ? "es" : ""}.
            </p>
            <p style={styles.ratingPromptSub}>Would you rate FLASHYAF™?</p>
            <div style={styles.ratingPromptBtns}>
              <button
                style={styles.ratingPromptRate}
                onClick={() => {
                  window.open("https://flashyafapp.com", "_blank");
                  localStorage.setItem(RATING_DISMISSED_KEY, String(Date.now()));
                  setShowRatingPrompt(false);
                }}
              >
                Rate 5 Stars ⭐⭐⭐⭐⭐
              </button>
              <button
                style={styles.ratingPromptLater}
                onClick={() => {
                  localStorage.setItem(RATING_DISMISSED_KEY, String(Date.now()));
                  setShowRatingPrompt(false);
                }}
              >
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { minHeight: "100vh", background: "var(--color-bg)", display: "flex", flexDirection: "column", maxWidth: "480px", margin: "0 auto", fontFamily: "'Inter', sans-serif", position: "relative" },
  activeBanner: { background: "rgba(255,69,0,0.18)", border: "1px solid rgba(255,69,0,0.45)", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" },
  bannerText: { color: "#fff", fontSize: "13px", fontWeight: 600, flex: 1 },
  bannerActions: { display: "flex", gap: "8px", alignItems: "center" },
  bannerResumeBtn: { background: "var(--color-primary)", border: "none", borderRadius: "8px", color: "#fff", fontSize: "12px", fontWeight: 700, padding: "7px 14px", cursor: "pointer", whiteSpace: "nowrap" },
  bannerDismissBtn: { background: "transparent", border: "1px solid rgba(255,255,255,0.25)", borderRadius: "6px", color: "rgba(255,255,255,0.6)", fontSize: "12px", fontWeight: 700, padding: "6px 10px", cursor: "pointer" },
  header: { padding: "20px 24px 0", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" },
  appName: { color: "var(--color-accent)", fontSize: "22px", fontWeight: 900, letterSpacing: "2px", margin: 0 },
  homeMicPill: { display: "flex", alignItems: "center", gap: "6px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "100px", padding: "4px 12px" },
  homeMicDot: { width: "6px", height: "6px", borderRadius: "50%", background: "#1ABC9C", animation: "micPulse 1.4s ease-in-out infinite", display: "inline-block", flexShrink: 0 },
  homeMicLabel: { color: "rgba(255,255,255,0.6)", fontSize: "11px", fontWeight: 600, fontStyle: "italic" },
  content: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px", gap: "8px" },
  greeting: { color: "var(--color-text)", fontSize: "28px", fontWeight: 800, margin: 0, textAlign: "center" },
  subGreeting: { color: "var(--color-text-muted)", fontSize: "16px", margin: "0 0 28px 0", textAlign: "center" },
  trackBtn: { background: "var(--color-primary)", border: "none", borderRadius: "100px", color: "var(--color-text)", fontSize: "20px", fontWeight: 800, padding: "22px 48px", cursor: "pointer", display: "flex", alignItems: "center", gap: "12px", letterSpacing: "1px", boxShadow: "0 0 40px rgba(192,57,43,0.7), 0 0 20px rgba(255,107,53,0.4), 0 8px 24px rgba(0,0,0,0.5)", animation: "pulse 2s infinite", marginBottom: "32px" },
  trackBtnIcon: { fontSize: "26px" },
  statsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", width: "100%", boxSizing: "border-box" },
  statBox: { background: "var(--color-card)", borderRadius: "16px", padding: "16px 14px", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" },
  statLabel: { color: "var(--color-text-muted)", fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", textAlign: "center" },
  statValue: { color: "var(--color-text)", fontSize: "14px", fontWeight: 700, textAlign: "center" },
  statValueLarge: { color: "var(--color-text)", fontSize: "28px", fontWeight: 900, textAlign: "center", lineHeight: 1 },
  checkinCard: { display: "flex", alignItems: "center", gap: "12px", borderRadius: "16px", padding: "14px 16px", cursor: "pointer", width: "100%", textAlign: "left", marginTop: "14px" },
  checkinIcon: { fontSize: "24px", flexShrink: 0 },
  checkinText: { flex: 1, display: "flex", flexDirection: "column", gap: "3px" },
  checkinTitle: { color: "#fff", fontSize: "15px", fontWeight: 800 },
  checkinSub: { color: "rgba(255,255,255,0.45)", fontSize: "12px", fontWeight: 500 },
  checkinRight: { display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 },
  checkinDone: { color: "#1ABC9C", fontSize: "18px", fontWeight: 900 },
  checkinDot: { width: "8px", height: "8px", borderRadius: "50%", background: "var(--color-accent)", animation: "micPulse 2s ease-in-out infinite" },
  checkinArrow: { color: "var(--color-accent)", fontSize: "22px", fontWeight: 300 },
  insightCard: { marginTop: "14px", width: "100%", boxSizing: "border-box", background: "linear-gradient(135deg, rgba(142,68,173,0.14) 0%, rgba(52,73,94,0.12) 100%)", border: "1.5px solid rgba(142,68,173,0.45)", borderRadius: "20px", padding: "16px 18px 14px", boxShadow: "0 0 28px rgba(142,68,173,0.1), inset 0 1px 0 rgba(142,68,173,0.18)" },
  insightHeader: { display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" },
  insightIconWrap: { width: "44px", height: "44px", borderRadius: "12px", background: "rgba(142,68,173,0.2)", border: "1px solid rgba(142,68,173,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  insightIconEmoji: { fontSize: "22px", lineHeight: 1 },
  insightMeta: { display: "flex", flexDirection: "column", gap: "2px" },
  insightBadge: { color: "rgba(195,155,211,0.95)", fontSize: "10px", fontWeight: 800, letterSpacing: "2px", textTransform: "uppercase" },
  insightSub: { color: "rgba(142,68,173,0.65)", fontSize: "12px", fontWeight: 600 },
  insightText: { color: "var(--color-text)", fontSize: "14px", lineHeight: 1.65, margin: "0 0 14px", fontWeight: 500 },
  insightFooter: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  insightDots: { display: "flex", alignItems: "center", gap: "5px" },
  insightDot: { height: "6px", borderRadius: "3px", transition: "width 0.3s ease, background 0.3s ease" },
  insightRotate: { color: "rgba(142,68,173,0.5)", fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.8px" },
  tipCard: { marginTop: "14px", width: "100%", boxSizing: "border-box", background: "linear-gradient(135deg, rgba(245,166,35,0.07) 0%, rgba(245,166,35,0.03) 100%)", border: "1.5px solid rgba(245,166,35,0.55)", borderRadius: "20px", padding: "18px 18px 14px", boxShadow: "0 0 20px rgba(245,166,35,0.08), inset 0 1px 0 rgba(245,166,35,0.15)" },
  tipHeader: { display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" },
  tipBulb: { fontSize: "28px", flexShrink: 0, lineHeight: 1, filter: "drop-shadow(0 0 8px rgba(245,166,35,0.7))" },
  tipMeta: { display: "flex", flexDirection: "column", gap: "1px" },
  tipLabel: { color: "rgba(245,166,35,0.9)", fontSize: "10px", fontWeight: 800, letterSpacing: "2px", textTransform: "uppercase" },
  tipCategory: { color: "rgba(245,166,35,0.6)", fontSize: "12px", fontWeight: 600 },
  tipText: { color: "var(--color-text)", fontSize: "14px", lineHeight: 1.6, margin: "0 0 10px", fontWeight: 500 },
  tipRotateNote: { color: "rgba(245,166,35,0.4)", fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px", margin: 0, textAlign: "right" },
  adminBtn: { marginTop: "16px", background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.3)", borderRadius: "12px", color: "var(--color-accent)", fontSize: "13px", fontWeight: 700, padding: "12px 20px", cursor: "pointer", letterSpacing: "0.3px", width: "100%" },
  streakBadge: { display: "flex", alignItems: "center", gap: "10px", background: "rgba(255,107,53,0.1)", border: "1px solid rgba(255,107,53,0.3)", borderRadius: "100px", padding: "8px 16px", marginBottom: "8px", width: "100%", boxSizing: "border-box" as const },
  streakFlame: { fontSize: "20px", flexShrink: 0 },
  streakText: { display: "flex", flexDirection: "column" as const, gap: "1px", flex: 1 },
  streakCount: { color: "#FF6B35", fontSize: "13px", fontWeight: 800 },
  streakSub: { color: "rgba(255,255,255,0.35)", fontSize: "10px", fontWeight: 600 },
  streakMilestone: { background: "rgba(245,166,35,0.15)", border: "1px solid rgba(245,166,35,0.4)", borderRadius: "100px", padding: "3px 10px", color: "#F5A623", fontSize: "10px", fontWeight: 800, flexShrink: 0 },
  ratingPromptOverlay: { position: "fixed" as const, inset: 0, zIndex: 800, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "0 0 20px" },
  ratingPromptCard: { background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "24px 24px 16px 16px", padding: "28px 24px 24px", width: "100%", maxWidth: "480px", display: "flex", flexDirection: "column" as const, alignItems: "center", gap: "10px", position: "relative" as const, boxShadow: "0 -8px 40px rgba(0,0,0,0.6)" },
  ratingPromptClose: { position: "absolute" as const, top: "14px", right: "14px", background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "50%", width: "28px", height: "28px", color: "rgba(255,255,255,0.5)", fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  ratingPromptEmoji: { fontSize: "40px", margin: "0 0 4px" },
  ratingPromptTitle: { color: "#fff", fontSize: "16px", fontWeight: 800, textAlign: "center" as const, margin: 0, lineHeight: 1.4 },
  ratingPromptSub: { color: "rgba(255,255,255,0.5)", fontSize: "13px", textAlign: "center" as const, margin: "0 0 6px" },
  ratingPromptBtns: { display: "flex", flexDirection: "column" as const, gap: "10px", width: "100%" },
  ratingPromptRate: { background: "linear-gradient(135deg, #F5A623 0%, #FFD700 100%)", border: "none", borderRadius: "100px", color: "#1A1A1A", fontSize: "15px", fontWeight: 900, padding: "16px 24px", cursor: "pointer", width: "100%", letterSpacing: "0.3px" },
  ratingPromptLater: { background: "transparent", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "100px", color: "rgba(255,255,255,0.4)", fontSize: "14px", fontWeight: 600, padding: "13px 24px", cursor: "pointer", width: "100%" },
  merchCallout: { borderRadius: "16px", padding: "14px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" },
  merchCalloutLeft: { display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: 0 },
  merchCalloutText: { display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 },
  merchCalloutName: { fontSize: "13px", fontWeight: 800, margin: 0, lineHeight: 1.2 },
  merchCalloutTagline: { color: "rgba(255,255,255,0.5)", fontSize: "11px", margin: 0, lineHeight: 1.3 },
  merchCalloutRight: { display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 },
  merchShopBtn: { border: "none", borderRadius: "100px", color: "#fff", fontSize: "12px", fontWeight: 800, padding: "8px 14px", cursor: "pointer" },
  merchDismissBtn: { background: "rgba(255,255,255,0.08)", border: "none", borderRadius: "50%", width: "28px", height: "28px", color: "rgba(255,255,255,0.4)", fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  bottomNav: { display: "flex", borderTop: "1px solid rgba(255,255,255,0.1)", background: "var(--color-bg)", padding: "10px 0 18px" },
  navBtn: { flex: 1, background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", cursor: "pointer", fontSize: "18px", padding: "4px 0" },
  navBtnActive: { color: "var(--color-accent)" },
  navLabel: { fontSize: "9px", fontWeight: 600 },
};
