import { NextRequest } from "next/server";
import { requireAuthProfile } from "@/app/lib/auth";
import { fail, ok } from "@/app/lib/http";
import { getServerSupabase } from "@/app/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ barcode: string }> }
) {
  try {
    await requireAuthProfile();
    const { barcode } = await context.params;
    const supabase = await getServerSupabase();
    const { data: product, error } = await supabase
      .from("products")
      .select("id, name, price, stock, barcode, created_at, updated_at")
      .eq("barcode", barcode)
      .maybeSingle();
    if (error) throw error;
    return ok(product);
  } catch (error) {
    const msg = (error as Error).message;
    return fail(error, msg === "UNAUTHORIZED" ? 401 : 500);
  }
}
