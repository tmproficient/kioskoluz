import { getServerSupabase } from "@/app/lib/supabase/server";

export type AppRole = "admin" | "seller";

export type AuthProfile = {
  id: string;
  email: string;
  full_name: string | null;
  role: AppRole;
};

export async function getAuthProfile(): Promise<AuthProfile | null> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) return null;

  return {
    id: user.id,
    email: user.email ?? "",
    full_name: profile.full_name,
    role: profile.role as AppRole
  };
}

export async function requireAuthProfile(requiredRole?: AppRole) {
  const profile = await getAuthProfile();
  if (!profile) throw new Error("UNAUTHORIZED");
  if (requiredRole && profile.role !== requiredRole) throw new Error("FORBIDDEN");
  return profile;
}

