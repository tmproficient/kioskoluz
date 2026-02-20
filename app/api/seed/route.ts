import { NextRequest } from "next/server";
import { generateBarcodeCandidate } from "@/app/lib/barcode";
import { fail, ok } from "@/app/lib/http";
import { getServiceSupabase } from "@/app/lib/supabase/service";

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("x-seed-token");
    const expected = process.env.SEED_TOKEN;

    if (!expected || token !== expected) {
      return fail(new Error("No autorizado"), 401);
    }

    const serviceSupabase = getServiceSupabase();
    const { count } = await serviceSupabase
      .from("products")
      .select("id", { count: "exact", head: true });

    if ((count ?? 0) === 0) {
      const demo = [
        { name: "Coca Cola 500ml", price: 1800, stock: 12 },
        { name: "Papas Clasicas 100g", price: 2200, stock: 7 },
        { name: "Chocolate Barra", price: 1500, stock: 3 },
        { name: "Agua Sin Gas 600ml", price: 1200, stock: 15 },
        { name: "Galletas Vainilla", price: 2000, stock: 2 },
        { name: "Caramelos Menta x10", price: 1000, stock: 20 }
      ];

      const payload = demo.map((item) => ({
        ...item,
        barcode: generateBarcodeCandidate()
      }));

      const { error } = await (serviceSupabase.from("products") as any).insert(payload);
      if (error) throw error;
    }

    return ok({ success: true });
  } catch (error) {
    return fail(error, 500);
  }
}
