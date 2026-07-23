import { useState } from "react";

interface Props {
  onDone: () => void;
}

const SLIDES = [
  {
    emoji: "🌡️",
    accentColor: "#E74C3C",
    glowColor: "rgba(231,76,60,0.35)",
    badge: "THE BASICS",
    title: "What is a hot flash?",
    body: "A hot flash is a sudden, intense surge of heat — usually starting in the chest and spreading to the face and neck. Your heart races. You sweat. Then it's gone.\n\nThey're caused by the hypothalamus — the brain's thermostat — misfiring during the hormone shifts of perimenopause and menopause. Up to 75% of women experience them.\n\nThey can last anywhere from 30 seconds to 10 minutes and happen day or night.",
    visual: [
      { label: "Avg Duration", value: "4 min", icon: "⏱️" },
      { label: "Women Affected", value: "75%", icon: "👩" },
      { label: "Triggers", value: "Many", icon: "⚡" },
    ],
  },
  {
    emoji: "📱",
    accentColor: "#8E44AD",
    glowColor: "rgba(142,68,173,0.35)",
    badge: "HOW IT WORKS",
    title: "How FLASHYAF tracks it",
    body: "When a flash starts, tap FLASH STARTED on the home screen. Then tap through the four stages as they happen:\n\n🔴 Flash Started → ⬆️ Peak Intensity → 🌊 Cooling Down → ✅ Back to Normal\n\nEach tap is timestamped. FLASHYAF calculates your duration, peak intensity, and which stage your body moves through — building your personal flash fingerprint over time.",
    visual: null,
    stages: ["🔴 Flash Started", "⬆️ Peak Intensity", "🌊 Cooling Down", "✅ Back to Normal"],
  },
  {
    emoji: "📊",
    accentColor: "#F5A623",
    glowColor: "rgba(245,166,35,0.35)",
    badge: "YOUR DATA",
    title: "What your data means",
    body: "Every flash you log teaches FLASHYAF more about your body. After just a few logs, patterns emerge:\n\n• When your flashes peak (morning? night?)\n• How long yours typically last\n• Which days of the week are hardest\n• Whether they're getting more or less intense over time\n\nThis is your personal dataset — no one else's body behaves exactly like yours.",
    visual: [
      { label: "Peak Time", value: "9–11am", icon: "🕘" },
      { label: "Avg Intensity", value: "3.4 / 5", icon: "⭐" },
      { label: "Busiest Day", value: "Tuesdays", icon: "📅" },
    ],
  },
  {
    emoji: "🧠",
    accentColor: "#2E86AB",
    glowColor: "rgba(46,134,171,0.35)",
    badge: "AI INSIGHTS",
    title: "How predictions work",
    body: "After you've logged 10 or more flashes, FLASHYAF's AI insights activate.\n\nIt analyzes your patterns to tell you:\n✦ When your body tends to peak\n✦ Your most intense days of the week\n✦ How your duration compares to others\n✦ Practical tips based on your specific timing\n\nInsights rotate daily and get smarter as you log more. The more you track, the more personalized your experience becomes.",
    visual: [
      { label: "Unlocks At", value: "10 logs", icon: "🔓" },
      { label: "Refreshes", value: "Daily", icon: "🔄" },
      { label: "Based On", value: "Your data", icon: "🎯" },
    ],
  },
  {
    emoji: "🚀",
    accentColor: "#1ABC9C",
    glowColor: "rgba(26,188,156,0.35)",
    badge: "PRO TIPS",
    title: "Getting the most out of it",
    body: "FLASHYAF works best when it's part of your daily rhythm:",
    tips: [
      { icon: "🔥", tip: "Log every flash — even mild ones. Patterns live in the data." },
      { icon: "📋", tip: "Do the 30-second daily check-in. Mood, sleep, energy — it all connects." },
      { icon: "👫", tip: "Enable Partner Mode to keep your support person in the loop." },
      { icon: "🧠", tip: "Visit Pattern Intelligence weekly. Your data tells a story." },
      { icon: "💬", tip: "Use the Community. You're not alone — and someone else needs to hear that too." },
    ],
  },
];

