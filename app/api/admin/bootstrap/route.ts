import { NextRequest } from "next/server";
import { internalEmailFromUsername, normalizeUsername } from "@/app/lib/identity";
import { fail, ok } from "@/app/lib/http";
import { getServiceSupabase } from "@/app/lib/supabase/service";

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("x-seed-token");
    if (!process.env.SEED_TOKEN || token !== process.env.SEED_TOKEN) {
      return fail(new Error("No autorizado"), 401);
    }

    const payload = await request.json().catch(() => ({}));
    const rawUsername = (payload?.username as string | undefined)?.trim();
    const password = payload?.password as string | undefined;
    const fullName = ((payload?.full_name as string | undefined) ?? "Luz").trim();

    if (!rawUsername || !password || password.length < 6) {
      return fail(new Error("username/password invalidos"), 400);
    }
    const username = normalizeUsername(rawUsername);
    const email = internalEmailFromUsername(username);

    const serviceSupabase = getServiceSupabase();

    const { data: admins, error: adminsError } = await (serviceSupabase.from("profiles") as any)
      .select("id")
      .eq("role", "admin")
      .limit(1);
    if (adminsError) throw adminsError;
    if (admins && admins.length > 0) {
      return fail(new Error("Ya existe un admin"), 409);
    }

    const { data, error } = await serviceSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, username }
    });
    if (error || !data.user) throw error ?? new Error("No se pudo crear admin");

    const { error: profileError } = await (serviceSupabase.from("profiles") as any).upsert({
      id: data.user.id,
      username,
      full_name: fullName,
      role: "admin"
    });
    if (profileError) throw profileError;

    return ok({
      success: true,
      user: { id: data.user.id, username, role: "admin" }
    });
  } catch (error) {
    return fail(error, 400);
  }
}
