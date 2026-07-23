import { useState } from "react";
import type { Flash } from "@/types/flash";
import { trackInternalEvent } from "@/lib/analytics";

type SupportStyle = "warm" | "direct" | "mindful";

interface Props {
  supportStyle: SupportStyle;
  prefersHumor: boolean;
  todayFlashes: Flash[];
  onClose: () => void;
}

const ENCOURAGEMENT: Record<SupportStyle, string> = {
  warm: "You've carried five flashes today — and you carried every single one of them. That takes a kind of quiet strength most people never see. Flashy sees it. You are doing beautifully, and you are allowed to rest now.",
  direct: "Five flashes in one day. You tracked every one. You handled every one. You're still standing — that's not a rough day, that's a masterclass in handling your business. Respect.",
  mindful: "Five flashes today — five moments where your body asked something of you, and you met each one. Each one passed. Each one always does. You are still here. Still whole. Still you.",
};

const HUMOR_LINES = [
  "Your hypothalamus has absolutely filed a noise complaint with your brain today. Luckily, your brain told it to take a seat. 💅",
  "Five flashes? Your internal thermostat has gone completely rogue. Someone needs to update its firmware ASAP. 🔧🔥",
  "Today's final score — Hot Flashes: 5, You: Still standing with your whole personality intact. Undefeated. 🏆",
];

function getHumorLine(flashes: Flash[]): string {
  return HUMOR_LINES[flashes.length % HUMOR_LINES.length];
}

function getSymptomTip(flashes: Flash[]): string {
  const areaCounts: Record<string, number> = {};
  flashes.forEach((f) =>
    f.bodyAreas?.forEach((a) => { areaCounts[a] = (areaCounts[a] || 0) + 1; })
  );
  const topArea = Object.entries(areaCounts).sort((a, b) => b[1] - a[1])[0]?.[0]?.toLowerCase() || "";

  if (topArea.includes("chest") || topArea.includes("heart")) {
    return "Your chest has taken the most heat today. Between flashes, try placing a cool damp cloth on your sternum — it helps your heart rate settle faster and signals your nervous system to stand down.";
  }
  if (topArea.includes("face") || topArea.includes("head")) {
    return "Your face and scalp have been the hottest today. Keep cool water within reach and splash your face between flashes — your trigeminal nerve responds to cold water almost instantly, telling your brain to cool down.";
  }
  if (topArea.includes("neck") || topArea.includes("throat")) {
    return "Your neck has been your hot spot today. A damp, cool cloth wrapped around the back of your neck between flashes can meaningfully cut recovery time — your carotid arteries are right there, cooling your blood directly.";
  }
  if (topArea.includes("back")) {
    return "When your back flares, lying on a cool surface — or a cooling pad on your lower back — can help your whole-body temperature drop faster. Your kidneys sit there; keeping that area cool helps everything settle.";
  }
  return "On days like this, your body's thermostat is working overtime. Sipping cold water through a flash can shorten its duration — your body reads the internal cold as a signal that cooling is working, and it backs off sooner.";
}

