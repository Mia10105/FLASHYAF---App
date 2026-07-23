// Redeploy marker v3: 2026-07-15, package-lock.json regenerated with npm 10 to match the Node 20 build image (no logic changes).
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

const TIME_BLOCKS = [
  { label: "Early Morning", hours: [5, 6, 7, 8] },
  { label: "Morning", hours: [9, 10, 11] },
  { label: "Afternoon", hours: [12, 13, 14, 15, 16] },
  { label: "Evening", hours: [17, 18, 19, 20] },
  { label: "Night", hours: [21, 22, 23, 0, 1, 2, 3, 4] },
];

const BODY_AREA_LABELS = {
  face: "Face",
  chest: "Chest",
  neck: "Neck",
  back: "Back",
  arms: "Arms",
  legs: "Legs",
  abdomen: "Abdomen",
  hands: "Hands",
};

// ── The one place in the whole app allowed to read every user's raw flash
// records — because it runs with trusted Admin privileges on our own server,
// not on a user's device. It NEVER returns raw records to anyone; it only
// ever writes finished, de-identified totals to publicStats/aggregates. ──
async function computeResearchAggregates() {
  const flashesGroup = db.collectionGroup("flashes");

  const [countSnap, sampleSnap, usersCountSnap] = await Promise.all([
    flashesGroup.count().get(),
    flashesGroup.orderBy("startTime", "desc").limit(1000).get(),
    db.collectionGroup("users").count().get(),
  ]);

  const total = countSnap.data().count;
  const docs = sampleSnap.docs.map((d) => d.data());

  const withDur = docs.filter((d) => d.durationSeconds > 0);
  const avgSec = withDur.length
    ? withDur.reduce((s, d) => s + d.durationSeconds, 0) / withDur.length
    : 0;

  const hourCounts = {};
  docs.forEach((d) => {
    if (d.startTime) {
      const h = new Date(d.startTime).getHours();
      hourCounts[h] = (hourCounts[h] || 0) + 1;
    }
  });
  const blockCounts = TIME_BLOCKS.map((b) => ({
    label: b.label,
    count: b.hours.reduce((s, h) => s + (hourCounts[h] || 0), 0),
  }));
  const peakBlock = blockCounts.reduce(
    (a, b) => (b.count > a.count ? b : a),
    blockCounts[0],
  );

  const withRating = docs.filter((d) => d.peakRating > 0);
  const avgIntensity = withRating.length
    ? withRating.reduce((s, d) => s + d.peakRating, 0) / withRating.length
    : 0;

  const areaCount = {};
  docs.forEach((d) => {
    if (Array.isArray(d.bodyAreas)) {
      d.bodyAreas.forEach((a) => {
        areaCount[a] = (areaCount[a] || 0) + 1;
      });
    }
  });
  const totalArea = Object.values(areaCount).reduce((s, n) => s + n, 0) || 1;
  const topBodyAreas = Object.entries(areaCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k, v]) => ({
      label: BODY_AREA_LABELS[k] || k,
      pct: Math.round((v / totalArea) * 100),
    }));

  const timestamps = docs.map((d) => d.startTime).filter(Boolean);
  const minTs = timestamps.length ? Math.min(...timestamps) : Date.now();
  const maxTs = timestamps.length ? Math.max(...timestamps) : Date.now();
  const daysOfData = Math.max(1, Math.round((maxTs - minTs) / (86400 * 1000)));

  const fresh = {
    totalFlashes: total,
    avgDurationMin: Math.floor(avgSec / 60),
    avgDurationSec: Math.round(avgSec % 60),
    peakTimeBlock: peakBlock?.label || "Evening",
    avgIntensity: Math.round(avgIntensity * 10) / 10,
    topBodyAreas,
    daysOfData,
    totalUsers: usersCountSnap.data().count,
    updatedAt: Date.now(),
  };

  await db.doc("publicStats/aggregates").set(fresh);
  return fresh;
}

// Runs automatically every 6 hours — no one has to remember to trigger it.
exports.refreshResearchStatsScheduled = onSchedule(
  "every 6 hours",
  async () => {
    await computeResearchAggregates();
  },
);

// Optional on-demand refresh, callable from the app by any signed-in user.
// Still never returns raw records — only the same aggregate object that
// gets cached for everyone.
exports.refreshResearchStats = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "You must be signed in to refresh research stats.",
    );
  }
  return computeResearchAggregates();
});
