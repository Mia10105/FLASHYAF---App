// FLASHYAF™ — complete account deletion and optional 90-day pause.

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

const db = admin.firestore();
const storage = admin.storage();
const PAUSE_DAYS = 90;

const USER_SUBCOLLECTIONS = [
  "flashes",
  "checkins",
  "checkinLog",
  "journalEntries",
  "timeCapsules",
];

const TOP_LEVEL_BY_UID = [
  { name: "community", field: "userId" },
  { name: "feedback", field: "userId" },
  { name: "user_feedback", field: "userId" },
  { name: "partnerMessages", field: "userId" },
  { name: "newsletter", field: "userId" },
  { name: "ambassadorNewsletter", field: "userId" },
  { name: "stories", field: "userId" },
  { name: "hotMoments", field: "userId" },
  { name: "humorSubmissions", field: "userId" },
  { name: "encouragementSubmissions", field: "userId" },
  { name: "affiliates", field: "userId" },
  { name: "referralCredits", field: "referrerUid" },
];

const TOP_LEVEL_BY_EMAIL = [
  { name: "betaApplications", field: "email" },
  { name: "betaApplicationTokens", field: "email" },
  { name: "waitlist", field: "email" },
];

async function deleteQueryInBatches(query) {
  while (true) {
    const snap = await query.limit(400).get();
    if (snap.empty) return;
    const batch = db.batch();
    snap.docs.forEach((document) => batch.delete(document.ref));
    await batch.commit();
    if (snap.size < 400) return;
  }
}

async function deleteAllUserData(uid, email) {
  const results = { deleted: [], failed: [] };

  async function attempt(label, operation) {
    try {
      await operation();
      results.deleted.push(label);
    } catch (error) {
      console.error(`Account deletion failed for ${label}:`, error);
      results.failed.push(label);
    }
  }

  for (const subcollection of USER_SUBCOLLECTIONS) {
    await attempt(`users/${uid}/${subcollection}`, () =>
      deleteQueryInBatches(
        db.collection("users").doc(uid).collection(subcollection),
      ),
    );
  }

  for (const { name, field } of TOP_LEVEL_BY_UID) {
    await attempt(name, () =>
      deleteQueryInBatches(db.collection(name).where(field, "==", uid)),
    );
  }

  if (email) {
    for (const { name, field } of TOP_LEVEL_BY_EMAIL) {
      await attempt(name, () =>
        deleteQueryInBatches(db.collection(name).where(field, "==", email)),
      );
    }
  }

  await attempt("profiles", () =>
    deleteQueryInBatches(db.collection("profiles").where("uid", "==", uid)),
  );
  await attempt("usernames", () =>
    deleteQueryInBatches(db.collection("usernames").where("uid", "==", uid)),
  );
  await attempt(`shopViews/${uid}`, () =>
    db.collection("shopViews").doc(uid).delete(),
  );
  await attempt(`Storage: flashAudio/${uid}/`, () =>
    storage.bucket().deleteFiles({ prefix: `flashAudio/${uid}/` }),
  );

  // Keep the profile and Auth account available for a retry when any earlier
  // deletion failed. Deleting the login first would strand undeleted records.
  if (results.failed.length) return results;

  await attempt(`users/${uid}`, () => db.collection("users").doc(uid).delete());
  if (results.failed.length) return results;

  await attempt("Auth account", () => admin.auth().deleteUser(uid));
  return results;
}

async function getAccountEmail(uid, authTokenEmail) {
  if (authTokenEmail) return String(authTokenEmail).trim().toLowerCase();
  try {
    const record = await admin.auth().getUser(uid);
    return record.email ? record.email.trim().toLowerCase() : "";
  } catch {
    return "";
  }
}

exports.requestAccountDeletion = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in to delete your account.");
  }

  const uid = request.auth.uid;
  const mode = request.data?.mode;
  if (mode !== "immediate" && mode !== "pause") {
    throw new HttpsError("invalid-argument", "Choose immediate deletion or a 90-day pause.");
  }

  if (mode === "pause") {
    const requestedAt = admin.firestore.Timestamp.now();
    await db.collection("users").doc(uid).set(
      {
        deletionRequested: true,
        deletionRequestedAt: requestedAt,
        deletionMode: "pause",
      },
      { merge: true },
    );
    return {
      mode: "pause",
      completed: false,
      pendingDeletionAt: requestedAt.toDate().toISOString(),
    };
  }

  const email = await getAccountEmail(uid, request.auth.token.email);
  const results = await deleteAllUserData(uid, email);
  if (results.failed.length) {
    throw new HttpsError(
      "internal",
      "Some account data could not be deleted. Your account remains available so deletion can be retried.",
      { failed: results.failed },
    );
  }

  return { mode: "immediate", completed: true, ...results };
});

exports.cancelPendingDeletion = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  await db.collection("users").doc(request.auth.uid).set(
    {
      deletionRequested: false,
      deletionRequestedAt: admin.firestore.FieldValue.delete(),
      deletionMode: admin.firestore.FieldValue.delete(),
    },
    { merge: true },
  );
  return { cancelled: true };
});

exports.processPendingDeletions = onSchedule("every 24 hours", async () => {
  const cutoff = admin.firestore.Timestamp.fromMillis(
    Date.now() - PAUSE_DAYS * 24 * 60 * 60 * 1000,
  );

  // Query only on the timestamp so this does not require a new composite
  // index; verify the deletion flag in memory before acting.
  const snap = await db
    .collection("users")
    .where("deletionRequestedAt", "<=", cutoff)
    .get();

  for (const profile of snap.docs) {
    if (profile.data().deletionRequested !== true) continue;

    const uid = profile.id;
    const email = await getAccountEmail(uid, profile.data().email);
    const results = await deleteAllUserData(uid, email);
    if (results.failed.length) {
      console.error("Pending account deletion remains incomplete:", {
        uid,
        failed: results.failed,
      });
    }
  }
});
