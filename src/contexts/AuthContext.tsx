import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "admin" | "staff" | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole;
  profile: {
    id: string;
    full_name: string;
    phone: string | null;
    avatar_url: string | null;
  } | null;
  isLoading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole>(null);
  const [profile, setProfile] = useState<AuthContextType["profile"]>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserRole = async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();
    return (data?.role as AppRole) || null;
  };

  const fetchUserProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, phone, avatar_url")
      .eq("user_id", userId)
      .single();
    return data;
  };

  const refreshRole = async () => {
    if (user) {
      const userRole = await fetchUserRole(user.id);
      setRole(userRole);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        // Defer data fetching to avoid deadlock
        if (currentSession?.user) {
          setTimeout(async () => {
            const [userRole, userProfile] = await Promise.all([
              fetchUserRole(currentSession.user.id),
              fetchUserProfile(currentSession.user.id),
            ]);
            setRole(userRole);
            setProfile(userProfile);
            setIsLoading(false);
          }, 0);
        } else {
          setRole(null);
          setProfile(null);
          setIsLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setUser(existingSession?.user ?? null);

      if (existingSession?.user) {
        Promise.all([
          fetchUserRole(existingSession.user.id),
          fetchUserProfile(existingSession.user.id),
        ]).then(([userRole, userProfile]) => {
          setRole(userRole);
          setProfile(userProfile);
          setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        role,
        profile,
        isLoading,
        isAdmin: role === "admin",
        signIn,
        signOut,
        refreshRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
