import { NextRequest } from "next/server";
import { internalEmailFromUsername, normalizeUsername } from "@/app/lib/identity";
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
    const username = normalizeUsername(parsed.username);

    const { data: existingProfile, error: existingError } = await (serviceSupabase
      .from("profiles") as any)
      .select("id")
      .eq("username", username)
      .neq("id", id)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existingProfile) throw new Error("Username ya existe");

    const { error: authError } = await serviceSupabase.auth.admin.updateUserById(id, {
      email: internalEmailFromUsername(username),
      user_metadata: { full_name: parsed.full_name, username }
    });
    if (authError) throw authError;

    const { error: profileError } = await (serviceSupabase.from("profiles") as any).upsert({
      id,
      username,
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
  const step: "auth" | "validate_id" | "check_sales" | "delete_user" = "auth";
  try {
    const admin = await requireAuthProfile("admin");
    const { id } = await context.params;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return Response.json(
        {
          error: "ID de usuario invalido",
          statusCode: 400,
          code: "INVALID_USER_ID",
          step: "validate_id"
        },
        { status: 400 }
      );
    }
    if (id === admin.id) {
      return Response.json(
        {
          error: "No puedes eliminar tu propio usuario",
          statusCode: 400,
          code: "SELF_DELETE_BLOCKED",
          step: "validate_id"
        },
        { status: 400 }
      );
    }

    const serviceSupabase = getServiceSupabase();
    const { count: salesCount, error: salesError } = await (serviceSupabase
      .from("sales") as any)
      .select("id", { count: "exact", head: true })
      .eq("created_by", id);
    if (salesError) throw decorateAdminError(salesError, "check_sales");
    if ((salesCount ?? 0) > 0) {
      return Response.json(
        {
          error: "No se puede eliminar: el usuario tiene ventas registradas",
          statusCode: 409,
          code: "USER_HAS_SALES",
          details: `ventas=${salesCount}`,
          step: "check_sales"
        },
        { status: 409 }
      );
    }

    const { error } = await serviceSupabase.auth.admin.deleteUser(id);
    if (error) throw decorateAdminError(error, "delete_user");

    return ok({ success: true });
  } catch (rawError) {
    const error = rawError as any;
    console.error("[admin_delete_user_error]", {
      statusCode: Number(error?.statusCode ?? 400),
      code: error?.code ?? null,
      message: error?.message ?? "Error inesperado",
      hint: error?.hint ?? null,
      details: error?.details ?? null,
      step: error?.step ?? step,
      at: new Date().toISOString()
    });

    const msg = (error as Error).message;
    if (msg === "UNAUTHORIZED") return fail(error, 401);
    if (msg === "FORBIDDEN") return fail(error, 403);
    return Response.json(
      {
        error: error?.message ?? "No se pudo eliminar",
        statusCode: Number(error?.statusCode ?? 400),
        code: error?.code ?? null,
        hint: error?.hint ?? null,
        details: error?.details ?? null,
        step: error?.step ?? step
      },
      { status: Number(error?.statusCode ?? 400) }
    );
  }
}

function decorateAdminError(error: any, step: string) {
  return {
    statusCode: Number(error?.status ?? 400),
    code: error?.code ?? null,
    message: error?.message ?? "Error inesperado",
    hint: error?.hint ?? null,
    details: error?.details ?? null,
    step
  };
}
