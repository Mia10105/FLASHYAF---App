// FLASHYAF™ — Cloud Function: generateBetaToken
// Deploy this as part of your Firebase Functions project (functions/index.js
// or as its own file exported from index.js).
//
// Trigger: called via HTTP POST from a Brevo automation "Send a webhook" step,
// right after a contact is added to List #4 (FLASHYAF Pioneer Beta Applicants).
//
// What it does:
//   1. Verifies the request came from Brevo (shared secret check)
//   2. Generates a unique, single-use token
//   3. Saves { email, used:false, createdAt, expiresAt } to Firestore under
//      betaApplicationTokens/{token} — valid for 2 weeks from creation
//   4. Writes that token back onto the contact's Brevo record as a custom attribute
//      (BETA_TOKEN) so it can be inserted into email templates via {{contact.BETA_TOKEN}}

const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const crypto = require("crypto");

initializeApp();
const db = getFirestore();

const TOKEN_VALID_DAYS = 14; // 2-week link validity, matches the evaluation window

// Set these with:
//   firebase functions:secrets:set BREVO_API_KEY
//   firebase functions:secrets:set BETA_WEBHOOK_SECRET
const BREVO_API_KEY = defineSecret("BREVO_API_KEY");
const BETA_WEBHOOK_SECRET = defineSecret("BETA_WEBHOOK_SECRET");

exports.generateBetaToken = onRequest(
  { secrets: [BREVO_API_KEY, BETA_WEBHOOK_SECRET] },
  async (req, res) => {
    if (req.method !== "POST") {
      return res.status(405).send("Method not allowed");
    }

    // --- Verify the request is actually from Brevo ---
    const providedSecret = req.headers["x-webhook-secret"];
    if (providedSecret !== BETA_WEBHOOK_SECRET.value()) {
      return res.status(401).send("Unauthorized");
    }

    const email = (req.body?.email || "").trim().toLowerCase();
    if (!email) {
      return res.status(400).send("Missing email in request body");
    }

    try {
      // --- Generate a unique, single-use token ---
      const token = crypto.randomUUID();

      // --- Calculate 2-week expiration ---
      const now = new Date();
      const expiresAtDate = new Date(now.getTime() + TOKEN_VALID_DAYS * 24 * 60 * 60 * 1000);

      // --- Save it to Firestore ---
      await db.collection("betaApplicationTokens").doc(token).set({
        email,
        used: false,
        createdAt: FieldValue.serverTimestamp(),
        expiresAt: Timestamp.fromDate(expiresAtDate)
      });

      // --- Push the token back to Brevo as a contact attribute ---
      const brevoResponse = await fetch(
        `https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`,
        {
          method: "PUT",
          headers: {
            "accept": "application/json",
            "content-type": "application/json",
            "api-key": BREVO_API_KEY.value()
          },
          body: JSON.stringify({
            attributes: { BETA_TOKEN: token }
          })
        }
      );

      if (!brevoResponse.ok) {
        const errText = await brevoResponse.text();
        console.error("Brevo contact update failed:", brevoResponse.status, errText);
        // Token still exists in Firestore even if this step fails —
        // it just won't be auto-inserted into the email yet.
        return res.status(502).send("Token created, but Brevo update failed. Check function logs.");
      }

      return res.status(200).json({ success: true, token, expiresAt: expiresAtDate.toISOString() });

    } catch (err) {
      console.error("generateBetaToken error:", err);
      return res.status(500).send("Internal error generating token");
    }
  }
);