export default function CarePackageModal({ supportStyle, prefersHumor, todayFlashes, onClose }: Props) {
  const encouragement = ENCOURAGEMENT[supportStyle];
  const humorLine = getHumorLine(todayFlashes);
  const symptomTip = getSymptomTip(todayFlashes);
  const [breathingDone, setBreathingDone] = useState(false);

  return (
    <div style={s.overlay}>
      <div style={s.sheet}>

        {/* Gold glow header */}
        <div style={s.giftHeader}>
          <div style={s.giftIconWrap}>
            <span style={s.giftIcon}>🎁</span>
            <div style={s.giftGlow} />
          </div>
          <div style={s.headerText}>
            <p style={s.headerKicker}>CARE PACKAGE · FROM FLASHY</p>
            <p style={s.headerTitle}>Rough day — Flashy put together something for you.</p>
          </div>
        </div>

        <div style={s.body}>

          {/* Encouragement */}
          <div onClick={() => trackInternalEvent("encouragement_tapped")}>
            <Section
              icon="💜"
              label="Just for you"
              labelColor="#C39BD3"
              bg="rgba(142,68,173,0.08)"
              border="rgba(142,68,173,0.2)"
            >
              <p style={s.bodyText}>{encouragement}</p>
            </Section>
          </div>

          {/* Humor — only if prefersHumor */}
          {prefersHumor && (
            <div onClick={() => trackInternalEvent("humor_tapped")}>
              <Section
                icon="😂"
                label="A little something"
                labelColor="#F39C12"
                bg="rgba(243,156,18,0.07)"
                border="rgba(243,156,18,0.2)"
              >
                <p style={s.bodyText}>{humorLine}</p>
              </Section>
            </div>
          )}

          {/* Breathing */}
          <Section
            icon="🫁"
            label="Breathe with me"
            labelColor="#1ABC9C"
            bg="rgba(26,188,156,0.07)"
            border="rgba(26,188,156,0.2)"
          >
            <p style={s.bodyText}>
              Try <strong style={{ color: "#1ABC9C" }}>box breathing</strong> right now:
            </p>
            <div style={s.breatheSteps}>
              {[
                { n: "1", label: "Breathe IN", detail: "4 counts" },
                { n: "2", label: "Hold",       detail: "4 counts" },
                { n: "3", label: "Breathe OUT",detail: "4 counts" },
                { n: "4", label: "Hold",       detail: "4 counts" },
              ].map((step) => (
                <div key={step.n} style={s.breatheStep}>
                  <div style={s.breatheNum}>{step.n}</div>
                  <div>
                    <p style={s.breatheLabel}>{step.label}</p>
                    <p style={s.breatheDetail}>{step.detail}</p>
                  </div>
                </div>
              ))}
            </div>
            <p style={s.breatheNote}>
              Repeat 4 times. This activates your parasympathetic nervous system and tells your body it's safe to cool down.
            </p>
            <button
              style={{
                marginTop: "2px",
                width: "100%",
                background: breathingDone ? "rgba(26,188,156,0.15)" : "transparent",
                border: `1px solid ${breathingDone ? "#1ABC9C" : "rgba(26,188,156,0.3)"}`,
                borderRadius: "10px",
                color: breathingDone ? "#1ABC9C" : "rgba(26,188,156,0.7)",
                fontSize: "12px",
                fontWeight: 700,
                padding: "10px",
                cursor: "pointer",
                fontFamily: "'Inter', sans-serif",
                transition: "all 0.2s",
              }}
              onClick={() => {
                if (!breathingDone) {
                  trackInternalEvent("breathing_completed");
                  setBreathingDone(true);
                }
              }}
            >
              {breathingDone ? "✓ Done — great work" : "I completed the breathing exercise"}
            </button>
          </Section>

          {/* Symptom tip */}
          <Section
            icon="💡"
            label="Your tip for today"
            labelColor="#F5A623"
            bg="rgba(245,166,35,0.06)"
            border="rgba(245,166,35,0.2)"
          >
            <p style={s.bodyText}>{symptomTip}</p>
          </Section>

          {/* Tomorrow */}
          <Section
            icon="🌅"
            label="Before you go"
            labelColor="#FF6B9D"
            bg="rgba(255,107,157,0.06)"
            border="rgba(255,107,157,0.2)"
          >
            <p style={s.bodyText}>
              Tomorrow is a completely new page. Today's flashes belong to today — and today is almost done.
              Whatever tomorrow brings, Flashy will be right here with you.{" "}
              <strong style={{ color: "#FF6B9D" }}>Get some rest. You've more than earned it.</strong>
              {" "}💜
            </p>
          </Section>

        </div>

        {/* Close button */}
        <div style={s.footer}>
          <button style={s.closeBtn} onClick={onClose}>
            I'm ready — Close
          </button>
        </div>

      </div>
    </div>
  );
}

