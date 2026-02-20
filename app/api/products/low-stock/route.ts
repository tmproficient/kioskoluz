import { requireAuthProfile } from "@/app/lib/auth";
import { fail, ok } from "@/app/lib/http";
import { getServerSupabase } from "@/app/lib/supabase/server";

export async function GET() {
  try {
    await requireAuthProfile();
    const supabase = await getServerSupabase();
    const { data, error } = await supabase
      .from("products")
      .select("id, name, price, stock, barcode, created_at, updated_at")
      .lte("stock", 3)
      .order("stock", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw error;
    return ok(data);
  } catch (error) {
    const msg = (error as Error).message;
    return fail(error, msg === "UNAUTHORIZED" ? 401 : 500);
  }
}

