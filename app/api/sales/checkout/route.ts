import { NextRequest } from "next/server";
import { requireAuthProfile } from "@/app/lib/auth";
import { fail, ok } from "@/app/lib/http";
import { getServerSupabase } from "@/app/lib/supabase/server";
import { checkoutSchema } from "@/app/lib/validation";

export async function POST(request: NextRequest) {
  try {
    await requireAuthProfile();
    const payload = await request.json();
    const parsed = checkoutSchema.parse(payload);

    const supabase = await getServerSupabase();
    const { data: result, error } = await supabase.rpc("create_sale", {
      p_items: parsed.items,
      p_payment_method: parsed.paymentMethod
    });

    if (error) throw error;
    return ok(result, 201);
  } catch (error) {
    const msg = (error as Error).message;
    return fail(error, msg === "UNAUTHORIZED" ? 401 : 400);
  }
}
