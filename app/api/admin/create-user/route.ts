import { NextRequest } from "next/server";
import { requireAuthProfile } from "@/app/lib/auth";
import { fail, ok } from "@/app/lib/http";
import { getServiceSupabase } from "@/app/lib/supabase/service";
import { createUserSchema } from "@/app/lib/validation";

export async function POST(request: NextRequest) {
  try {
    await requireAuthProfile("admin");
    const serviceSupabase = getServiceSupabase();
    const payload = await request.json();
    const parsed = createUserSchema.parse(payload);

    const { data, error } = await serviceSupabase.auth.admin.createUser({
      email: parsed.email,
      password: parsed.password,
      email_confirm: true,
      user_metadata: { full_name: parsed.full_name }
    });
    if (error || !data.user) throw error ?? new Error("No se pudo crear usuario");

    const { error: profileError } = await (serviceSupabase.from("profiles") as any).upsert({
      id: data.user.id,
      full_name: parsed.full_name,
      role: parsed.role
    });
    if (profileError) throw profileError;

    return ok({
      user: {
        id: data.user.id,
        email: data.user.email,
        role: parsed.role
      }
    });
  } catch (error) {
    const msg = (error as Error).message;
    if (msg === "UNAUTHORIZED") return fail(error, 401);
    if (msg === "FORBIDDEN") return fail(error, 403);
    return fail(error, 400);
  }
}
