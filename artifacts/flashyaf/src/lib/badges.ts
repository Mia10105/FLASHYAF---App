import type { Flash } from "@/types/flash";

export interface BadgeDef {
  id: string;
  icon: string;
  name: string;
  desc: string;
}

export const ALL_BADGES: BadgeDef[] = [
  {
    id: "beta_founder",
    icon: "🌟",
    name: "Beta Founder",
    desc: "Joined during the founding beta period — your feedback shapes FLASHYAF™",
  },
  {
    id: "first_flash",
    icon: "🔥",
    name: "First Flash",
    desc: "Logged your very first hot flash",
  },
  {
    id: "streak_7",
    icon: "📅",
    name: "7 Day Streak",
    desc: "Tracked flashes on 7 consecutive days",
  },
  {
    id: "flashes_10",
    icon: "🌟",
    name: "10 Flashes",
    desc: "Logged 10 hot flashes total",
  },
  {
    id: "flashes_25",
    icon: "💪",
    name: "25 Flashes",
    desc: "Logged 25 hot flashes total",
  },
  {
    id: "flashes_50",
    icon: "🏆",
    name: "50 Flashes",
    desc: "Logged 50 hot flashes total",
  },
  {
    id: "flashes_100",
    icon: "👑",
    name: "100 Flashes",
    desc: "Logged 100 hot flashes total",
  },
  {
    id: "perfect_breath",
    icon: "🌬️",
    name: "Perfect Breath",
    desc: "Completed a full flash cycle through all 4 stages",
  },
  {
    id: "shared_friend",
    icon: "💌",
    name: "Shared with a Friend",
    desc: "Sent a flash update to your support person",
  },
  {
    id: "referral_1",
    icon: "📣",
    name: "Beta Referrer",
    desc: "Referred your first friend to FLASHYAF™",
  },
  {
    id: "referral_5",
    icon: "⭐",
    name: "FLASHYAF VIP",
    desc: "Referred 5 friends — VIP access unlocked when Premium launches",
  },
  {
    id: "referral_10",
    icon: "🥇",
    name: "Founding Ambassador",
    desc: "Referred 10 friends — you are a FLASHYAF™ Founding Ambassador",
  },
];

function bestStreak(flashes: Flash[]): number {
  const daySet = new Set<string>();
  for (const f of flashes) {
    const d = new Date(f.startTime);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    daySet.add(key);
  }
  const sorted = Array.from(daySet).sort(); // lexicographic = chronological for YYYY-MM-DD
  if (sorted.length === 0) return 0;
  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86_400_000);
    if (diffDays === 1) {
      run++;
      if (run > best) best = run;
    } else {
      run = 1;
    }
  }
  return best;
}

const BETA_FOUNDER_CUTOFF = new Date("2027-01-01").getTime();

export function computeEarnedBadgeIds(
  flashes: Flash[],
  partnerMode: boolean,
  isBetaTester: boolean = Date.now() < BETA_FOUNDER_CUTOFF,
  referralCount: number = 0
): string[] {
  const earned: string[] = [];
  const total = flashes.length;

  if (isBetaTester) earned.push("beta_founder");

  if (total >= 1) earned.push("first_flash");
  if (total >= 10) earned.push("flashes_10");
  if (total >= 25) earned.push("flashes_25");
  if (total >= 50) earned.push("flashes_50");
  if (total >= 100) earned.push("flashes_100");

  if (bestStreak(flashes) >= 7) earned.push("streak_7");

  const hasFullCycle = flashes.some((f) =>
    f.stages.some((s) => s.stage === "BACK_TO_NORMAL")
  );
  if (hasFullCycle) earned.push("perfect_breath");

  if (partnerMode) earned.push("shared_friend");

  if (referralCount >= 1) earned.push("referral_1");
  if (referralCount >= 5) earned.push("referral_5");
  if (referralCount >= 10) earned.push("referral_10");

  return earned;
}
