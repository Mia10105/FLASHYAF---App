const AREAS = [
  { id: "face",  label: "Face / Head", icon: "🧠" },
  { id: "neck",  label: "Neck",        icon: "🧣" },
  { id: "chest", label: "Chest",       icon: "💗" },
  { id: "back",  label: "Back",        icon: "🔙" },
  { id: "arms",  label: "Arms",        icon: "💪" },
  { id: "lower", label: "Lower Body",  icon: "🦵" },
];

interface Props {
  selected: string[];
  onChange: (areas: string[]) => void;
}

export default function BodyAreaSelector({ selected, onChange }: Props) {
  function toggle(id: string) {
    onChange(selected.includes(id)
      ? selected.filter((a) => a !== id)
      : [...selected, id]);
  }

  return (
    <div style={s.wrap}>
      <p style={s.label}>
        Where do you feel it? <span style={s.optional}>(optional)</span>
      </p>
      <div style={s.grid}>
        {AREAS.map((area) => {
          const active = selected.includes(area.id);
          return (
            <button
              key={area.id}
              style={{
                ...s.btn,
                background: active ? "rgba(192,57,43,0.3)" : "rgba(255,255,255,0.12)",
                border: active ? "1.5px solid rgba(192,57,43,0.8)" : "1px solid rgba(255,255,255,0.35)",
                color: active ? "#FF8C6B" : "rgba(255,255,255,0.9)",
              }}
              onClick={() => toggle(area.id)}
            >
              <span style={s.icon}>{area.icon}</span>
              <span style={s.btnLabel}>{area.label}</span>
              {active && <span style={s.check}>✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: {
    background: "rgba(0,0,0,0.25)", borderRadius: "14px",
    padding: "10px 14px", margin: "0 14px 4px",
  },
  label: {
    color: "rgba(255,255,255,0.9)", fontSize: "10px", fontWeight: 700,
    textTransform: "uppercase", letterSpacing: "0.8px", margin: "0 0 8px",
  },
  optional: {
    color: "rgba(255,255,255,0.55)", fontWeight: 500,
    textTransform: "none", letterSpacing: 0,
  },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" },
  btn: {
    display: "flex", alignItems: "center", gap: "6px",
    borderRadius: "10px", padding: "8px 10px",
    cursor: "pointer", fontFamily: "'Inter', sans-serif",
    transition: "all 0.15s ease", position: "relative",
  },
  icon: { fontSize: "14px", flexShrink: 0 },
  btnLabel: { fontSize: "11px", fontWeight: 600, flex: 1, textAlign: "left" },
  check: {
    position: "absolute", top: "5px", right: "7px",
    color: "#FF8C6B", fontSize: "9px", fontWeight: 900,
  },
};
