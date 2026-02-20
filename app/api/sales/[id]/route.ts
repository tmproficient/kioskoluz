import { NextRequest } from "next/server";
import { requireAuthProfile } from "@/app/lib/auth";
import { fail, ok } from "@/app/lib/http";
import { getServerSupabase } from "@/app/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuthProfile();
    const { id } = await context.params;
    const supabase = await getServerSupabase();

    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .select("id, created_at, total, payment_method, created_by")
      .eq("id", id)
      .single();
    if (saleError) throw saleError;

    const { data: items, error: itemsError } = await supabase
      .from("sale_items")
      .select("id, qty, unit_price, line_total, product_id, products(name, barcode)")
      .eq("sale_id", id);
    if (itemsError) throw itemsError;

    return ok({ ...sale, items });
  } catch (error) {
    const msg = (error as Error).message;
    return fail(error, msg === "UNAUTHORIZED" ? 401 : 500);
  }
}