export default function TutorialScreen({ onDone }: Props) {
  const [current, setCurrent] = useState(0);
  const [animDir, setAnimDir] = useState<"left" | "right" | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const slide = SLIDES[current];
  const isLast = current === SLIDES.length - 1;

  function go(dir: "next" | "prev") {
    if (isAnimating) return;
    if (dir === "next" && current >= SLIDES.length - 1) { onDone(); return; }
    if (dir === "prev" && current <= 0) return;
    setAnimDir(dir === "next" ? "left" : "right");
    setIsAnimating(true);
    setTimeout(() => {
      setCurrent((c) => dir === "next" ? c + 1 : c - 1);
      setAnimDir(null);
      setIsAnimating(false);
    }, 280);
  }

  return (
    <div style={s.container}>
      {/* Header */}
      <div style={s.topBar}>
        <button style={s.backBtn} onClick={() => current > 0 ? go("prev") : onDone()}>
          {current > 0 ? "‹ Back" : "✕ Close"}
        </button>
        <div style={s.dots}>
          {SLIDES.map((_, i) => (
            <div
              key={i}
              style={{
                ...s.dot,
                background: i === current ? slide.accentColor : "rgba(255,255,255,0.18)",
                width: i === current ? "20px" : "6px",
                transition: "all 0.3s ease",
              }}
            />
          ))}
        </div>
        <button style={s.skipBtn} onClick={onDone}>
          {isLast ? "" : "Skip"}
        </button>
      </div>

      {/* Slide content */}
      <div
        style={{
          ...s.slideWrap,
          opacity: isAnimating ? 0 : 1,
          transform: isAnimating
            ? `translateX(${animDir === "left" ? "-40px" : "40px"})`
            : "translateX(0)",
          transition: isAnimating ? "opacity 0.25s ease, transform 0.25s ease" : "opacity 0.25s ease, transform 0.25s ease",
        }}
      >
        {/* Glow blob */}
        <div style={{ ...s.glow, background: slide.glowColor }} />

        {/* Badge + icon */}
        <div style={s.emojiWrap}>
          <div style={{ ...s.emojiCircle, background: `${slide.accentColor}18`, border: `2px solid ${slide.accentColor}40` }}>
            <span style={s.emoji}>{slide.emoji}</span>
          </div>
        </div>
        <p style={{ ...s.badge, color: slide.accentColor }}>{slide.badge}</p>
        <h1 style={s.title}>{slide.title}</h1>

        {/* Body text */}
        <div style={s.bodyScroll}>
          {slide.body && (
            <p style={s.body}>{slide.body}</p>
          )}

          {/* Stage pills */}
          {"stages" in slide && slide.stages && (
            <div style={s.stageList}>
              {slide.stages.map((st, i) => (
                <div key={i} style={{ ...s.stagePill, borderColor: `${slide.accentColor}40` }}>
                  <span style={{ ...s.stageNum, background: slide.accentColor }}>{i + 1}</span>
                  <span style={s.stageLabel}>{st}</span>
                </div>
              ))}
            </div>
          )}

          {/* Stat row */}
          {"visual" in slide && slide.visual && (
            <div style={s.statRow}>
              {slide.visual.map((v) => (
                <div key={v.label} style={{ ...s.statBox, borderColor: `${slide.accentColor}30` }}>
                  <span style={s.statIcon}>{v.icon}</span>
                  <span style={{ ...s.statValue, color: slide.accentColor }}>{v.value}</span>
                  <span style={s.statLabel}>{v.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Tips list */}
          {"tips" in slide && slide.tips && (
            <div style={s.tipsList}>
              {slide.tips.map((t, i) => (
                <div key={i} style={s.tipRow}>
                  <span style={s.tipIcon}>{t.icon}</span>
                  <span style={s.tipText}>{t.tip}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* CTA */}
      <div style={s.ctaWrap}>
        <button
          style={{
            ...s.ctaBtn,
            background: `linear-gradient(135deg, ${slide.accentColor} 0%, ${slide.accentColor}CC 100%)`,
            boxShadow: `0 0 28px ${slide.glowColor}`,
          }}
          onClick={() => go("next")}
        >
          {isLast ? "✓ Got It — Let's Go!" : `Next: ${SLIDES[current + 1].title.split(" ").slice(0, 3).join(" ")}… →`}
        </button>
        <p style={s.progress}>{current + 1} of {SLIDES.length}</p>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh", background: "var(--color-bg)",
    display: "flex", flexDirection: "column",
    maxWidth: "480px", margin: "0 auto",
    fontFamily: "'Inter', sans-serif", overflow: "hidden",
    position: "relative",
  },
  topBar: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "16px 20px 8px", flexShrink: 0,
  },
  backBtn: {
    background: "transparent", border: "none",
    color: "rgba(255,255,255,0.45)", fontSize: "14px",
    fontWeight: 600, cursor: "pointer", padding: "4px 0",
    fontFamily: "'Inter', sans-serif",
  },
  dots: { display: "flex", gap: "5px", alignItems: "center" },
  dot: { height: "6px", borderRadius: "3px" },
  skipBtn: {
    background: "transparent", border: "none",
    color: "rgba(255,255,255,0.35)", fontSize: "13px",
    fontWeight: 600, cursor: "pointer", padding: "4px 0",
    fontFamily: "'Inter', sans-serif", minWidth: "40px", textAlign: "right",
  },

  slideWrap: {
    flex: 1, display: "flex", flexDirection: "column",
    padding: "4px 24px 0", position: "relative",
    overflow: "hidden",
  },
  glow: {
    position: "absolute", top: "-60px", left: "50%",
    transform: "translateX(-50%)",
    width: "280px", height: "280px", borderRadius: "50%",
    filter: "blur(80px)", opacity: 0.35, pointerEvents: "none",
    zIndex: 0,
  },

  emojiWrap: { display: "flex", justifyContent: "center", marginBottom: "12px", position: "relative", zIndex: 1 },
  emojiCircle: {
    width: "80px", height: "80px", borderRadius: "24px",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  emoji: { fontSize: "42px", lineHeight: 1 },

  badge: {
    fontSize: "10px", fontWeight: 900, letterSpacing: "2.5px",
    textTransform: "uppercase", textAlign: "center",
    margin: "0 0 6px", position: "relative", zIndex: 1,
  },
  title: {
    color: "#fff", fontSize: "26px", fontWeight: 900,
    textAlign: "center", margin: "0 0 16px",
    lineHeight: 1.2, position: "relative", zIndex: 1,
  },

  bodyScroll: {
    flex: 1, overflowY: "auto", position: "relative", zIndex: 1,
    display: "flex", flexDirection: "column", gap: "14px",
  },
  body: {
    color: "rgba(255,255,255,0.65)", fontSize: "14px",
    lineHeight: 1.7, margin: 0, whiteSpace: "pre-line",
  },

  stageList: { display: "flex", flexDirection: "column", gap: "8px" },
  stagePill: {
    display: "flex", alignItems: "center", gap: "12px",
    background: "rgba(255,255,255,0.04)", border: "1px solid",
    borderRadius: "12px", padding: "12px 14px",
  },
  stageNum: {
    width: "22px", height: "22px", borderRadius: "6px",
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "#fff", fontSize: "11px", fontWeight: 900, flexShrink: 0,
  },
  stageLabel: { color: "rgba(255,255,255,0.75)", fontSize: "14px", fontWeight: 600 },

  statRow: { display: "flex", gap: "8px" },
  statBox: {
    flex: 1, background: "rgba(255,255,255,0.04)",
    border: "1px solid", borderRadius: "14px",
    padding: "12px 8px", display: "flex", flexDirection: "column",
    alignItems: "center", gap: "4px",
  },
  statIcon: { fontSize: "20px", lineHeight: 1 },
  statValue: { fontSize: "17px", fontWeight: 900, lineHeight: 1 },
  statLabel: { color: "rgba(255,255,255,0.35)", fontSize: "10px", fontWeight: 600, textAlign: "center", textTransform: "uppercase", letterSpacing: "0.4px" },

  tipsList: { display: "flex", flexDirection: "column", gap: "10px" },
  tipRow: {
    display: "flex", gap: "12px", alignItems: "flex-start",
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "12px", padding: "12px 14px",
  },
  tipIcon: { fontSize: "20px", flexShrink: 0, lineHeight: 1.3 },
  tipText: { color: "rgba(255,255,255,0.7)", fontSize: "13px", lineHeight: 1.55, flex: 1 },

  ctaWrap: {
    padding: "16px 24px 40px", flexShrink: 0,
    display: "flex", flexDirection: "column", alignItems: "center", gap: "10px",
  },
  ctaBtn: {
    width: "100%", border: "none", borderRadius: "100px",
    color: "#fff", fontSize: "16px", fontWeight: 800,
    padding: "19px 24px", cursor: "pointer",
    fontFamily: "'Inter', sans-serif", letterSpacing: "0.2px",
    transition: "opacity 0.2s ease",
  },
  progress: {
    color: "rgba(255,255,255,0.2)", fontSize: "12px",
    fontWeight: 600, margin: 0,
  },
};
