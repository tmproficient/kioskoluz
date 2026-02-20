"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import { getBrowserSupabase } from "@/app/lib/supabase/browser";
import type { AppRole } from "@/app/lib/auth";

type AuthUser = {
  id: string;
  username: string;
  fullName: string | null;
  role: AppRole;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = getBrowserSupabase();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const {
      data: { user: authUser }
    } = await supabase.auth.getUser();

    if (!authUser) {
      setUser(null);
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("username, full_name, role")
      .eq("id", authUser.id)
      .single();

    setUser({
      id: authUser.id,
      username: profile?.username ?? (authUser.email?.split("@")[0] ?? ""),
      fullName: profile?.full_name ?? null,
      role: (profile?.role as AppRole) ?? "seller"
    });
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void refresh();
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(() => {
      void refresh();
    });

    return () => subscription.unsubscribe();
  }, [supabase, refresh]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, [supabase]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, refresh, logout }),
    [user, loading, refresh, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
