export function haptic(ms: number = 50): void {
  try { navigator.vibrate?.(ms); } catch { /* silent — not supported everywhere */ }
}
