import { createContext, useContext, useState } from "react";
import { DEMO_FLASHES, DEMO_BADGE_IDS } from "@/lib/demoData";
import type { Flash } from "@/types/flash";

interface DemoContextValue {
  isDemo: boolean;
  enterDemo: () => void;
  exitDemo: () => void;
  demoFlashes: Flash[];
  demoBadgeIds: string[];
}

const DemoContext = createContext<DemoContextValue>({
  isDemo: false,
  enterDemo: () => {},
  exitDemo: () => {},
  demoFlashes: [],
  demoBadgeIds: [],
});

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [isDemo, setIsDemo] = useState(false);
  return (
    <DemoContext.Provider value={{
      isDemo,
      enterDemo: () => setIsDemo(true),
      exitDemo: () => setIsDemo(false),
      demoFlashes: DEMO_FLASHES,
      demoBadgeIds: DEMO_BADGE_IDS,
    }}>
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  return useContext(DemoContext);
}
