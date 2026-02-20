import { requireAuthProfile } from "@/app/lib/auth";
import { fail, ok } from "@/app/lib/http";
import { getServiceSupabase } from "@/app/lib/supabase/service";

type AdminUserRow = {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "seller";
  created_at: string;
  last_sign_in_at: string | null;
};

export async function GET() {
  try {
    await requireAuthProfile("admin");
    const serviceSupabase = getServiceSupabase();

    const { data: usersData, error: usersError } =
      await serviceSupabase.auth.admin.listUsers({
        page: 1,
        perPage: 1000
      });
    if (usersError) throw usersError;

    const users = usersData.users ?? [];
    const ids = users.map((u) => u.id);
    let profilesMap = new Map<string, { full_name: string; role: "admin" | "seller" }>();

    if (ids.length > 0) {
      const { data: profiles, error: profilesError } = await (serviceSupabase
        .from("profiles") as any)
        .select("id, full_name, role")
        .in("id", ids);
      if (profilesError) throw profilesError;

      profilesMap = new Map(
        (profiles ?? []).map((p: any) => [
          p.id,
          {
            full_name: p.full_name ?? "",
            role: (p.role ?? "seller") as "admin" | "seller"
          }
        ])
      );
    }

    const rows: AdminUserRow[] = users.map((u) => {
      const p = profilesMap.get(u.id);
      return {
        id: u.id,
        email: u.email ?? "",
        full_name: p?.full_name ?? ((u.user_metadata?.full_name as string | undefined) ?? ""),
        role: p?.role ?? "seller",
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null
      };
    });

    return ok(rows);
  } catch (error) {
    const msg = (error as Error).message;
    if (msg === "UNAUTHORIZED") return fail(error, 401);
    if (msg === "FORBIDDEN") return fail(error, 403);
    return fail(error, 500);
  }
}
