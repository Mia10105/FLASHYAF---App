import type { Flash, Stage, StageEntry } from "@/types/flash";

const DAY_MS = 86_400_000;
const NOW = Date.now();

type FlashConfig = [number, number, number, string?];

const DAY_CONFIGS: FlashConfig[][] = [
  [[7, 240, 4], [11, 180, 3], [15, 300, 4], [21, 360, 5, "Really bad one tonight"]],
  [[8, 210, 3], [14, 270, 4], [20, 195, 3]],
  [[7, 300, 4], [10, 180, 2], [15, 240, 3], [22, 420, 5, "Woke me up again"]],
  [[9, 225, 3], [13, 300, 4], [18, 180, 2]],
  [[7, 195, 2], [11, 270, 3], [16, 300, 4], [20, 360, 4]],
  [[8, 240, 3], [12, 210, 3], [17, 180, 2], [21, 300, 4], [23, 240, 3, "Three in a row this week"]],
  [[6, 300, 4], [10, 240, 3], [15, 210, 2]],
  [[8, 360, 5, "Worst one in days"], [14, 180, 2], [20, 270, 3]],
  [[7, 210, 3], [11, 300, 4], [16, 240, 3], [22, 180, 2]],
  [[9, 195, 2], [13, 270, 3], [19, 300, 4]],
  [[7, 240, 3], [10, 210, 2], [15, 300, 4], [21, 360, 5]],
  [[8, 180, 2], [12, 240, 3], [18, 210, 3]],
  [[7, 300, 4], [11, 270, 3], [16, 180, 2], [20, 240, 3, "Feeling more hopeful — tracking is helping"]],
  [[9, 210, 3], [14, 300, 4], [21, 180, 2]],
  [[7, 240, 3], [10, 195, 2], [15, 270, 3]],
  [[8, 300, 4], [12, 240, 3], [17, 210, 3], [22, 360, 4]],
  [[7, 180, 2], [11, 210, 2], [16, 300, 4]],
  [[9, 240, 3], [13, 270, 3], [19, 180, 2], [23, 300, 4, "Late night again"]],
  [[7, 300, 4], [10, 210, 3], [15, 240, 3]],
  [[8, 180, 2], [12, 300, 4], [18, 270, 3]],
  [[7, 240, 3], [11, 195, 2], [16, 300, 4], [21, 210, 3]],
  [[9, 270, 3], [14, 240, 3], [20, 180, 2]],
  [[7, 300, 4], [10, 210, 2], [15, 360, 5, "Worst this week"], [22, 240, 3]],
  [[8, 195, 2], [12, 270, 3], [17, 240, 3]],
  [[7, 240, 3], [11, 300, 4], [16, 210, 2], [20, 270, 3]],
  [[9, 180, 2], [13, 240, 3], [19, 300, 4]],
  [[7, 270, 3], [10, 210, 2], [15, 180, 2]],
  [[8, 300, 4], [12, 240, 3], [17, 270, 3], [21, 300, 4]],
  [[7, 195, 2], [11, 270, 3], [16, 240, 3]],
  [[8, 240, 3], [14, 300, 4], [19, 180, 2, "Less intense today — breathing exercises are working!"]],
];

function buildStages(startTime: number, durationSec: number): StageEntry[] {
  const dur = durationSec * 1000;
  return [
    { stage: "STARTED" as Stage, timestamp: startTime },
    { stage: "PEAK" as Stage, timestamp: startTime + Math.round(dur * 0.3) },
    { stage: "COOLING_DOWN" as Stage, timestamp: startTime + Math.round(dur * 0.65) },
    { stage: "BACK_TO_NORMAL" as Stage, timestamp: startTime + dur },
  ];
}

export const DEMO_FLASHES: Flash[] = DAY_CONFIGS.flatMap((dayFlashes, dayIndex) => {
  const dayOffset = (29 - dayIndex) * DAY_MS;
  const dayBase = NOW - dayOffset;
  return dayFlashes.map(([hour, durationSec, peakRating, notes], flashIndex) => {
    const d = new Date(dayBase);
    d.setHours(hour, (flashIndex * 17) % 60, 0, 0);
    const startTime = d.getTime();
    const endTime = startTime + durationSec * 1000;
    return {
      id: `demo-${dayIndex}-${flashIndex}`,
      userId: "demo-user",
      startTime,
      endTime,
      durationSeconds: durationSec,
      stages: buildStages(startTime, durationSec),
      peakRating,
      ...(notes ? { notes } : {}),
    } as Flash;
  });
}).sort((a, b) => b.startTime - a.startTime);

export const DEMO_BADGE_IDS = [
  "first_flash", "streak_7", "flashes_10", "flashes_25",
  "flashes_50", "flashes_100", "perfect_breath", "shared_friend",
];

export const DEMO_USER_NAME = "Maya";

export interface DemoCommunityPost {
  id: string;
  text: string;
  authorName: string;
  userId: string;
  timestamp: number;
  reactions: { youGotThis: number; same: number; sendingCoolVibes: number };
  userReactions?: Record<string, string>;
}

export const DEMO_COMMUNITY_POSTS: DemoCommunityPost[] = [
  {
    id: "demo-post-1",
    text: "Day 30 of tracking and I finally feel like I have some control back. Knowing my peak times changed everything. 🧠",
    authorName: "Maya C.",
    userId: "demo-user-1",
    timestamp: Date.now() - 3 * 60 * 1000,
    reactions: { youGotThis: 12, same: 8, sendingCoolVibes: 5 },
  },
  {
    id: "demo-post-2",
    text: "Anyone else get the worst flashes right before bed? I've started keeping a small fan on my nightstand and it honestly helps so much.",
    authorName: "Sandra T.",
    userId: "demo-user-2",
    timestamp: Date.now() - 45 * 60 * 1000,
    reactions: { youGotThis: 7, same: 14, sendingCoolVibes: 3 },
  },
  {
    id: "demo-post-3",
    text: "Three weeks in and my doctor actually asked to see my data. She said it was the most useful thing a patient had ever brought in. 😭",
    authorName: "Diane R.",
    userId: "demo-user-3",
    timestamp: Date.now() - 2 * 3600 * 1000,
    reactions: { youGotThis: 23, same: 4, sendingCoolVibes: 11 },
  },
  {
    id: "demo-post-4",
    text: "The breathing tip in the app actually works?? I did 4-4-6 breathing during my flash this morning and it felt so much shorter. WOW.",
    authorName: "Patricia K.",
    userId: "demo-user-4",
    timestamp: Date.now() - 5 * 3600 * 1000,
    reactions: { youGotThis: 18, same: 6, sendingCoolVibes: 9 },
  },
  {
    id: "demo-post-5",
    text: "Just earned my '100 Flashes' badge. Why am I both proud and devastated by this achievement 😂 But seriously — this app has been a lifeline.",
    authorName: "Jo M.",
    userId: "demo-user-5",
    timestamp: Date.now() - 8 * 3600 * 1000,
    reactions: { youGotThis: 31, same: 19, sendingCoolVibes: 7 },
  },
];
