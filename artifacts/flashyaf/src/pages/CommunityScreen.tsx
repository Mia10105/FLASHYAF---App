import { useEffect, useState, useRef } from "react";
import {
  collection, query, orderBy, limit, onSnapshot,
  addDoc, updateDoc, doc, increment, deleteField,
  where, getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { trackEvent } from "@/lib/analytics";
import { useDemo } from "@/context/DemoContext";
import { DEMO_COMMUNITY_POSTS } from "@/lib/demoData";
import FlameSpinner from "@/components/FlameSpinner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props { onNavigate: (screen: string) => void; }

interface CommunityPost {
  id: string; text: string; authorName: string; userId: string;
  timestamp: number; reactions: { youGotThis: number; same: number; sendingCoolVibes: number };
  userReactions?: Record<string, string>;
  status?: "pending" | "approved" | "flagged";
}

// Fix 4 — content moderation helpers
const PROFANITY_LIST = ["fuck", "shit", "bitch", "asshole", "cunt", "bastard"];
const PERSONAL_INFO_RE = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b|\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
function getPostStatus(text: string): "pending" | "flagged" {
  const lower = text.toLowerCase();
  if (PROFANITY_LIST.some((w) => lower.includes(w)) || PERSONAL_INFO_RE.test(text)) return "flagged";
  return "pending";
}
interface Story {
  id: string; text: string; authorFirstName: string; city: string; userId: string;
  timestamp: number; status: "pending" | "approved"; resonates: number;
  userResonates?: Record<string, boolean>; weekOf: string;
}
interface HotMoment {
  id: string; text: string; authorName: string; userId: string; timestamp: number;
  dead: number; sameGirl: number; youSurvived: number;
  userReactions?: Record<string, string>; weekOf: string;
  status?: "pending" | "approved";
}
interface HumorSub {
  id: string; text: string; authorFirstName: string; city: string; userId: string;
  timestamp: number; status: "pending" | "approved"; votes: number;
  userVotes?: Record<string, boolean>;
}
interface EncSub {
  id: string; text: string; authorFirstName: string; city: string; userId: string;
  timestamp: number; status: "pending" | "approved"; votes: number;
  userVotes?: Record<string, boolean>;
}
interface Spotlight {
  story: Story | null; moment: HotMoment | null;
  humor: HumorSub | null; enc: EncSub | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GUIDELINES_KEY = "flashyaf_community_guidelines_acked";
const SPOTLIGHT_KEY  = "flashyaf_spotlight_seen_";

const COMMUNITY_GUIDELINES = [
  { icon: "💜", rule: "Be kind — we are all in this together" },
  { icon: "🚫", rule: "No medical advice or diagnoses — share experiences, not prescriptions" },
  { icon: "🔒", rule: "No personal information — no full names, phone numbers, or addresses" },
  { icon: "✨", rule: "No promotional content, spam, or off-topic posts" },
];

const FEED_REACTIONS = [
  { id: "youGotThis",       emoji: "💪", label: "You Got This"       },
  { id: "same",             emoji: "🙋", label: "Same"               },
  { id: "sendingCoolVibes", emoji: "❄️", label: "Sending Cool Vibes"  },
] as const;

const MOMENT_REACTIONS = [
  { id: "dead",        emoji: "😂", label: "Dead 😂"     },
  { id: "sameGirl",   emoji: "🙋", label: "Same Girl"    },
  { id: "youSurvived", emoji: "💪", label: "You Survived" },
] as const;

const BUBBLE_COLORS = ["#C0392B","#8E44AD","#2980B9","#16A085","#D35400","#2C3E50"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function bubbleColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return BUBBLE_COLORS[Math.abs(h) % BUBBLE_COLORS.length];
}

function timeAgo(ts: number): string {
  const d = Date.now() - ts, m = Math.floor(d / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function wordCount(s: string): number {
  return s.trim() === "" ? 0 : s.trim().split(/\s+/).length;
}

function weekOf(date = new Date()): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const start = new Date(d.getFullYear(), 0, 1);
  const wk = Math.ceil(((d.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(wk).padStart(2, "0")}`;
}

function lastWeekOf(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return weekOf(d);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CommunityScreen({ onNavigate }: Props) {
  const { user } = useAuth();
  const { isDemo } = useDemo();

  // Guidelines
  const [guidelinesAcked, setGuidelinesAcked] = useState(
    () => localStorage.getItem(GUIDELINES_KEY) === "1"
  );

  // Inner tab
  const [tab, setTab] = useState<"feed" | "moments" | "stories" | "humor" | "enc">("feed");

  // ── Feed ──────────────────────────────────────────────────────────────────
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [myReactions, setMyReactions] = useState<Record<string, string | null>>({});
  const [feedText, setFeedText] = useState("");
  const [useName, setUseName] = useState(false);
  const [feedName, setFeedName] = useState((user?.displayName || "").split(" ")[0] || "");
  const [feedPosting, setFeedPosting] = useState(false);
  const [feedError, setFeedError] = useState("");
  const [feedPending, setFeedPending] = useState(false);
  const [lastPostTime, setLastPostTime] = useState(0);
  const [newPostId, setNewPostId] = useState<string | null>(null);
  const promptRef = useRef(["Share how you're doing today…", "What's on your mind right now?", "Drop a flash update or a little win…"][Math.floor(Math.random() * 3)]);

  // ── Stories ───────────────────────────────────────────────────────────────
  const [stories, setStories] = useState<Story[]>([]);
  const [storiesLoading, setStoriesLoading] = useState(false);
  const [storyText, setStoryText] = useState("");
  const [storyFirstName, setStoryFirstName] = useState((user?.displayName || "").split(" ")[0] || "");
  const [storyCity, setStoryCity] = useState("");
  const [storyPosting, setStoryPosting] = useState(false);
  const [storyDone, setStoryDone] = useState(false);
  const [storyError, setStoryError] = useState("");
  const [storyResonates, setStoryResonates] = useState<Record<string, boolean>>({});

  // ── Hot Moments ───────────────────────────────────────────────────────────
  const [moments, setMoments] = useState<HotMoment[]>([]);
  const [momentsLoading, setMomentsLoading] = useState(false);
  const [momentText, setMomentText] = useState("");
  const [momentName, setMomentName] = useState((user?.displayName || "").split(" ")[0] || "");
  const [momentPosting, setMomentPosting] = useState(false);
  const [momentDone, setMomentDone] = useState(false);
  const [momentReactions, setMomentReactions] = useState<Record<string, string | null>>({});

  // ── Suggest ───────────────────────────────────────────────────────────────
  const [humorText, setHumorText] = useState("");
  const [humorFirstName, setHumorFirstName] = useState((user?.displayName || "").split(" ")[0] || "");
  const [humorCity, setHumorCity] = useState("");
  const [humorPosting, setHumorPosting] = useState(false);
  const [humorDone, setHumorDone] = useState(false);
  const [myHumor, setMyHumor] = useState<HumorSub[]>([]);
  const [topHumor, setTopHumor] = useState<HumorSub[]>([]);

  const [encText, setEncText] = useState("");
  const [encFirstName, setEncFirstName] = useState((user?.displayName || "").split(" ")[0] || "");
  const [encCity, setEncCity] = useState("");
  const [encPosting, setEncPosting] = useState(false);
  const [encDone, setEncDone] = useState(false);
  const [myEnc, setMyEnc] = useState<EncSub[]>([]);
  const [topEnc, setTopEnc] = useState<EncSub[]>([]);

  // ── Spotlight ─────────────────────────────────────────────────────────────
  const [spotlight, setSpotlight] = useState<Spotlight | null>(null);
  const [spotlightDismissed, setSpotlightDismissed] = useState(
    () => localStorage.getItem(SPOTLIGHT_KEY + lastWeekOf()) === "1"
  );

  // ── Real-time feed ────────────────────────────────────────────────────────
  useEffect(() => {
    if (isDemo) {
      setPosts(DEMO_COMMUNITY_POSTS as unknown as CommunityPost[]);
      setFeedLoading(false);
      return;
    }
    if (!user) {
      setFeedLoading(false);
      return;
    }
    const q = query(collection(db, "community"), orderBy("timestamp", "desc"), limit(100));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const loaded = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as CommunityPost))
          .filter((p) => !p.status || p.status === "approved" || (p.status === "pending" && p.userId === user.uid));
        setPosts(loaded);
        const r: Record<string, string | null> = {};
        loaded.forEach((p) => { r[p.id] = p.userReactions?.[user.uid] ?? null; });
        setMyReactions((prev) => ({ ...r, ...prev }));
        setFeedLoading(false);
      },
      (err) => {
        console.error("Community feed error:", err);
        setFeedLoading(false);
      }
    );
    return () => unsub();
  }, [user, isDemo]);

  // ── Stories (load on tab open) ─────────────────────────────────────────────
  useEffect(() => {
    if (tab !== "stories" || isDemo || !user) return;
    setStoriesLoading(true);
    const q = query(collection(db, "stories"), where("status", "==", "approved"), orderBy("resonates", "desc"), limit(30));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const loaded = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Story));
        setStories(loaded);
        const r: Record<string, boolean> = {};
        loaded.forEach((s) => { r[s.id] = !!s.userResonates?.[user.uid]; });
        setStoryResonates(r);
        setStoriesLoading(false);
      },
      (err) => {
        console.error("Stories feed error:", err);
        setStoriesLoading(false);
      }
    );
    return () => unsub();
  }, [tab, user, isDemo]);

  // ── Hot Moments (load on tab open, sorted by total reactions) ─────────────
  useEffect(() => {
    if (tab !== "moments" || isDemo || !user) return;
    setMomentsLoading(true);
    const thisWeek = weekOf();
    const q = query(collection(db, "hotMoments"), where("weekOf", "==", thisWeek), orderBy("timestamp", "desc"), limit(100));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const loaded = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as HotMoment))
          .filter((m) => !m.status || m.status === "approved" || (m.status === "pending" && m.userId === user.uid));
        loaded.sort((a, b) => (b.dead + b.sameGirl + b.youSurvived) - (a.dead + a.sameGirl + a.youSurvived));
        setMoments(loaded);
        const r: Record<string, string | null> = {};
        loaded.forEach((m) => { r[m.id] = m.userReactions?.[user.uid] ?? null; });
        setMomentReactions((prev) => ({ ...r, ...prev }));
        setMomentsLoading(false);
      },
      (err) => {
        console.error("Hot moments feed error:", err);
        setMomentsLoading(false);
      }
    );
    return () => unsub();
  }, [tab, user, isDemo]);

  // ── Humor/Enc subs (load on humor/enc tab) ────────────────────────────────
  useEffect(() => {
    if ((tab !== "humor" && tab !== "enc") || isDemo || !user) return;
    // My humor
    getDocs(query(collection(db, "humorSubmissions"), where("userId", "==", user.uid), orderBy("timestamp", "desc"), limit(20)))
      .then((snap) => setMyHumor(snap.docs.map((d) => ({ id: d.id, ...d.data() } as HumorSub))))
      .catch(() => {});
    // Top approved humor (Hall of Fame)
    getDocs(query(collection(db, "humorSubmissions"), where("status", "==", "approved"), orderBy("votes", "desc"), limit(10)))
      .then((snap) => setTopHumor(snap.docs.map((d) => ({ id: d.id, ...d.data() } as HumorSub))))
      .catch(() => {});
    // My enc
    getDocs(query(collection(db, "encouragementSubmissions"), where("userId", "==", user.uid), orderBy("timestamp", "desc"), limit(20)))
      .then((snap) => setMyEnc(snap.docs.map((d) => ({ id: d.id, ...d.data() } as EncSub))))
      .catch(() => {});
    // Top approved enc
    getDocs(query(collection(db, "encouragementSubmissions"), where("status", "==", "approved"), orderBy("votes", "desc"), limit(10)))
      .then((snap) => setTopEnc(snap.docs.map((d) => ({ id: d.id, ...d.data() } as EncSub))))
      .catch(() => {});
  }, [tab, user, isDemo]);

  // ── Spotlight (load last week's top content) ───────────────────────────────
  useEffect(() => {
    if (spotlightDismissed || isDemo || !user) return;
    const lw = lastWeekOf();
    async function loadSpotlight() {
      try {
        const [storySnap, momentSnap, humorSnap, encSnap] = await Promise.all([
          getDocs(query(collection(db, "stories"), where("status", "==", "approved"), where("weekOf", "==", lw), orderBy("resonates", "desc"), limit(1))),
          getDocs(query(collection(db, "hotMoments"), where("weekOf", "==", lw), orderBy("timestamp", "desc"), limit(50))),
          getDocs(query(collection(db, "humorSubmissions"), where("status", "==", "approved"), orderBy("votes", "desc"), limit(1))),
          getDocs(query(collection(db, "encouragementSubmissions"), where("status", "==", "approved"), orderBy("votes", "desc"), limit(1))),
        ]);
        const topMoment = momentSnap.docs
          .map((d) => ({ id: d.id, ...d.data() } as HotMoment))
          .sort((a, b) => (b.dead + b.sameGirl + b.youSurvived) - (a.dead + a.sameGirl + a.youSurvived))[0] ?? null;
        const sl: Spotlight = {
          story: storySnap.docs[0] ? { id: storySnap.docs[0].id, ...storySnap.docs[0].data() } as Story : null,
          moment: topMoment,
          humor: humorSnap.docs[0] ? { id: humorSnap.docs[0].id, ...humorSnap.docs[0].data() } as HumorSub : null,
          enc: encSnap.docs[0] ? { id: encSnap.docs[0].id, ...encSnap.docs[0].data() } as EncSub : null,
        };
        if (sl.story || sl.moment || sl.humor || sl.enc) {
          setSpotlight(sl);
        }
      } catch {}
    }
    loadSpotlight();
  }, [user, isDemo, spotlightDismissed]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function ackGuidelines() {
    localStorage.setItem(GUIDELINES_KEY, "1");
    setGuidelinesAcked(true);
  }

  function dismissSpotlight() {
    localStorage.setItem(SPOTLIGHT_KEY + lastWeekOf(), "1");
    setSpotlightDismissed(true);
    setSpotlight(null);
  }

  async function handleFeedPost() {
    const trimmed = feedText.trim();
    if (!trimmed || trimmed.length > 200) return;
    if (Date.now() - lastPostTime < 5000) { setFeedError("Please wait a moment before posting again."); return; }
    const name = useName && feedName.trim() ? feedName.trim().split(" ")[0] : "Anonymous";
    setFeedPosting(true); setFeedError("");
    try {
      const status = getPostStatus(trimmed);
      await addDoc(collection(db, "community"), {
        text: trimmed, authorName: name, userId: user!.uid, timestamp: Date.now(),
        reactions: { youGotThis: 0, same: 0, sendingCoolVibes: 0 }, userReactions: {},
        status,
      });
      setFeedPending(true);
      setTimeout(() => setFeedPending(false), 6000);
      setFeedText(""); setLastPostTime(Date.now());
    } catch (err: unknown) {
      console.error("Community post failed:", err);
      const code = (err as { code?: string })?.code;
      if (code === "permission-denied") {
        setFeedError("Permission denied — please sign out and back in, then try again.");
      } else {
        setFeedError(`Couldn't post (${code ?? "unknown error"}). Please try again.`);
      }
    } finally { setFeedPosting(false); }
  }

  async function handleFeedReaction(postId: string, reactionId: string) {
    if (!user) return;
    const current = myReactions[postId] ?? null;
    const postRef = doc(db, "community", postId);
    const next = current === reactionId ? null : reactionId;
    setMyReactions((prev) => ({ ...prev, [postId]: next }));
    setPosts((prev) => prev.map((p) => {
      if (p.id !== postId) return p;
      const r = { ...p.reactions } as Record<string, number>;
      if (current === reactionId) r[reactionId] = Math.max(0, (r[reactionId] || 0) - 1);
      else { if (current) r[current] = Math.max(0, (r[current] || 0) - 1); r[reactionId] = (r[reactionId] || 0) + 1; }
      return { ...p, reactions: r as CommunityPost["reactions"] };
    }));
    const updates: Record<string, unknown> = {};
    if (current === reactionId) {
      updates[`reactions.${reactionId}`] = increment(-1);
      updates[`userReactions.${user.uid}`] = deleteField();
    } else {
      if (current) updates[`reactions.${current}`] = increment(-1);
      updates[`reactions.${reactionId}`] = increment(1);
      updates[`userReactions.${user.uid}`] = reactionId;
    }
    await updateDoc(postRef, updates).catch(() => {});
  }

  async function handleSubmitStory() {
    const trimmed = storyText.trim();
    if (!trimmed || wordCount(trimmed) > 500) return;
    if (!storyFirstName.trim()) { setStoryError("Please enter your first name."); return; }
    setStoryPosting(true); setStoryError("");
    try {
      await addDoc(collection(db, "stories"), {
        text: trimmed, authorFirstName: storyFirstName.trim().split(" ")[0],
        city: storyCity.trim() || "Somewhere", userId: user!.uid,
        timestamp: Date.now(), status: "pending", resonates: 0,
        userResonates: {}, weekOf: weekOf(),
      });
      trackEvent("community_post_submitted", { post_type: "story" });
      setStoryDone(true); setStoryText(""); setStoryCity("");
    } catch { setStoryError("Couldn't submit. Please try again."); }
    finally { setStoryPosting(false); }
  }

  async function handleResonate(storyId: string) {
    if (!user) return;
    const isActive = storyResonates[storyId];
    setStoryResonates((prev) => ({ ...prev, [storyId]: !isActive }));
    setStories((prev) => prev.map((s) => s.id !== storyId ? s : { ...s, resonates: s.resonates + (isActive ? -1 : 1) }));
    const ref = doc(db, "stories", storyId);
    if (isActive) {
      await updateDoc(ref, { resonates: increment(-1), [`userResonates.${user.uid}`]: deleteField() }).catch(() => {});
    } else {
      await updateDoc(ref, { resonates: increment(1), [`userResonates.${user.uid}`]: true }).catch(() => {});
    }
  }

  async function handleSubmitMoment() {
    const trimmed = momentText.trim();
    if (!trimmed || trimmed.length > 280) return;
    setMomentPosting(true);
    try {
      await addDoc(collection(db, "hotMoments"), {
        text: trimmed, authorName: momentName.trim().split(" ")[0] || "Anonymous",
        userId: user!.uid, timestamp: Date.now(),
        dead: 0, sameGirl: 0, youSurvived: 0, userReactions: {}, weekOf: weekOf(),
        status: "pending",
      });
      trackEvent("community_post_submitted", { post_type: "moment" });
      setMomentDone(true); setMomentText("");
    } catch {}
    finally { setMomentPosting(false); }
  }

  async function handleMomentReaction(momentId: string, reactionId: string) {
    if (!user) return;
    const current = momentReactions[momentId] ?? null;
    const next = current === reactionId ? null : reactionId;
    setMomentReactions((prev) => ({ ...prev, [momentId]: next }));

    type MReactionKey = "dead" | "sameGirl" | "youSurvived";
    function adjustCount(m: HotMoment, key: string, delta: number): HotMoment {
      const k = key as MReactionKey;
      return { ...m, [k]: Math.max(0, (m[k] || 0) + delta) };
    }
    setMoments((prev) => prev.map((m) => {
      if (m.id !== momentId) return m;
      let updated = { ...m };
      if (current === reactionId) {
        updated = adjustCount(updated, reactionId, -1);
      } else {
        if (current) updated = adjustCount(updated, current, -1);
        updated = adjustCount(updated, reactionId, 1);
      }
      return updated;
    }));
    const ref = doc(db, "hotMoments", momentId);
    const updates: Record<string, unknown> = {};
    if (current === reactionId) {
      updates[reactionId] = increment(-1);
      updates[`userReactions.${user.uid}`] = deleteField();
    } else {
      if (current) updates[current] = increment(-1);
      updates[reactionId] = increment(1);
      updates[`userReactions.${user.uid}`] = reactionId;
    }
    await updateDoc(ref, updates).catch(() => {});
  }

  async function handleSubmitHumor() {
    const trimmed = humorText.trim();
    if (!trimmed || trimmed.length > 200) return;
    if (!humorFirstName.trim()) return;
    setHumorPosting(true);
    try {
      await addDoc(collection(db, "humorSubmissions"), {
        text: trimmed, authorFirstName: humorFirstName.trim().split(" ")[0],
        city: humorCity.trim() || "Somewhere", userId: user!.uid,
        timestamp: Date.now(), status: "pending", votes: 0, userVotes: {},
      });
      trackEvent("community_post_submitted", { post_type: "humor" });
      setHumorDone(true); setHumorText(""); setHumorCity("");
      setMyHumor((prev) => [{ id: "tmp-" + Date.now(), text: trimmed, authorFirstName: humorFirstName.trim().split(" ")[0], city: humorCity.trim() || "Somewhere", userId: user!.uid, timestamp: Date.now(), status: "pending", votes: 0 }, ...prev]);
    } catch {}
    finally { setHumorPosting(false); }
  }

  async function handleSubmitEnc() {
    const trimmed = encText.trim();
    if (!trimmed || trimmed.length > 200) return;
    if (!encFirstName.trim()) return;
    setEncPosting(true);
    try {
      await addDoc(collection(db, "encouragementSubmissions"), {
        text: trimmed, authorFirstName: encFirstName.trim().split(" ")[0],
        city: encCity.trim() || "Somewhere", userId: user!.uid,
        timestamp: Date.now(), status: "pending", votes: 0, userVotes: {},
      });
      trackEvent("community_post_submitted", { post_type: "encouragement" });
      setEncDone(true); setEncText(""); setEncCity("");
      setMyEnc((prev) => [{ id: "tmp-" + Date.now(), text: trimmed, authorFirstName: encFirstName.trim().split(" ")[0], city: encCity.trim() || "Somewhere", userId: user!.uid, timestamp: Date.now(), status: "pending", votes: 0 }, ...prev]);
    } catch {}
    finally { setEncPosting(false); }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={s.container}>

      {/* ── Community Guidelines Modal ── */}
      {!guidelinesAcked && (
        <div style={s.guidelinesBackdrop}>
          <div style={s.guidelinesSheet}>
            <div style={s.guidelinesIconWrap}>
              <span style={{ fontSize: "40px" }}>💜</span>
            </div>
            <p style={s.guidelinesTitle}>Community Guidelines</p>
            <p style={s.guidelinesSub}>
              This is a safe, supportive space for women navigating menopause.
              Before you join, please agree to these community standards:
            </p>
            <div style={s.guidelinesRules}>
              {COMMUNITY_GUIDELINES.map((g, i) => (
                <div key={i} style={s.guidelineRule}>
                  <span style={s.guidelineRuleIcon}>{g.icon}</span>
                  <span style={s.guidelineRuleText}>{g.rule}</span>
                </div>
              ))}
            </div>
            <button style={s.guidelinesAckBtn} onClick={ackGuidelines}>
              I Agree — Take Me In 💜
            </button>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div style={s.header}>
        <div style={s.headerTop}>
          <p style={s.appName}>FLASHYAF™</p>
          <p style={s.headerTitle}>Community</p>
          <p style={s.headerSub}>You are not alone 💜</p>
        </div>

        {/* Inner tab bar — scrollable 5-tab strip */}
        <div style={s.innerTabBar}>
          {(["feed", "moments", "stories", "humor", "enc"] as const).map((t) => {
            const labels: Record<string, string> = { feed: "💬 Main Feed", moments: "🔥 Hot Moments", stories: "📖 Stories", humor: "😂 Humor Bank", enc: "💜 Encouragement" };
            return (
              <button
                key={t}
                style={{ ...s.innerTab, ...(tab === t ? s.innerTabActive : {}) }}
                onClick={() => setTab(t)}
              >
                {labels[t]}
              </button>
            );
          })}
        </div>
      </div>

      <div style={s.scroll}>

        {/* ── Weekly Spotlight Banner ── */}
        {spotlight && !spotlightDismissed && (
          <div style={s.spotlightBanner}>
            <div style={s.spotlightBannerHeader}>
              <span style={s.spotlightStar}>⭐</span>
              <div>
                <p style={s.spotlightBannerTitle}>This Week's Community Spotlight</p>
                <p style={s.spotlightBannerSub}>Top contributions from last week</p>
              </div>
              <button style={s.spotlightDismiss} onClick={dismissSpotlight}>✕</button>
            </div>
            {spotlight.story && (
              <div style={s.spotlightItem}>
                <span style={s.spotlightItemLabel}>📖 Top Story</span>
                <p style={s.spotlightItemText}>"{spotlight.story.text.slice(0, 120)}{spotlight.story.text.length > 120 ? "…" : ""}"</p>
                <span style={s.spotlightItemAuthor}>— {spotlight.story.authorFirstName} from {spotlight.story.city}</span>
              </div>
            )}
            {spotlight.moment && (
              <div style={s.spotlightItem}>
                <span style={s.spotlightItemLabel}>🔥 Top Hot Moment</span>
                <p style={s.spotlightItemText}>"{spotlight.moment.text.slice(0, 120)}{spotlight.moment.text.length > 120 ? "…" : ""}"</p>
                <span style={s.spotlightItemAuthor}>— {spotlight.moment.authorName}</span>
              </div>
            )}
            {spotlight.humor && (
              <div style={s.spotlightItem}>
                <span style={s.spotlightItemLabel}>😂 Top Humor Line</span>
                <p style={s.spotlightItemText}>"{spotlight.humor.text}"</p>
                <span style={s.spotlightItemAuthor}>Submitted by {spotlight.humor.authorFirstName} from {spotlight.humor.city}</span>
              </div>
            )}
            {spotlight.enc && (
              <div style={s.spotlightItem}>
                <span style={s.spotlightItemLabel}>💜 Top Encouragement</span>
                <p style={s.spotlightItemText}>"{spotlight.enc.text}"</p>
                <span style={s.spotlightItemAuthor}>Submitted by {spotlight.enc.authorFirstName} from {spotlight.enc.city}</span>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════ FEED TAB ══════════════════════ */}
        {tab === "feed" && (
          <>
            {/* Compose */}
            <div style={s.composeCard}>
              <textarea
                style={s.composeInput}
                placeholder={promptRef.current}
                value={feedText}
                onChange={(e) => { setFeedText(e.target.value); setFeedError(""); }}
                maxLength={210} rows={3}
              />
              <div style={s.composeFooter}>
                <div style={s.nameRow}>
                  <div
                    style={{ ...s.togglePill, background: useName ? "#8E44AD" : "rgba(255,255,255,0.12)" }}
                    onClick={() => setUseName((v) => !v)}
                  >
                    <div style={{ ...s.toggleKnob, left: useName ? "20px" : "3px" }} />
                  </div>
                  <span style={s.nameToggleLabel}>Use first name</span>
                  {useName && (
                    <input
                      style={s.nameInput} placeholder="First name"
                      value={feedName} onChange={(e) => setFeedName(e.target.value)} maxLength={20}
                    />
                  )}
                </div>
                <div style={s.composeRight}>
                  <span style={{ ...s.charCount, color: (200 - feedText.length) < 20 ? "#FF6B6B" : "rgba(255,255,255,0.3)" }}>
                    {200 - feedText.length}
                  </span>
                  <button
                    style={{ ...s.postBtn, opacity: (feedText.trim().length > 0 && !feedPosting && feedText.length <= 200) ? 1 : 0.45 }}
                    onClick={handleFeedPost}
                    disabled={feedText.trim().length === 0 || feedPosting || feedText.length > 200}
                  >
                    {feedPosting ? "…" : "Post"}
                  </button>
                </div>
              </div>
              {feedError && <p style={s.postError}>{feedError}</p>}
            </div>

            {/* Fix 4 — pending review confirmation */}
            {feedPending && (
              <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", background: "rgba(26,188,156,0.1)", border: "1px solid rgba(26,188,156,0.25)", borderRadius: "14px", padding: "12px 14px", marginBottom: "10px" }}>
                <span>✅</span>
                <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "13px", lineHeight: 1.5, margin: 0 }}>
                  Your post is pending review and will appear once approved by our team. Usually within 24 hours.
                </p>
              </div>
            )}

            {feedLoading && <FlameSpinner label="Loading community…" />}

            {!feedLoading && posts.length === 0 && (
              <div style={s.emptyState}>
                <p style={{ fontSize: "48px", margin: "0 0 12px" }}>💜</p>
                <p style={s.emptyTitle}>Be the first to share</p>
                <p style={s.emptySub}>This community is ready for your voice.</p>
              </div>
            )}

            {posts.map((post) => {
              const isNew = post.id === newPostId;
              const isOwn = post.userId === user?.uid;
              const isPending = post.status === "pending" && isOwn;
              return (
                <div key={post.id} style={{ ...s.postCard, ...(isNew ? s.postCardNew : {}), ...(isOwn ? s.postCardOwn : {}), ...(isPending ? { opacity: 0.75 } : {}) }}>
                  <div style={s.postHeader}>
                    <div style={{ ...s.authorBubble, background: bubbleColor(post.id) }}>
                      <span style={s.authorInitial}>{post.authorName === "Anonymous" ? "👤" : post.authorName[0].toUpperCase()}</span>
                    </div>
                    <div style={s.postMeta}>
                      <p style={s.authorName}>{post.authorName}{isOwn && <span style={s.youBadge}> · you</span>}</p>
                      <p style={s.postTime}>{timeAgo(post.timestamp)}</p>
                    </div>
                    {isPending ? (
                      <span style={s.pendingBadge}>⏳ Pending Review</span>
                    ) : isNew ? (
                      <span style={s.newBadge}>✨ Posted</span>
                    ) : null}
                  </div>
                  <p style={s.postText}>{post.text}</p>
                  <div style={s.reactionsRow}>
                    {FEED_REACTIONS.map(({ id, emoji, label }) => {
                      const active = myReactions[post.id] === id;
                      const count = (post.reactions as Record<string, number>)[id] || 0;
                      return (
                        <button key={id} style={{ ...s.reactionBtn, background: active ? "rgba(142,68,173,0.25)" : "rgba(255,255,255,0.06)", border: active ? "1px solid rgba(142,68,173,0.6)" : "1px solid rgba(255,255,255,0.1)", color: active ? "#C39BD3" : "rgba(255,255,255,0.5)" }} onClick={() => handleFeedReaction(post.id, id)}>
                          <span style={s.reactionEmoji}>{emoji}</span>
                          <span>{label}</span>
                          {count > 0 && <span style={s.reactionCount}>{count}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {!feedLoading && posts.length > 0 && <p style={s.feedEnd}>You've seen all recent posts 💜</p>}
          </>
        )}

        {/* ══════════════════════ STORIES TAB ══════════════════════ */}
        {tab === "stories" && (
          <>
            {/* Submit Your Story */}
            <div style={s.storyComposeCard}>
              <p style={s.storyComposeTitle}>📖 Share Your Story</p>
              <p style={s.storyComposeSub}>Tell us about your menopause journey — up to 500 words. Stories go through a brief review before appearing publicly.</p>

              {storyDone ? (
                <div style={s.submittedBox}>
                  <span style={{ fontSize: "32px" }}>💜</span>
                  <p style={s.submittedTitle}>Story submitted!</p>
                  <p style={s.submittedSub}>Your story is in review. We'll feature it soon.</p>
                  <button style={s.submittedRetryBtn} onClick={() => setStoryDone(false)}>Submit Another</button>
                </div>
              ) : (
                <>
                  <div style={s.storyNameRow}>
                    <input style={s.storyInput} placeholder="First name *" value={storyFirstName} onChange={(e) => setStoryFirstName(e.target.value)} maxLength={30} />
                    <input style={s.storyInput} placeholder="City (optional)" value={storyCity} onChange={(e) => setStoryCity(e.target.value)} maxLength={40} />
                  </div>
                  <textarea
                    style={s.storyTextarea}
                    placeholder="Write your story here… up to 500 words."
                    value={storyText}
                    onChange={(e) => { setStoryText(e.target.value); setStoryError(""); }}
                    rows={7}
                  />
                  <div style={s.storyFooter}>
                    <span style={{ ...s.charCount, color: wordCount(storyText) > 480 ? "#FF6B6B" : "rgba(255,255,255,0.3)" }}>
                      {wordCount(storyText)}/500 words
                    </span>
                    <button
                      style={{ ...s.storySubmitBtn, opacity: (storyText.trim().length > 0 && wordCount(storyText) <= 500 && storyFirstName.trim() && !storyPosting) ? 1 : 0.45 }}
                      onClick={handleSubmitStory}
                      disabled={storyText.trim().length === 0 || wordCount(storyText) > 500 || !storyFirstName.trim() || storyPosting}
                    >
                      {storyPosting ? "Submitting…" : "Submit Story"}
                    </button>
                  </div>
                  {storyError && <p style={s.postError}>{storyError}</p>}
                </>
              )}
            </div>

            {/* Featured Stories */}
            <div style={s.featuredHeader}>
              <span style={s.featuredLabel}>⭐ Featured Stories</span>
              <span style={s.featuredSub}>Real journeys from our community</span>
            </div>

            {storiesLoading && <FlameSpinner label="Loading stories…" />}

            {!storiesLoading && stories.length === 0 && (
              <div style={s.emptyState}>
                <p style={{ fontSize: "40px", margin: "0 0 8px" }}>📖</p>
                <p style={s.emptyTitle}>No stories yet</p>
                <p style={s.emptySub}>Be the first to share your journey.</p>
              </div>
            )}

            {stories.map((story) => {
              const resonated = storyResonates[story.id];
              return (
                <div key={story.id} style={s.storyCard}>
                  <div style={s.storyCardHeader}>
                    <div style={{ ...s.authorBubble, background: bubbleColor(story.id) }}>
                      <span style={s.authorInitial}>{story.authorFirstName[0]?.toUpperCase() || "?"}</span>
                    </div>
                    <div style={s.postMeta}>
                      <p style={s.authorName}>{story.authorFirstName}</p>
                      <p style={s.postTime}>{story.city} · {timeAgo(story.timestamp)}</p>
                    </div>
                  </div>
                  <p style={s.storyCardText}>{story.text}</p>
                  <button
                    style={{ ...s.resonatesBtn, background: resonated ? "rgba(142,68,173,0.25)" : "rgba(255,255,255,0.06)", border: resonated ? "1px solid rgba(142,68,173,0.6)" : "1px solid rgba(255,255,255,0.1)", color: resonated ? "#C39BD3" : "rgba(255,255,255,0.5)" }}
                    onClick={() => handleResonate(story.id)}
                  >
                    <span>💜</span>
                    <span>This Resonates</span>
                    {story.resonates > 0 && <span style={s.reactionCount}>{story.resonates}</span>}
                  </button>
                </div>
              );
            })}
          </>
        )}

        {/* ══════════════════════ HOT MOMENTS TAB ══════════════════════ */}
        {tab === "moments" && (
          <>
            <div style={s.momentsHeader}>
              <p style={s.momentsTitle}>🔥 Hot Moments</p>
              <p style={s.momentsSub}>The funny, the embarrassing, the relatable. Share your most memorable hot flash moment — 280 characters max.</p>
            </div>

            {/* Compose */}
            {momentDone ? (
              <div style={s.submittedBox}>
                <span style={{ fontSize: "32px" }}>🔥</span>
                <p style={s.submittedTitle}>Hot Moment shared!</p>
                <p style={s.submittedSub}>Your moment is pending review and will appear once approved. Usually within 24 hours.</p>
                <button style={s.submittedRetryBtn} onClick={() => setMomentDone(false)}>Share Another</button>
              </div>
            ) : (
              <div style={s.momentComposeCard}>
                <textarea
                  style={s.momentTextarea}
                  placeholder="Tell us your funniest or most embarrassing hot flash moment…"
                  value={momentText}
                  onChange={(e) => { setMomentText(e.target.value); }}
                  maxLength={290} rows={3}
                />
                <div style={s.momentComposeFooter}>
                  <input style={s.momentNameInput} placeholder="Name (or Anonymous)" value={momentName} onChange={(e) => setMomentName(e.target.value)} maxLength={20} />
                  <div style={s.composeRight}>
                    <span style={{ ...s.charCount, color: (280 - momentText.length) < 20 ? "#FF6B6B" : "rgba(255,255,255,0.3)" }}>
                      {280 - momentText.length}
                    </span>
                    <button
                      style={{ ...s.momentPostBtn, opacity: momentText.trim().length > 0 && momentText.length <= 280 && !momentPosting ? 1 : 0.45 }}
                      onClick={handleSubmitMoment}
                      disabled={momentText.trim().length === 0 || momentText.length > 280 || momentPosting}
                    >
                      {momentPosting ? "…" : "Share 🔥"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Sort badge */}
            <div style={s.momentsSortBadge}>
              🏆 Most reacted this week · Resets every Monday
            </div>

            {momentsLoading && <FlameSpinner label="Loading moments…" />}

            {!momentsLoading && moments.length === 0 && (
              <div style={s.emptyState}>
                <p style={{ fontSize: "40px", margin: "0 0 8px" }}>😂</p>
                <p style={s.emptyTitle}>No moments yet this week</p>
                <p style={s.emptySub}>Be the first to share your funniest hot flash story!</p>
              </div>
            )}

            {moments.map((m) => {
              const total = m.dead + m.sameGirl + m.youSurvived;
              return (
                <div key={m.id} style={s.momentCard}>
                  <div style={s.postHeader}>
                    <div style={{ ...s.authorBubble, background: bubbleColor(m.id) }}>
                      <span style={s.authorInitial}>{m.authorName === "Anonymous" ? "👤" : m.authorName[0]?.toUpperCase()}</span>
                    </div>
                    <div style={s.postMeta}>
                      <p style={s.authorName}>{m.authorName}</p>
                      <p style={s.postTime}>{timeAgo(m.timestamp)}</p>
                    </div>
                    {total > 0 && (
                      <div style={s.momentTotalBadge}>
                        <span style={{ fontSize: "10px", fontWeight: 900, color: "rgba(255,107,53,0.9)" }}>{total} reactions</span>
                      </div>
                    )}
                  </div>
                  <p style={s.postText}>{m.text}</p>
                  <div style={s.reactionsRow}>
                    {MOMENT_REACTIONS.map(({ id, emoji, label }) => {
                      const active = momentReactions[m.id] === id;
                      const count = (m as unknown as Record<string, number>)[id] || 0;
                      return (
                        <button key={id} style={{ ...s.reactionBtn, background: active ? "rgba(255,107,53,0.2)" : "rgba(255,255,255,0.06)", border: active ? "1px solid rgba(255,107,53,0.5)" : "1px solid rgba(255,255,255,0.1)", color: active ? "#FF6B35" : "rgba(255,255,255,0.5)" }} onClick={() => handleMomentReaction(m.id, id)}>
                          <span style={s.reactionEmoji}>{emoji}</span>
                          <span>{label}</span>
                          {count > 0 && <span style={s.reactionCount}>{count}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* ══════════════════════ HUMOR BANK TAB ══════════════════════ */}
        {tab === "humor" && (
          <>
            <div style={s.suggestCard}>
              <p style={s.suggestCardTitle}>😂 Suggest a Humor Line</p>
              <p style={s.suggestCardSub}>Got a funny line about hot flashes? Submit it for review. If approved, it'll appear in the Humor Bank with credit!</p>
              {humorDone ? (
                <div style={s.submittedBox}>
                  <span style={{ fontSize: "28px" }}>😂</span>
                  <p style={s.submittedTitle}>Line submitted!</p>
                  <p style={s.submittedSub}>Your humor line is pending review. If approved, it'll go live in the Humor Bank.</p>
                  <button style={s.submittedRetryBtn} onClick={() => setHumorDone(false)}>Submit Another</button>
                </div>
              ) : (
                <>
                  <div style={s.storyNameRow}>
                    <input style={s.storyInput} placeholder="First name *" value={humorFirstName} onChange={(e) => setHumorFirstName(e.target.value)} maxLength={20} />
                    <input style={s.storyInput} placeholder="City (optional)" value={humorCity} onChange={(e) => setHumorCity(e.target.value)} maxLength={40} />
                  </div>
                  <textarea
                    style={s.momentTextarea}
                    placeholder="Your funniest hot flash one-liner…"
                    value={humorText}
                    onChange={(e) => setHumorText(e.target.value)}
                    maxLength={210} rows={3}
                  />
                  <div style={s.storyFooter}>
                    <span style={{ ...s.charCount, color: (200 - humorText.length) < 10 ? "#FF6B6B" : "rgba(255,255,255,0.3)" }}>
                      {200 - humorText.length} chars left
                    </span>
                    <button style={{ ...s.storySubmitBtn, opacity: humorText.trim().length > 0 && humorFirstName.trim() && !humorPosting ? 1 : 0.45 }} onClick={handleSubmitHumor} disabled={humorText.trim().length === 0 || !humorFirstName.trim() || humorPosting}>
                      {humorPosting ? "Submitting…" : "Submit Line"}
                    </button>
                  </div>
                </>
              )}
            </div>

            {myHumor.length > 0 && (
              <div style={s.mySubsSection}>
                <p style={s.mySubsTitle}>Your Submissions</p>
                {myHumor.map((h) => (
                  <div key={h.id} style={s.mySubCard}>
                    <p style={s.mySubText}>"{h.text}"</p>
                    <span style={{ ...s.mySubStatus, background: h.status === "approved" ? "rgba(26,188,156,0.15)" : "rgba(255,255,255,0.06)", color: h.status === "approved" ? "#1ABC9C" : "rgba(255,255,255,0.4)", border: h.status === "approved" ? "1px solid rgba(26,188,156,0.3)" : "1px solid rgba(255,255,255,0.1)" }}>
                      {h.status === "approved" ? "✓ Approved" : "⏳ In Review"}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {topHumor.length > 0 && (
              <div style={s.hallOfFameSection}>
                <div style={s.hallOfFameHeader}>
                  <span style={{ fontSize: "20px" }}>🏆</span>
                  <div>
                    <p style={s.hallOfFameTitle}>Humor Hall of Fame</p>
                    <p style={s.hallOfFameSub}>Top approved lines from the community</p>
                  </div>
                </div>
                {topHumor.map((h, i) => (
                  <div key={h.id} style={s.hallCard}>
                    <span style={{ ...s.hallRank, color: i === 0 ? "#FFD700" : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : "rgba(255,255,255,0.3)" }}>#{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={s.hallCardText}>"{h.text}"</p>
                      <p style={s.hallCardCredit}>Submitted by {h.authorFirstName} from {h.city}</p>
                    </div>
                    {h.votes > 0 && <span style={s.hallVotes}>{h.votes} 💜</span>}
                  </div>
                ))}
              </div>
            )}

            {topHumor.length === 0 && !myHumor.length && (
              <div style={s.emptyState}>
                <p style={{ fontSize: "40px", margin: "0 0 8px" }}>😂</p>
                <p style={s.emptyTitle}>No humor lines yet</p>
                <p style={s.emptySub}>Be the first to make the community laugh!</p>
              </div>
            )}
          </>
        )}

        {/* ══════════════════════ ENCOURAGEMENT TAB ══════════════════════ */}
        {tab === "enc" && (
          <>
            <div style={s.suggestCard}>
              <p style={s.suggestCardTitle}>💜 Suggest an Encouragement</p>
              <p style={s.suggestCardSub}>What uplifting words do you wish someone had said to you? Submit for review — the best ones get added to the app with your credit.</p>
              {encDone ? (
                <div style={s.submittedBox}>
                  <span style={{ fontSize: "28px" }}>💜</span>
                  <p style={s.submittedTitle}>Encouragement submitted!</p>
                  <p style={s.submittedSub}>Your message is pending review. If approved, it'll go live in the Encouragement Hall.</p>
                  <button style={s.submittedRetryBtn} onClick={() => setEncDone(false)}>Submit Another</button>
                </div>
              ) : (
                <>
                  <div style={s.storyNameRow}>
                    <input style={s.storyInput} placeholder="First name *" value={encFirstName} onChange={(e) => setEncFirstName(e.target.value)} maxLength={20} />
                    <input style={s.storyInput} placeholder="City (optional)" value={encCity} onChange={(e) => setEncCity(e.target.value)} maxLength={40} />
                  </div>
                  <textarea
                    style={s.momentTextarea}
                    placeholder="An uplifting message you wish someone had told you during a flash…"
                    value={encText}
                    onChange={(e) => setEncText(e.target.value)}
                    maxLength={210} rows={3}
                  />
                  <div style={s.storyFooter}>
                    <span style={{ ...s.charCount, color: (200 - encText.length) < 10 ? "#FF6B6B" : "rgba(255,255,255,0.3)" }}>
                      {200 - encText.length} chars left
                    </span>
                    <button style={{ ...s.storySubmitBtn, background: "linear-gradient(135deg, #8E44AD, #6C3483)", opacity: encText.trim().length > 0 && encFirstName.trim() && !encPosting ? 1 : 0.45 }} onClick={handleSubmitEnc} disabled={encText.trim().length === 0 || !encFirstName.trim() || encPosting}>
                      {encPosting ? "Submitting…" : "Submit"}
                    </button>
                  </div>
                </>
              )}
            </div>

            {myEnc.length > 0 && (
              <div style={s.mySubsSection}>
                <p style={s.mySubsTitle}>Your Submissions</p>
                {myEnc.map((e) => (
                  <div key={e.id} style={s.mySubCard}>
                    <p style={s.mySubText}>"{e.text}"</p>
                    <span style={{ ...s.mySubStatus, background: e.status === "approved" ? "rgba(26,188,156,0.15)" : "rgba(255,255,255,0.06)", color: e.status === "approved" ? "#1ABC9C" : "rgba(255,255,255,0.4)", border: e.status === "approved" ? "1px solid rgba(26,188,156,0.3)" : "1px solid rgba(255,255,255,0.1)" }}>
                      {e.status === "approved" ? "✓ Approved" : "⏳ In Review"}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {topEnc.length > 0 && (
              <div style={s.hallOfFameSection}>
                <div style={s.hallOfFameHeader}>
                  <span style={{ fontSize: "20px" }}>💜</span>
                  <div>
                    <p style={s.hallOfFameTitle}>Encouragement Hall of Fame</p>
                    <p style={s.hallOfFameSub}>Most loved submissions from the community</p>
                  </div>
                </div>
                {topEnc.map((e, i) => (
                  <div key={e.id} style={s.hallCard}>
                    <span style={{ ...s.hallRank, color: i === 0 ? "#FFD700" : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : "rgba(255,255,255,0.3)" }}>#{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={s.hallCardText}>"{e.text}"</p>
                      <p style={s.hallCardCredit}>Submitted by {e.authorFirstName} from {e.city}</p>
                    </div>
                    {e.votes > 0 && <span style={s.hallVotes}>{e.votes} 💜</span>}
                  </div>
                ))}
              </div>
            )}

            {topEnc.length === 0 && !myEnc.length && (
              <div style={s.emptyState}>
                <p style={{ fontSize: "40px", margin: "0 0 8px" }}>💜</p>
                <p style={s.emptyTitle}>No encouragements yet</p>
                <p style={s.emptySub}>Share the words you wish someone had said to you.</p>
              </div>
            )}
          </>
        )}

        <div style={{ height: "24px" }} />
      </div>

      {/* ── Bottom Nav ── */}
      <div style={s.bottomNav}>
        <button style={s.navBtn} onClick={() => onNavigate("home")}><span>🏠</span><span style={s.navLabel}>Home</span></button>
        <button style={s.navBtn} onClick={() => onNavigate("history")}><span>📋</span><span style={s.navLabel}>History</span></button>
        <button style={{ ...s.navBtn, ...s.navBtnActive }} onClick={() => onNavigate("community")}><span>💬</span><span style={s.navLabel}>Community</span></button>
        <button style={s.navBtn} onClick={() => onNavigate("learn")}><span>📚</span><span style={s.navLabel}>Learn</span></button>
        <button style={s.navBtn} onClick={() => onNavigate("shop")}><span>🛍️</span><span style={s.navLabel}>Shop</span></button>
        <button style={s.navBtn} onClick={() => onNavigate("settings")}><span>⚙️</span><span style={s.navLabel}>Settings</span></button>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  container: { minHeight: "100vh", background: "var(--color-bg)", display: "flex", flexDirection: "column", maxWidth: "480px", margin: "0 auto", fontFamily: "'Inter', sans-serif" },

  // Guidelines modal
  guidelinesBackdrop: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 200 },
  guidelinesSheet: { background: "linear-gradient(180deg, #1C0B2E 0%, #0E0617 100%)", border: "1px solid rgba(142,68,173,0.3)", borderRadius: "24px 24px 0 0", padding: "32px 24px 48px", width: "100%", maxWidth: "480px", display: "flex", flexDirection: "column", gap: "16px", alignItems: "center" },
  guidelinesIconWrap: { width: "72px", height: "72px", borderRadius: "50%", background: "rgba(142,68,173,0.15)", border: "1px solid rgba(142,68,173,0.3)", display: "flex", alignItems: "center", justifyContent: "center" },
  guidelinesTitle: { color: "#fff", fontSize: "22px", fontWeight: 900, margin: 0, fontFamily: "var(--font-heading)" },
  guidelinesSub: { color: "rgba(255,255,255,0.55)", fontSize: "13px", lineHeight: 1.6, textAlign: "center", margin: 0 },
  guidelinesRules: { width: "100%", display: "flex", flexDirection: "column", gap: "10px" },
  guidelineRule: { display: "flex", alignItems: "flex-start", gap: "10px", background: "rgba(255,255,255,0.04)", borderRadius: "10px", padding: "10px 12px" },
  guidelineRuleIcon: { fontSize: "18px", flexShrink: 0, lineHeight: 1.3 },
  guidelineRuleText: { color: "rgba(255,255,255,0.75)", fontSize: "13px", lineHeight: 1.5 },
  guidelinesAckBtn: { width: "100%", border: "none", borderRadius: "14px", background: "linear-gradient(135deg, #8E44AD, #6C3483)", color: "#fff", fontSize: "16px", fontWeight: 800, padding: "16px", cursor: "pointer", boxShadow: "0 4px 20px rgba(142,68,173,0.35)" },

  // Header
  header: { padding: "18px 16px 0", borderBottom: "1px solid rgba(255,255,255,0.1)", flexShrink: 0 },
  headerTop: { textAlign: "center", paddingBottom: "10px" },
  appName: { color: "var(--color-accent)", fontSize: "11px", fontWeight: 900, letterSpacing: "2px", margin: "0 0 2px" },
  headerTitle: { color: "#fff", fontSize: "22px", fontWeight: 800, margin: "0 0 2px" },
  headerSub: { color: "rgba(255,255,255,0.4)", fontSize: "13px", fontWeight: 500, margin: 0 },

  // Inner tab bar
  innerTabBar: { display: "flex", gap: "0", overflowX: "auto", borderTop: "1px solid rgba(255,255,255,0.06)" },
  innerTab: { flex: "1 0 auto", background: "transparent", border: "none", borderBottom: "2px solid transparent", color: "rgba(255,255,255,0.35)", fontSize: "11px", fontWeight: 700, padding: "10px 6px", cursor: "pointer", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" },
  innerTabActive: { color: "var(--color-accent)", borderBottomColor: "var(--color-accent)" },

  // Spotlight banner
  spotlightBanner: { background: "linear-gradient(135deg, rgba(255,215,0,0.07), rgba(142,68,173,0.07))", border: "1px solid rgba(255,215,0,0.25)", borderRadius: "16px", padding: "14px 14px", display: "flex", flexDirection: "column", gap: "10px" },
  spotlightBannerHeader: { display: "flex", alignItems: "center", gap: "10px" },
  spotlightStar: { fontSize: "24px", flexShrink: 0 },
  spotlightBannerTitle: { color: "#FFD700", fontSize: "13px", fontWeight: 900, margin: 0, letterSpacing: "0.3px" },
  spotlightBannerSub: { color: "rgba(255,255,255,0.4)", fontSize: "11px", margin: 0 },
  spotlightDismiss: { marginLeft: "auto", background: "transparent", border: "none", color: "rgba(255,255,255,0.3)", fontSize: "16px", cursor: "pointer", padding: "2px 6px", flexShrink: 0 },
  spotlightItem: { background: "rgba(255,255,255,0.03)", borderRadius: "10px", padding: "10px 12px", display: "flex", flexDirection: "column", gap: "4px" },
  spotlightItemLabel: { color: "rgba(255,215,0,0.7)", fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1px" },
  spotlightItemText: { color: "rgba(255,255,255,0.8)", fontSize: "13px", fontStyle: "italic", lineHeight: 1.5, margin: 0 },
  spotlightItemAuthor: { color: "rgba(255,255,255,0.35)", fontSize: "11px" },

  // Scroll
  scroll: { flex: 1, overflowY: "auto", padding: "12px 12px 0", display: "flex", flexDirection: "column", gap: "10px" },

  // Feed compose
  composeCard: { background: "var(--color-card)", border: "1px solid rgba(142,68,173,0.3)", borderRadius: "18px", padding: "14px" },
  composeInput: { width: "100%", boxSizing: "border-box" as const, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "12px", color: "#fff", fontSize: "14px", fontWeight: 500, fontFamily: "'Inter', sans-serif", padding: "12px 14px", resize: "none" as const, outline: "none", lineHeight: 1.5 },
  composeFooter: { display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "10px", gap: "8px" },
  nameRow: { display: "flex", alignItems: "center", gap: "8px", flex: 1, flexWrap: "wrap" as const },
  togglePill: { width: "38px", height: "22px", borderRadius: "11px", position: "relative" as const, cursor: "pointer", flexShrink: 0, transition: "background 0.2s ease" },
  toggleKnob: { position: "absolute" as const, top: "3px", width: "16px", height: "16px", borderRadius: "50%", background: "#fff", transition: "left 0.2s ease", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" },
  nameToggleLabel: { color: "rgba(255,255,255,0.45)", fontSize: "12px", fontWeight: 600 },
  nameInput: { background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "8px", color: "#fff", fontSize: "13px", fontFamily: "'Inter', sans-serif", padding: "5px 10px", outline: "none", width: "90px" },
  composeRight: { display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 },
  charCount: { fontSize: "11px", fontWeight: 600, minWidth: "28px", textAlign: "right" as const },
  postBtn: { background: "linear-gradient(135deg, #8E44AD 0%, #C39BD3 100%)", border: "none", borderRadius: "100px", color: "#fff", fontSize: "14px", fontWeight: 800, padding: "8px 20px", fontFamily: "'Inter', sans-serif", cursor: "pointer" },
  postError: { color: "#FF6B6B", fontSize: "12px", marginTop: "6px", margin: "6px 0 0" },

  // Empty state
  emptyState: { textAlign: "center", padding: "40px 20px" },
  emptyTitle: { color: "#fff", fontSize: "18px", fontWeight: 800, margin: "0 0 8px" },
  emptySub: { color: "rgba(255,255,255,0.4)", fontSize: "13px", lineHeight: 1.6, margin: 0 },

  // Post card
  postCard: { background: "var(--color-card)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", padding: "14px 14px 12px", display: "flex", flexDirection: "column", gap: "10px" },
  postCardNew: { border: "1px solid rgba(142,68,173,0.5)", boxShadow: "0 0 20px rgba(142,68,173,0.15)" },
  postCardOwn: { border: "1px solid rgba(142,68,173,0.25)" },
  postHeader: { display: "flex", alignItems: "center", gap: "10px" },
  authorBubble: { width: "36px", height: "36px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  authorInitial: { fontSize: "16px", fontWeight: 800, color: "#fff", lineHeight: 1 },
  postMeta: { flex: 1 },
  authorName: { color: "#fff", fontSize: "13px", fontWeight: 700, margin: 0 },
  youBadge: { color: "rgba(195,155,211,0.7)", fontWeight: 500, fontSize: "11px" },
  postTime: { color: "rgba(255,255,255,0.35)", fontSize: "11px", margin: 0 },
  newBadge: { background: "rgba(142,68,173,0.2)", border: "1px solid rgba(142,68,173,0.4)", borderRadius: "100px", padding: "3px 10px", color: "#C39BD3", fontSize: "10px", fontWeight: 700, flexShrink: 0 },
  pendingBadge: { background: "rgba(255,165,0,0.12)", border: "1px solid rgba(255,165,0,0.35)", borderRadius: "100px", padding: "3px 10px", color: "rgba(255,165,0,0.9)", fontSize: "10px", fontWeight: 700, flexShrink: 0, whiteSpace: "nowrap" as const },
  postText: { color: "rgba(255,255,255,0.88)", fontSize: "14px", fontWeight: 500, lineHeight: 1.55, margin: 0 },
  reactionsRow: { display: "flex", gap: "6px", flexWrap: "wrap" as const },
  reactionBtn: { display: "flex", alignItems: "center", gap: "4px", borderRadius: "100px", padding: "6px 10px", cursor: "pointer", fontFamily: "'Inter', sans-serif", fontSize: "11px", fontWeight: 700 },
  reactionEmoji: { fontSize: "13px", lineHeight: 1 },
  reactionCount: { background: "rgba(255,255,255,0.12)", borderRadius: "100px", padding: "1px 6px", fontSize: "10px", fontWeight: 800, color: "rgba(255,255,255,0.7)" },
  feedEnd: { textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: "12px", fontWeight: 600, padding: "8px 0" },

  // Stories
  storyComposeCard: { background: "var(--color-card)", border: "1px solid rgba(52,73,94,0.4)", borderRadius: "18px", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" },
  storyComposeTitle: { color: "#fff", fontSize: "15px", fontWeight: 800, margin: 0 },
  storyComposeSub: { color: "rgba(255,255,255,0.45)", fontSize: "12px", lineHeight: 1.55, margin: 0 },
  storyNameRow: { display: "flex", gap: "8px" },
  storyInput: { flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "10px", color: "#fff", fontSize: "13px", fontFamily: "'Inter', sans-serif", padding: "9px 12px", outline: "none" },
  storyTextarea: { width: "100%", boxSizing: "border-box" as const, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "12px", color: "#fff", fontSize: "14px", fontFamily: "'Inter', sans-serif", padding: "12px 14px", resize: "none" as const, outline: "none", lineHeight: 1.55 },
  storyFooter: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  storySubmitBtn: { background: "linear-gradient(135deg, #C0392B, #FF4500)", border: "none", borderRadius: "100px", color: "#fff", fontSize: "13px", fontWeight: 800, padding: "10px 20px", cursor: "pointer", fontFamily: "'Inter', sans-serif" },
  featuredHeader: { display: "flex", flexDirection: "column", gap: "2px", padding: "4px 2px" },
  featuredLabel: { color: "#fff", fontSize: "14px", fontWeight: 800 },
  featuredSub: { color: "rgba(255,255,255,0.35)", fontSize: "11px" },
  storyCard: { background: "var(--color-card)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" },
  storyCardHeader: { display: "flex", alignItems: "center", gap: "10px" },
  storyCardText: { color: "rgba(255,255,255,0.82)", fontSize: "14px", lineHeight: 1.65, margin: 0 },
  resonatesBtn: { display: "flex", alignItems: "center", gap: "6px", borderRadius: "100px", padding: "8px 14px", cursor: "pointer", fontFamily: "'Inter', sans-serif", fontSize: "12px", fontWeight: 700, alignSelf: "flex-start" },
  submittedBox: { display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", padding: "16px 0" },
  submittedTitle: { color: "#fff", fontSize: "16px", fontWeight: 800, margin: 0 },
  submittedSub: { color: "rgba(255,255,255,0.45)", fontSize: "12px", margin: 0 },
  submittedRetryBtn: { background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "100px", color: "rgba(255,255,255,0.6)", fontSize: "12px", fontWeight: 700, padding: "8px 18px", cursor: "pointer", fontFamily: "'Inter', sans-serif" },

  // Hot Moments
  momentsHeader: { padding: "4px 2px" },
  momentsTitle: { color: "#fff", fontSize: "16px", fontWeight: 800, margin: "0 0 4px" },
  momentsSub: { color: "rgba(255,255,255,0.45)", fontSize: "12px", lineHeight: 1.55, margin: 0 },
  momentComposeCard: { background: "var(--color-card)", border: "1px solid rgba(255,107,53,0.25)", borderRadius: "18px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" },
  momentTextarea: { width: "100%", boxSizing: "border-box" as const, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "12px", color: "#fff", fontSize: "14px", fontFamily: "'Inter', sans-serif", padding: "12px 14px", resize: "none" as const, outline: "none", lineHeight: 1.5 },
  momentComposeFooter: { display: "flex", alignItems: "center", gap: "8px" },
  momentNameInput: { flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "10px", color: "#fff", fontSize: "13px", fontFamily: "'Inter', sans-serif", padding: "8px 12px", outline: "none" },
  momentPostBtn: { background: "linear-gradient(135deg, #FF4500, #C0392B)", border: "none", borderRadius: "100px", color: "#fff", fontSize: "13px", fontWeight: 800, padding: "9px 18px", cursor: "pointer", fontFamily: "'Inter', sans-serif", flexShrink: 0 },
  momentsSortBadge: { background: "rgba(255,107,53,0.08)", border: "1px solid rgba(255,107,53,0.2)", borderRadius: "100px", color: "rgba(255,107,53,0.7)", fontSize: "10px", fontWeight: 700, padding: "5px 12px", textAlign: "center" },
  momentCard: { background: "var(--color-card)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", padding: "14px 14px 12px", display: "flex", flexDirection: "column", gap: "10px" },
  momentTotalBadge: { background: "rgba(255,107,53,0.1)", border: "1px solid rgba(255,107,53,0.2)", borderRadius: "100px", padding: "3px 10px", flexShrink: 0 },

  // Suggest
  suggestSubTabs: { display: "flex", gap: "8px" },
  suggestSubTab: { flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", color: "rgba(255,255,255,0.4)", fontSize: "13px", fontWeight: 700, padding: "10px 8px", cursor: "pointer", fontFamily: "'Inter', sans-serif" },
  suggestSubTabActive: { background: "rgba(142,68,173,0.15)", border: "1px solid rgba(142,68,173,0.4)", color: "#C39BD3" },
  suggestCard: { background: "var(--color-card)", border: "1px solid rgba(142,68,173,0.2)", borderRadius: "18px", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" },
  suggestCardTitle: { color: "#fff", fontSize: "15px", fontWeight: 800, margin: 0 },
  suggestCardSub: { color: "rgba(255,255,255,0.45)", fontSize: "12px", lineHeight: 1.55, margin: 0 },
  mySubsSection: { display: "flex", flexDirection: "column", gap: "6px" },
  mySubsTitle: { color: "rgba(255,255,255,0.45)", fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1.5px" },
  mySubCard: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", padding: "10px 12px", display: "flex", alignItems: "flex-start", gap: "10px" },
  mySubText: { flex: 1, color: "rgba(255,255,255,0.7)", fontSize: "13px", lineHeight: 1.5, margin: 0, fontStyle: "italic" },
  mySubStatus: { borderRadius: "100px", padding: "3px 10px", fontSize: "10px", fontWeight: 800, flexShrink: 0 },
  hallOfFameSection: { display: "flex", flexDirection: "column", gap: "8px" },
  hallOfFameHeader: { display: "flex", alignItems: "center", gap: "10px", padding: "4px 2px" },
  hallOfFameTitle: { color: "#fff", fontSize: "14px", fontWeight: 800, margin: 0 },
  hallOfFameSub: { color: "rgba(255,255,255,0.35)", fontSize: "11px", margin: 0 },
  hallCard: { background: "var(--color-card)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "12px", padding: "12px 14px", display: "flex", alignItems: "flex-start", gap: "10px" },
  hallRank: { fontSize: "13px", fontWeight: 900, flexShrink: 0, marginTop: "1px" },
  hallCardText: { color: "rgba(255,255,255,0.82)", fontSize: "13px", lineHeight: 1.5, margin: "0 0 3px", fontStyle: "italic" },
  hallCardCredit: { color: "rgba(255,255,255,0.35)", fontSize: "11px", margin: 0 },
  hallVotes: { color: "rgba(142,68,173,0.7)", fontSize: "11px", fontWeight: 800, flexShrink: 0 },

  // Bottom nav
  bottomNav: { display: "flex", borderTop: "1px solid rgba(255,255,255,0.1)", background: "var(--color-bg)", padding: "10px 0 18px", flexShrink: 0 },
  navBtn: { flex: 1, background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", cursor: "pointer", fontSize: "20px", padding: "4px 0" },
  navBtnActive: { color: "var(--color-accent)" },
  navLabel: { fontSize: "10px", fontWeight: 600 },
};
