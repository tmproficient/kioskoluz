import { NextRequest } from "next/server";
import { requireAuthProfile } from "@/app/lib/auth";
import { generateBarcodeCandidate } from "@/app/lib/barcode";
import { fail, ok } from "@/app/lib/http";
import { getServerSupabase } from "@/app/lib/supabase/server";
import { productSchema } from "@/app/lib/validation";

export async function GET() {
  try {
    await requireAuthProfile();
    const supabase = await getServerSupabase();
    const { data, error } = await supabase
      .from("products")
      .select("id, name, price, stock, barcode, created_at, updated_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return ok(data);
  } catch (error) {
    return fail(error, (error as Error).message === "UNAUTHORIZED" ? 401 : 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuthProfile();
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
          .limit(1);
        if (!found || found.length === 0) {
          barcode = candidate;
          break;
        }
      }
      if (!barcode) throw new Error("No se pudo generar barcode unico");
    }

    const { data: created, error } = await supabase
      .from("products")
      .insert({
        name: parsed.name.trim(),
        price: parsed.price,
        stock: parsed.stock,
        barcode
      })
      .select("id, name, price, stock, barcode, created_at, updated_at")
      .single();

    if (error) throw error;
    return ok(created, 201);
  } catch (error) {
    const msg = (error as Error).message;
    return fail(error, msg === "UNAUTHORIZED" ? 401 : 400);
  }
}
