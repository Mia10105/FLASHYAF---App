declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

// ── PRIVACY FIX ──────────────────────────────────────────────────────────
// Only generic, non-health app-usage events are ever sent to Google
// Analytics. Anything that reveals flash/symptom activity is tracked with
// trackInternalEvent() below instead, which never leaves this app — it's
// General Wellness positioning stays true, and nothing health-related is
// shared with a third party.
export type GAEventName =
  | "user_signup"
  | "premium_upgrade_tapped"
  | "community_post_submitted"
  | "education_hub_opened"
  | "shop_opened"
  | "referral_link_copied"
  | "workplace_letter_downloaded"
  | "feedback_submitted";

// Flash/health-adjacent activity — internal only, never sent to Google or
// any other third party. Kept as its own function (rather than deleted) so
// this data is still available to build your own in-app insights later.
export type InternalEventName =
  | "flash_started"
  | "flash_completed"
  | "stage_tapped"
  | "support_drawer_opened"
  | "humor_tapped"
  | "encouragement_tapped"
  | "breathing_completed";

type EventParams = Record<string, string | number | boolean | undefined>;

export function trackEvent(event: GAEventName, params?: EventParams): void {
  try {
    if (typeof window.gtag === "function") {
      window.gtag("event", event, params ?? {});
    }
  } catch {
    /* never throw — analytics must never break the app */
  }
}

// Intentionally does NOT call window.gtag or any third-party service.
// Placeholder for a future internal-only analytics pipeline (e.g. writing
// to your own Firestore) if you want this insight down the road.
export function trackInternalEvent(
  _event: InternalEventName,
  _params?: EventParams,
): void {
  /* internal-only — never forwarded to Google or any third party */
}
