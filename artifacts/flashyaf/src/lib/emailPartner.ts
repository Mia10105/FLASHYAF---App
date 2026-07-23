import emailjs from "@emailjs/browser";

const SERVICE_ID  = import.meta.env.VITE_EMAILJS_SERVICE_ID  as string | undefined;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID as string | undefined;
const PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY  as string | undefined;

export function emailjsConfigured(): boolean {
  return !!(SERVICE_ID && TEMPLATE_ID && PUBLIC_KEY);
}

export async function sendPartnerEmail({
  toEmail,
  userName,
  durationSeconds,
  peakRating,
}: {
  toEmail: string;
  userName: string;
  durationSeconds: number;
  peakRating?: number;
}): Promise<void> {
  if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) return;

  const min = Math.floor(durationSeconds / 60);
  const sec = durationSeconds % 60;
  const durationStr = min > 0 ? `${min} min ${sec} sec` : `${sec} seconds`;
  const intensityStr = peakRating ? `${peakRating} out of 5` : "not rated";
  const message =
    `${userName} just logged a hot flash on FLASHYAF™. ` +
    `Duration: ${durationStr}. ` +
    `Intensity: ${intensityStr}. ` +
    `They are doing great!`;

  await emailjs.send(
    SERVICE_ID,
    TEMPLATE_ID,
    {
      to_email: toEmail,
      user_name: userName,
      duration: durationStr,
      intensity: intensityStr,
      message,
    },
    PUBLIC_KEY
  );
}
