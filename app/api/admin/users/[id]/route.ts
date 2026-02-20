import { NextRequest } from "next/server";
import { requireAuthProfile } from "@/app/lib/auth";
import { fail, ok } from "@/app/lib/http";
import { getServiceSupabase } from "@/app/lib/supabase/service";
import { updateUserSchema } from "@/app/lib/validation";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuthProfile("admin");
    const { id } = await context.params;
    const payload = await request.json();
    const parsed = updateUserSchema.parse(payload);
    const serviceSupabase = getServiceSupabase();

    const { error: authError } = await serviceSupabase.auth.admin.updateUserById(id, {
      user_metadata: { full_name: parsed.full_name }
    });
    if (authError) throw authError;

    const { error: profileError } = await (serviceSupabase.from("profiles") as any).upsert({
      id,
      full_name: parsed.full_name,
      role: parsed.role
    });
    if (profileError) throw profileError;

    return ok({ success: true });
  } catch (error) {
    const msg = (error as Error).message;
    if (msg === "UNAUTHORIZED") return fail(error, 401);
    if (msg === "FORBIDDEN") return fail(error, 403);
    return fail(error, 400);
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAuthProfile("admin");
    const { id } = await context.params;
    if (id === admin.id) {
      return fail(new Error("No puedes eliminar tu propio usuario"), 400);
    }

    const serviceSupabase = getServiceSupabase();
    const { error } = await serviceSupabase.auth.admin.deleteUser(id);
    if (error) throw error;

    return ok({ success: true });
  } catch (error) {
    const msg = (error as Error).message;
    if (msg === "UNAUTHORIZED") return fail(error, 401);
    if (msg === "FORBIDDEN") return fail(error, 403);
    return fail(error, 400);
  }
}

