import {
  collection,
  query,
  where,
  limit,
  getDocs,
  doc,
  updateDoc,
  increment,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/** Deterministic 8-char referral code derived from Firebase UID. */
export function getReferralCode(uid: string): string {
  return uid.slice(0, 8).toUpperCase();
}

/** The share message shown / copied when a user invites a friend. */
export function getShareMessage(code: string, appUrl: string): string {
  return `I have been using FLASHYAF™ to track my hot flashes and it is actually helping. Use my code ${code} to sign up free at ${appUrl}`;
}

/**
 * Credit the referrer when a new user signs up via a referral code.
 * Queries users by their stored `referralCode` field, then increments
 * their `referralCount` and marks the new user as referred.
 */
export async function attributeReferral(
  refCode: string,
  newUserUid: string
): Promise<void> {
  if (!refCode || !newUserUid) return;
  const q = query(
    collection(db, "users"),
    where("referralCode", "==", refCode),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return;
  const referrerDoc = snap.docs[0];
  if (referrerDoc.id === newUserUid) return; // prevent self-referral
  await updateDoc(doc(db, "users", referrerDoc.id), {
    referralCount: increment(1),
  });
  await setDoc(
    doc(db, "users", newUserUid),
    { referredBy: referrerDoc.id, referredByCode: refCode },
    { merge: true }
  );
}
