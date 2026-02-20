import { NextRequest } from "next/server";
import { requireAuthProfile } from "@/app/lib/auth";
import { getServerSupabase } from "@/app/lib/supabase/server";
import { fail, ok } from "@/app/lib/http";
import { generateBarcodeCandidate } from "@/app/lib/barcode";
import { productSchema } from "@/app/lib/validation";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuthProfile();
    const { id } = await context.params;
    const payload = await request.json();
    const parsed = productSchema.parse(payload);

    const supabase = await getServerSupabase();
    let barcode = parsed.barcode?.trim();
    if (!barcode) {
      for (let i = 0; i < 50; i += 1) {
        const candidate = generateBarcodeCandidate();
        const { data: found } = await supabase
          .from("products")
          .select("id")
          .eq("barcode", candidate)
          .neq("id", id)
          .limit(1);
        if (!found || found.length === 0) {
          barcode = candidate;
          break;
        }
      }
      if (!barcode) throw new Error("No se pudo generar barcode unico");
    }

    const { data: updated, error } = await supabase
      .from("products")
      .update({
        name: parsed.name.trim(),
        price: parsed.price,
        stock: parsed.stock,
        barcode
      })
      .eq("id", id)
      .select("id, name, price, stock, barcode, created_at, updated_at")
      .single();
    if (error) throw error;
    return ok(updated);
  } catch (error) {
    const msg = (error as Error).message;
    return fail(error, msg === "UNAUTHORIZED" ? 401 : 400);
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuthProfile();
    const { id } = await context.params;
    const supabase = await getServerSupabase();
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) throw error;
    return ok({ success: true });
  } catch (error) {
    const msg = (error as Error).message;
    return fail(error, msg === "UNAUTHORIZED" ? 401 : 400);
  }
}
