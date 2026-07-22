import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";

type AppMode = "admin" | "staff";

// Backwards-compat adapter: `mode` is now derived from the authenticated user's role.
// `setMode` is a no-op — role changes happen server-side via user_roles.
export function ModeProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useMode(): { mode: AppMode; setMode: (m: AppMode) => void; isAdmin: boolean } {
  const { role } = useAuth();
  const mode: AppMode = role === "admin" ? "admin" : "staff";
  return {
    mode,
    setMode: () => {},
    isAdmin: role === "admin",
  };
}
