// FLASHYAF™ — Cloud Function: secure Pioneer Beta application submission
//
// Validates the single-use token and the complete application server-side,
// then creates the application and burns the token in one transaction.

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

const db = admin.firestore();

const ALLOWED_FIELDS = new Set([
  "name",
  "email",
  "ageRange",
  "stage",
  "flashFrequency",
  "disruptiveness",
  "priorLogging",
  "phoneType",
  "wearable",
  "howHeard",
  "whyJoin",
  "fallbackPreferences",
  "pledgeAgreed",
]);

const ENUMS = {
  ageRange: new Set(["18-39", "40-44", "45-49", "50-54", "55-59", "60+"]),
  stage: new Set([
    "Perimenopause",
    "Menopause",
    "Post-menopause",
    "Surgical or medically-induced",
    "Not sure",
  ]),
  flashFrequency: new Set([
    "Rarely",
    "Sometimes",
    "Often",
    "Very often",
    "I don't have them yet",
    "I stopped having them",
  ]),
  disruptiveness: new Set(["Mildly", "Moderately", "Severely", "Highly variable"]),
  priorLogging: new Set(["Yes, app", "Yes, journal", "No", "No, but I wish I had"]),
  phoneType: new Set(["iPhone", "Android", "Both"]),
  wearable: new Set(["Yes", "No"]),
};

const FALLBACK_OPTIONS = new Set(["Replacement Pool", "Launch Waitlist", "No thanks"]);
const TOKEN_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requiredString(value, field, maxLength) {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpsError("invalid-argument", `Missing required field: ${field}`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new HttpsError("invalid-argument", `Field too long: ${field}`);
  }
  return trimmed;
}

function optionalString(value, field, maxLength) {
  if (value == null || value === "") return "";
  if (typeof value !== "string") {
    throw new HttpsError("invalid-argument", `Invalid field: ${field}`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new HttpsError("invalid-argument", `Field too long: ${field}`);
  }
  return trimmed;
}

function enumValue(value, field) {
  const normalized = requiredString(value, field, 100);
  if (!ENUMS[field].has(normalized)) {
    throw new HttpsError("invalid-argument", `Invalid field: ${field}`);
  }
  return normalized;
}

function sanitizeApplication(application) {
  const unexpected = Object.keys(application).filter((key) => !ALLOWED_FIELDS.has(key));
  if (unexpected.length) {
    throw new HttpsError("invalid-argument", "Application contains unsupported fields.");
  }

  const email = requiredString(application.email, "email", 320).toLowerCase();
  if (!EMAIL_PATTERN.test(email)) {
    throw new HttpsError("invalid-argument", "Please provide a valid email address.");
  }

  const fallbackPreferences = application.fallbackPreferences ?? [];
  if (!Array.isArray(fallbackPreferences) || fallbackPreferences.length > 3) {
    throw new HttpsError("invalid-argument", "Invalid fallback preferences.");
  }
  const uniqueFallbacks = [...new Set(fallbackPreferences)];
  if (
    uniqueFallbacks.some(
      (value) => typeof value !== "string" || !FALLBACK_OPTIONS.has(value),
    )
  ) {
    throw new HttpsError("invalid-argument", "Invalid fallback preferences.");
  }

  if (application.pledgeAgreed !== true) {
    throw new HttpsError("failed-precondition", "The Pioneer Member pledge must be accepted.");
  }

  return {
    name: requiredString(application.name, "name", 200),
    email,
    ageRange: enumValue(application.ageRange, "ageRange"),
    stage: enumValue(application.stage, "stage"),
    flashFrequency: enumValue(application.flashFrequency, "flashFrequency"),
    disruptiveness: enumValue(application.disruptiveness, "disruptiveness"),
    priorLogging: enumValue(application.priorLogging, "priorLogging"),
    phoneType: enumValue(application.phoneType, "phoneType"),
    wearable: enumValue(application.wearable, "wearable"),
    howHeard: optionalString(application.howHeard, "howHeard", 500),
    whyJoin: requiredString(application.whyJoin, "whyJoin", 3000),
    fallbackPreferences: uniqueFallbacks,
    pledgeAgreed: true,
  };
}

exports.submitBetaApplication = onCall(async (request) => {
  const { token, application } = request.data || {};

  if (typeof token !== "string" || !TOKEN_PATTERN.test(token)) {
    throw new HttpsError("invalid-argument", "This application link is invalid.");
  }
  if (!application || typeof application !== "object" || Array.isArray(application)) {
    throw new HttpsError("invalid-argument", "Missing application data.");
  }

  const sanitized = sanitizeApplication(application);
  const tokenRef = db.collection("betaApplicationTokens").doc(token);
  const applicationRef = db.collection("betaApplications").doc();

  const result = await db.runTransaction(async (tx) => {
    const tokenSnap = await tx.get(tokenRef);
    if (!tokenSnap.exists) {
      throw new HttpsError("not-found", "This application link is invalid.");
    }

    const tokenData = tokenSnap.data();
    if (tokenData.used === true) {
      throw new HttpsError("failed-precondition", "This application link has already been used.");
    }

    const expiresAtMs = tokenData.expiresAt?.toMillis?.();
    if (typeof expiresAtMs !== "number" || expiresAtMs <= Date.now()) {
      throw new HttpsError("failed-precondition", "This application link has expired.");
    }

    const tokenEmail = String(tokenData.email || "").trim().toLowerCase();
    if (!tokenEmail || tokenEmail !== sanitized.email) {
      throw new HttpsError(
        "permission-denied",
        "This application link doesn't match the email provided.",
      );
    }

    tx.set(applicationRef, {
      ...sanitized,
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    tx.update(tokenRef, {
      used: true,
      usedAt: admin.firestore.FieldValue.serverTimestamp(),
      applicationId: applicationRef.id,
    });

    return { applicationId: applicationRef.id };
  });

  return { success: true, applicationId: result.applicationId };
});
