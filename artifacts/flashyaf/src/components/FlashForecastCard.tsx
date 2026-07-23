import type { Flash } from "@/types/flash";

const RISK_CONFIG = {
  Low:      { icon: "❄️",  color: "#2E86AB", bg: "rgba(46,134,171,0.10)",  border: "rgba(46,134,171,0.28)"  },
  Moderate: { icon: "🌤️", color: "#F5A623", bg: "rgba(245,166,35,0.10)",  border: "rgba(245,166,35,0.28)"  },
  High:     { icon: "🔥",  color: "#E74C3C", bg: "rgba(231,76,60,0.12)",   border: "rgba(231,76,60,0.35)"   },
  Extreme:  { icon: "🌋",  color: "#FF2400", bg: "rgba(139,0,0,0.16)",     border: "rgba(255,36,0,0.5)"     },
} as const;

type Risk = keyof typeof RISK_CONFIG;

function getRisk(count: number, maxCount: number): Risk {
  if (maxCount === 0) return "Low";
  const ratio = count / maxCount;
  if (ratio < 0.25) return "Low";
  if (ratio < 0.5)  return "Moderate";
  if (ratio < 0.75) return "High";
  return "Extreme";
}

function hourLabel(h: number): string {
  if (h === 0)  return "12am";
  if (h < 12)   return `${h}am`;
  if (h === 12) return "12pm";
  return `${h - 12}pm`;
}

interface Props { flashes: Flash[]; }

export default function FlashForecastCard({ flashes }: Props) {
  if (flashes.length < 10) return null;

  const byHour = Array(24).fill(0) as number[];
  flashes.forEach((f) => { byHour[new Date(f.startTime).getHours()]++; });
  const maxCount = Math.max(...byHour, 1);

  const currentHour = new Date().getHours();
  const outlook = [0, 1, 2, 3].map((offset) => {
    const h = (currentHour + offset) % 24;
    return { h, risk: getRisk(byHour[h], maxCount), offset };
  });

  const currentRisk = outlook[0].risk;
  const cfg = RISK_CONFIG[currentRisk];

  return (
    <div style={{ ...s.card, background: cfg.bg, border: `1.5px solid ${cfg.border}` }}>
      <div style={s.top}>
        <div style={s.topLeft}>
          <span style={s.bigIcon}>{cfg.icon}</span>
          <div>
            <p style={s.badge}>⛈ FLASH FORECAST</p>
            <p style={{ ...s.riskLabel, color: cfg.color }}>
              {currentRisk} Risk
            </p>
          </div>
        </div>
        <p style={s.nowTime}>{hourLabel(currentHour)}</p>
      </div>

      <div style={s.outlookRow}>
        {outlook.map(({ h, risk, offset }) => {
          const c = RISK_CONFIG[risk];
          return (
            <div key={offset} style={s.outlookItem}>
              <p style={{ ...s.outlookTime, color: offset === 0 ? "#fff" : "rgba(255,255,255,0.4)" }}>
                {offset === 0 ? "Now" : hourLabel(h)}
              </p>
              <span style={s.outlookIcon}>{c.icon}</span>
              <p style={{ ...s.outlookRisk, color: c.color }}>{risk}</p>
            </div>
          );
        })}
      </div>

      <p style={s.footer}>Based on your flash history · {flashes.length} flashes analyzed</p>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  card: {
    width: "100%", boxSizing: "border-box",
    borderRadius: "20px", padding: "16px 18px 14px", marginTop: "14px",
  },
  top: {
    display: "flex", alignItems: "center",
    justifyContent: "space-between", marginBottom: "14px",
  },
  topLeft: { display: "flex", alignItems: "center", gap: "12px" },
  bigIcon: { fontSize: "36px", lineHeight: 1 },
  badge: {
    color: "rgba(255,255,255,0.38)", fontSize: "9px", fontWeight: 800,
    letterSpacing: "2px", textTransform: "uppercase", margin: "0 0 3px",
  },
  riskLabel: { fontSize: "20px", fontWeight: 900, margin: 0, lineHeight: 1 },
  nowTime: { color: "rgba(255,255,255,0.28)", fontSize: "12px", fontWeight: 600, margin: 0 },
  outlookRow: {
    display: "flex",
    background: "rgba(0,0,0,0.18)", borderRadius: "14px", padding: "12px 8px",
    marginBottom: "10px",
  },
  outlookItem: {
    flex: 1, display: "flex", flexDirection: "column",
    alignItems: "center", gap: "4px",
  },
  outlookTime: { fontSize: "10px", fontWeight: 700, margin: 0 },
  outlookIcon: { fontSize: "22px", lineHeight: 1 },
  outlookRisk: {
    fontSize: "9px", fontWeight: 900, margin: 0,
    textTransform: "uppercase", letterSpacing: "0.5px",
  },
  footer: {
    color: "rgba(255,255,255,0.2)", fontSize: "10px",
    fontWeight: 500, margin: 0, textAlign: "center",
  },
};
