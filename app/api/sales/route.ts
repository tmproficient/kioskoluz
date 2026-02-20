import { requireAuthProfile } from "@/app/lib/auth";
import { fail, ok } from "@/app/lib/http";
import { getServerSupabase } from "@/app/lib/supabase/server";

export async function GET() {
  try {
    await requireAuthProfile();
    const supabase = await getServerSupabase();
    const { data, error } = await supabase
      .from("sales")
      .select("id, created_at, total, payment_method, created_by")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return ok(data);
  } catch (error) {
    const msg = (error as Error).message;
    return fail(error, msg === "UNAUTHORIZED" ? 401 : 500);
  }
}

