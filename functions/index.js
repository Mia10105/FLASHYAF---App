// Redeploy marker v3: 2026-07-15, package-lock.json regenerated with npm 10 to match the Node 20 build image (no logic changes).
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// Beta application token generation + email — see generateBetaToken.js
// for the full flow (fired when someone confirms their email after
// filling out the Pioneer Beta interest form).
exports.generateBetaToken = require("./generateBetaToken").generateBetaToken;

// Account deletion — real recursive delete, plus the 90-day pause design
// (see deleteAccount.js). Replaces incomplete client-side deletion (H4).
const deleteAccountFns = require("./deleteAccount");
exports.requestAccountDeletion = deleteAccountFns.requestAccountDeletion;
exports.cancelPendingDeletion = deleteAccountFns.cancelPendingDeletion;
exports.processPendingDeletions = deleteAccountFns.processPendingDeletions;

// Beta application submission — atomic server-side token validation,
// replacing the bypassable client-side-only gate (H6 + H7).
exports.submitBetaApplication = require("./submitBetaApplication").submitBetaApplication;

// JOIN10 referral crediting — NOT fully finished yet (see referralCredit.js
// header). Records pending credits and reverses on refund, but the actual
// $2/mo balance credit still needs one more piece built once we've talked
// through how it should apply against your Stripe setup. Safe to deploy
// as-is; it just won't do anything until the Stripe-side webhook + coupon
// setup described in that file is in place.
exports.stripeReferralWebhook = require("./referralCredit").stripeReferralWebhook;


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

// Minimum number of consenting participants before we publish real
// aggregate numbers at all. Below this, even "anonymous" averages can
// effectively reveal one specific person's data — especially relevant
// during a small Pioneer Beta cohort (audit finding H5).
const MIN_PARTICIPANTS_TO_PUBLISH = 5;

// ── The one place in the whole app allowed to read every user's raw flash
// records — because it runs with trusted Admin privileges on our own server,
// not on a user's device. It NEVER returns raw records to anyone; it only
// ever writes finished, de-identified totals to publicStats/aggregates. ──
async function computeResearchAggregates() {
  // SECURITY FIX (H5): only include flash records belonging to users who
  // have explicitly opted into research. Previously this had no consent
  // check at all — it read every user's data unconditionally.
  //
  // NOTE: there's currently no Settings toggle in the app for a person to
  // actually set researchConsent — that UI still needs to be built. Until
  // it exists, this will correctly publish nothing (or a suppressed
  // placeholder) rather than silently including everyone by default.
  const consentingUsersSnap = await db
    .collection("users")
    .where("researchConsent", "==", true)
    .get();
  const consentingUids = new Set(consentingUsersSnap.docs.map((d) => d.id));

  if (consentingUids.size < MIN_PARTICIPANTS_TO_PUBLISH) {
    const suppressed = {
      suppressed: true,
      reason: "Not enough consenting participants yet to publish aggregate stats.",
      participantCount: consentingUids.size,
      updatedAt: Date.now(),
    };
    await db.doc("publicStats/aggregates").set(suppressed);
    return suppressed;
  }

  const flashesGroup = db.collectionGroup("flashes");

  // Pull a sample and filter it down to consenting users only. (A
  // collectionGroup query can't easily filter by a field that lives on a
  // different collection, so we filter the in-memory sample using each
  // flash doc's own `userId` field instead of pushing this into Firestore
  // query syntax.)
  const sampleSnap = await flashesGroup.orderBy("startTime", "desc").limit(2000).get();
  const docs = sampleSnap.docs
    .map((d) => d.data())
    .filter((d) => d.userId && consentingUids.has(d.userId));

  const participantUids = new Set(docs.map((d) => d.userId));
  if (participantUids.size < MIN_PARTICIPANTS_TO_PUBLISH) {
    const suppressed = {
      suppressed: true,
      reason: "Not enough consenting participants with flash data yet to publish aggregate stats.",
      participantCount: participantUids.size,
      updatedAt: Date.now(),
    };
    await db.doc("publicStats/aggregates").set(suppressed);
    return suppressed;
  }

  const total = docs.length;

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
    totalUsers: participantUids.size,
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

// Optional on-demand refresh — admin-only. Previously any signed-in user
// could call this and trigger the expensive aggregate query (audit
// finding M2); the scheduled function above already runs it every 6
// hours automatically, so there's no need for it to be open to everyone.
exports.refreshResearchStats = onCall(async (request) => {
  if (
    !request.auth
    || request.auth.token.email !== "iva@brownworks4u2.com"
    || request.auth.token.email_verified !== true
  ) {
    throw new HttpsError(
      "permission-denied",
      "Only an admin can manually trigger a stats refresh.",
    );
  }
  return computeResearchAggregates();
});
