import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const WINTER_EFFECTS_KEY = "tnc-winter-effects-enabled";

interface WinterEffectsContextValue {
  enabled: boolean;
  toggle: () => void;
}

const WinterEffectsContext = createContext<WinterEffectsContextValue | null>(null);

function getInitialPreference(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const savedPreference = window.localStorage.getItem(WINTER_EFFECTS_KEY);
    if (savedPreference !== null) return savedPreference === "true";
  } catch {
    return false;
  }
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useWinterEffects(): WinterEffectsContextValue {
  const context = useContext(WinterEffectsContext);
  if (!context) throw new Error("useWinterEffects must be used within WinterEffectsProvider");
  return context;
}

export default function WinterEffectsProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(getInitialPreference);

  useEffect(() => {
    const syncPreference = (event: StorageEvent) => {
      if (event.key !== WINTER_EFFECTS_KEY) return;
      setEnabled(event.newValue === null
        ? !window.matchMedia("(prefers-reduced-motion: reduce)").matches
        : event.newValue === "true");
    };
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotionPreference = (event: MediaQueryListEvent) => {
      try {
        if (window.localStorage.getItem(WINTER_EFFECTS_KEY) === null) setEnabled(!event.matches);
      } catch {
        setEnabled(!event.matches);
      }
    };
    window.addEventListener("storage", syncPreference);
    motionPreference.addEventListener("change", syncMotionPreference);
    return () => {
      window.removeEventListener("storage", syncPreference);
      motionPreference.removeEventListener("change", syncMotionPreference);
    };
  }, []);

  function toggle() {
    setEnabled((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(WINTER_EFFECTS_KEY, String(next));
      } catch {
        // Keep the in-memory preference if storage is unavailable.
      }
      return next;
    });
  }

  return (
    <WinterEffectsContext.Provider value={{ enabled, toggle }}>
      {children}
    </WinterEffectsContext.Provider>
  );
}