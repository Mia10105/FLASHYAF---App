// FLASHYAF™ — Cloud Function: JOINFAF5 referral crediting
//
// Design (locked in 2026-08-03):
//   - Referred person gets $5 off their first month (one-time), via a
//     Stripe Promotion Code that matches their referrer's existing
//     in-app referral code (see lib/referral.ts — codes already exist,
//     no new code-generation system needed).
//   - Referrer earns $2/month recurring credit per successful referral,
//     capped at $10/month total (5 referrals), starting only after the
//     referred person's FIRST invoice is paid AND not refunded.
//
// This function listens for Stripe webhook events and does the crediting.
// It does NOT create the discount at checkout — that part is handled
// natively by Stripe once "Allow promotion codes" is enabled on the
// relevant Payment Links (same mechanism already used for RETBET5) and a
// promotion code exists per referrer, tied to a $5-off-first-invoice-only
// coupon.
//
// ⚠️ STRIPE SETUP STILL NEEDED (not done by this file, and not something
// Claude did automatically — these are live billing changes):
//   1. Create a Stripe Coupon: $5 fixed off, duration "once".
//   2. For each referrer, create a Promotion Code on that coupon whose
//      `code` matches their existing app referralCode (getReferralCode()
//      in lib/referral.ts — 8 chars, derived from their UID), with
//      restrictions.first_time_transaction = true so it can't be reused
//      by an existing customer.
//   3. Enable "Allow promotion codes" on the GROW/FLOW Membership
//      Payment Links (same as RETBET5).
//   4. Register this function's URL as a Stripe webhook endpoint,
//      subscribed to invoice.paid and charge.refunded.
// Ask before doing any of these — they touch your live Stripe account.

const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const Stripe = require("stripe");

const db = admin.firestore();

const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_REFERRAL_WEBHOOK_SECRET");

const MONTHLY_CREDIT_AMOUNT_CENTS = 200; // $2.00
const MAX_MONTHLY_CREDIT_CENTS = 1000; // $10.00 cap (5 referrals)

exports.stripeReferralWebhook = onRequest(
  { secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET] },
  async (req, res) => {
    const stripe = Stripe(STRIPE_SECRET_KEY.value());

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        req.headers["stripe-signature"],
        STRIPE_WEBHOOK_SECRET.value(),
      );
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).send("Invalid signature");
    }

    try {
      if (event.type === "invoice.paid") {
        await handleInvoicePaid(stripe, event.data.object);
      } else if (event.type === "charge.refunded") {
        await handleChargeRefunded(stripe, event.data.object);
      }
      res.status(200).send("ok");
    } catch (err) {
      console.error("Error processing referral webhook event:", err);
      // Return an error so Stripe retries transient failures instead of
      // permanently losing a valid referral event.
      res.status(500).send("processing failed");
    }
  },
);

async function handleInvoicePaid(stripe, invoice) {
  const discounts = invoice.discounts || (invoice.discount ? [invoice.discount] : []);
  const promoDiscount = discounts.find((d) => d && d.promotion_code);
  if (!promoDiscount) return; // no referral code used on this invoice

  const promoCode = await stripe.promotionCodes.retrieve(promoDiscount.promotion_code);
  const referralCode = promoCode.code;

  // Only the customer's very first invoice on this subscription counts as
  // "the referral" — later renewals shouldn't re-trigger a new credit.
  const isFirstInvoice = invoice.billing_reason === "subscription_create";
  if (!isFirstInvoice) return;

  // Find the referrer by their app referral code (users/{uid}.referralCode).
  const referrerSnap = await db
    .collection("users")
    .where("referralCode", "==", referralCode)
    .limit(1)
    .get();
  if (referrerSnap.empty) {
    console.warn(`No user found for referral code ${referralCode} on invoice ${invoice.id}`);
    return;
  }
  const referrerDoc = referrerSnap.docs[0];
  const referrerUid = referrerDoc.id;
  const referrerData = referrerDoc.data();

  // Enforce the $10/mo cap (5 referrals) before crediting a 6th+.
  const currentMonthlyCreditCents = referrerData.referralCreditCents || 0;
  if (currentMonthlyCreditCents >= MAX_MONTHLY_CREDIT_CENTS) {
    console.log(`Referrer ${referrerUid} already at the $10/mo referral cap — no further credit.`);
    return;
  }

  // Record this specific invoice as "pending confirmation" — we don't
  // apply the actual Stripe balance credit until we're sure it isn't
  // refunded (see handleChargeRefunded). A short grace window (e.g. a
  // scheduled sweep after a few days) is the simplest safe approach; for
  // now this records the pending credit and a human can review the
  // referralCredits collection if needed.
  const creditRef = db.collection("referralCredits").doc(invoice.id);
  const existing = await creditRef.get();
  if (existing.exists) return; // Stripe webhook delivery is at-least-once.

  await creditRef.create({
    referrerUid,
    referralCode,
    referredInvoiceId: invoice.id,
    referredCustomerId: invoice.customer,
    amountCents: MONTHLY_CREDIT_AMOUNT_CENTS,
    status: "pending", // -> "applied" once confirmed not refunded, "reversed" if refunded
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`Recorded pending $2/mo referral credit for ${referrerUid} from invoice ${invoice.id}`);
}

async function handleChargeRefunded(stripe, charge) {
  // If a refunded charge corresponds to a pending referral credit,
  // reverse it instead of applying the referrer's $2/mo.
  const invoiceId = charge.invoice;
  if (!invoiceId) return;

  const creditRef = db.collection("referralCredits").doc(invoiceId);
  const creditSnap = await creditRef.get();
  if (!creditSnap.exists) return;

  await creditRef.update({ status: "reversed", reversedAt: admin.firestore.FieldValue.serverTimestamp() });
  console.log(`Reversed pending referral credit for invoice ${invoiceId} due to refund.`);
}

/* ─────────────────────────────────────────────────────────────────────────
   STILL NEEDED — a scheduled sweep (not included here to avoid touching
   live Stripe balances without a review) that, a few days after a
   referralCredits doc is created with status "pending" and no matching
   refund has come in, actually applies the $2 credit — either via
   stripe.customers.createBalanceTransaction() on the REFERRER's Stripe
   customer, or by incrementing referralCreditCents on their Firestore
   user doc if credits are tracked and applied manually via Stripe
   coupons instead. Which approach fits your existing Stripe setup better
   is worth a quick conversation before building it — happy to do either.
   ───────────────────────────────────────────────────────────────────────── */
