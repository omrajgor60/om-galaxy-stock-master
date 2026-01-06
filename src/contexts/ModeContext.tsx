import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type AppMode = "admin" | "staff";

interface ModeContextType {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  isAdmin: boolean;
}

const ModeContext = createContext<ModeContextType | undefined>(undefined);

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<AppMode>(() => {
    const saved = localStorage.getItem("app_mode");
    return (saved as AppMode) || "admin";
  });

  useEffect(() => {
    localStorage.setItem("app_mode", mode);
  }, [mode]);

  const setMode = (newMode: AppMode) => {
    setModeState(newMode);
  };

  return (
    <ModeContext.Provider
      value={{
        mode,
        setMode,
        isAdmin: mode === "admin",
      }}
    >
      {children}
    </ModeContext.Provider>
  );
}

export function useMode() {
  const context = useContext(ModeContext);
  if (context === undefined) {
    throw new Error("useMode must be used within a ModeProvider");
  }
  return context;
}
