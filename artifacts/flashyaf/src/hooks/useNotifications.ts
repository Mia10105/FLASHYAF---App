import { useEffect } from "react";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { User } from "firebase/auth";

// localStorage keys
const KEY_ASKED = "flashyaf_notif_asked";
const KEY_24H   = "flashyaf_notif_24h";
const KEY_8PM   = "flashyaf_notif_8pm";

function canNotify() {
  return "Notification" in window && Notification.permission === "granted";
}

function notify(title: string, body: string, tag: string) {
  if (!canNotify()) return;
  try { new Notification(title, { body, icon: "/favicon.ico", tag }); } catch {}
}

function todayStr() {
  return new Date().toDateString();
}

function msUntil8pm() {
  const now = new Date();
  const target = new Date();
  target.setHours(20, 0, 0, 0);
  if (now >= target) target.setDate(target.getDate() + 1);
  return target.getTime() - now.getTime();
}

// Called from App.tsx after permission is granted
export function markNotifAsked() {
  localStorage.setItem(KEY_ASKED, "1");
}

export function notifAlreadyAsked() {
  return localStorage.getItem(KEY_ASKED) === "1";
}

export function useNotifications(user: User | null) {

  // ── 1. 24-hour no-flash reminder ─────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    async function schedule() {
      if (!canNotify()) return;
      if (localStorage.getItem(KEY_24H) === todayStr()) return;

      try {
        const snap = await getDocs(
          query(
            collection(db, "users", user!.uid, "flashes"),
            orderBy("startTime", "desc"),
            limit(1)
          )
        );
        if (cancelled) return;

        function doNotify() {
          if (localStorage.getItem(KEY_24H) === todayStr()) return;
          localStorage.setItem(KEY_24H, todayStr());
          notify(
            "Hey! How are you feeling today? 🧠",
            "FLASHYAF is here when you need it.",
            "no-flash-24h"
          );
        }

        if (snap.empty) {
          doNotify();
        } else {
          const lastTime = snap.docs[0].data().startTime as number;
          const sinceMs = Date.now() - lastTime;
          const THRESHOLD = 24 * 60 * 60 * 1000;
          if (sinceMs >= THRESHOLD) {
            doNotify();
          } else {
            const t = setTimeout(doNotify, THRESHOLD - sinceMs);
            timers.push(t);
          }
        }
      } catch {}
    }

    schedule();
    return () => { cancelled = true; timers.forEach(clearTimeout); };
  }, [user]);

  // ── 2. 45-minute unfinished flash reminder ────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const stored = localStorage.getItem("activeFlash");
    if (!stored) return;

    const startTime = parseInt(stored, 10);
    const THRESHOLD = 45 * 60 * 1000;
    const elapsed = Date.now() - startTime;

    function doNotify() {
      // Only fire if the flash is still active
      if (!localStorage.getItem("activeFlash")) return;
      notify(
        "Did your flash end?",
        "Tap to open FLASHYAF and log Flash Ended.",
        "unfinished-flash"
      );
    }

    if (elapsed >= THRESHOLD) {
      doNotify();
      return;
    }

    const t = setTimeout(doNotify, THRESHOLD - elapsed);
    return () => clearTimeout(t);
  }, [user]);

  // ── 3. Daily 8pm check-in ─────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const delay = msUntil8pm();

    const t = setTimeout(() => {
      if (localStorage.getItem(KEY_8PM) === todayStr()) return;
      localStorage.setItem(KEY_8PM, todayStr());
      notify(
        "End of day check-in 📊",
        "How was today? Open FLASHYAF to review your stats.",
        "daily-checkin"
      );
    }, delay);

    return () => clearTimeout(t);
  }, [user]);
}