function Section({
  icon, label, labelColor, bg, border, children,
}: {
  icon: string;
  label: string;
  labelColor: string;
  bg: string;
  border: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ ...s.section, background: bg, border: `1px solid ${border}` }}>
      <div style={s.sectionHeader}>
        <span style={s.sectionIcon}>{icon}</span>
        <p style={{ ...s.sectionLabel, color: labelColor }}>{label}</p>
      </div>
      <div style={s.sectionBody}>{children}</div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 900,
    background: "rgba(0,0,0,0.75)",
    backdropFilter: "blur(8px)",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  sheet: {
    width: "100%",
    maxWidth: "480px",
    maxHeight: "90dvh",
    display: "flex",
    flexDirection: "column",
    borderRadius: "28px 28px 0 0",
    background: "linear-gradient(160deg, #130F00 0%, #0A0800 60%, #130F00 100%)",
    border: "1.5px solid #B8860B",
    borderBottom: "none",
    boxShadow: "0 0 60px rgba(184,134,11,0.4), 0 0 0 1px rgba(255,215,0,0.08), 0 -20px 80px rgba(0,0,0,0.8)",
    animation: "slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
    fontFamily: "'Inter', sans-serif",
    overflow: "hidden",
  },

  // Header
  giftHeader: {
    padding: "28px 20px 18px",
    display: "flex",
    alignItems: "flex-start",
    gap: "14px",
    borderBottom: "1px solid rgba(184,134,11,0.2)",
    flexShrink: 0,
    background: "rgba(184,134,11,0.04)",
  },
  giftIconWrap: {
    position: "relative",
    flexShrink: 0,
  },
  giftIcon: {
    fontSize: "44px",
    lineHeight: 1,
    display: "block",
    filter: "drop-shadow(0 0 12px rgba(255,215,0,0.5))",
  },
  giftGlow: {
    position: "absolute",
    inset: "-8px",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(255,215,0,0.15) 0%, transparent 70%)",
    pointerEvents: "none",
  },
  headerText: {
    flex: 1,
    paddingTop: "4px",
  },
  headerKicker: {
    color: "#B8860B",
    fontSize: "10px",
    fontWeight: 900,
    letterSpacing: "2px",
    margin: "0 0 5px",
  },
  headerTitle: {
    color: "#fff",
    fontSize: "17px",
    fontWeight: 800,
    margin: 0,
    lineHeight: 1.3,
  },

  // Scrollable body
  body: {
    flex: 1,
    overflowY: "auto",
    padding: "16px 16px 0",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },

  // Section cards
  section: {
    borderRadius: "16px",
    overflow: "hidden",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: "7px",
    padding: "10px 14px 8px",
  },
  sectionIcon: {
    fontSize: "14px",
    lineHeight: 1,
    flexShrink: 0,
  },
  sectionLabel: {
    fontSize: "10px",
    fontWeight: 900,
    letterSpacing: "1.5px",
    textTransform: "uppercase" as const,
    margin: 0,
  },
  sectionBody: {
    padding: "0 14px 14px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  bodyText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: "14px",
    lineHeight: 1.7,
    margin: 0,
  },

  // Breathing steps
  breatheSteps: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
  },
  breatheStep: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    background: "rgba(26,188,156,0.08)",
    border: "1px solid rgba(26,188,156,0.15)",
    borderRadius: "10px",
    padding: "10px 12px",
  },
  breatheNum: {
    width: "26px",
    height: "26px",
    borderRadius: "50%",
    background: "rgba(26,188,156,0.2)",
    border: "1px solid rgba(26,188,156,0.4)",
    color: "#1ABC9C",
    fontSize: "13px",
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  breatheLabel: {
    color: "#fff",
    fontSize: "12px",
    fontWeight: 700,
    margin: 0,
    lineHeight: 1.2,
  },
  breatheDetail: {
    color: "rgba(26,188,156,0.8)",
    fontSize: "11px",
    fontWeight: 600,
    margin: 0,
  },
  breatheNote: {
    color: "rgba(255,255,255,0.4)",
    fontSize: "12px",
    lineHeight: 1.55,
    margin: 0,
    fontStyle: "italic",
  },

  // Footer
  footer: {
    padding: "14px 16px 32px",
    borderTop: "1px solid rgba(184,134,11,0.15)",
    flexShrink: 0,
  },
  closeBtn: {
    width: "100%",
    background: "linear-gradient(135deg, #B8860B, #DAA520, #B8860B)",
    border: "none",
    borderRadius: "14px",
    color: "#000",
    fontSize: "16px",
    fontWeight: 900,
    padding: "16px",
    cursor: "pointer",
    fontFamily: "'Inter', sans-serif",
    letterSpacing: "0.3px",
    boxShadow: "0 4px 24px rgba(184,134,11,0.4)",
  },
};
