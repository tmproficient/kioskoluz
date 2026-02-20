import { NextRequest } from "next/server";
import { checkoutSale } from "@/app/lib/db";
import { fail, ok } from "@/app/lib/http";
import { checkoutSchema } from "@/app/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const parsed = checkoutSchema.parse(payload);
    const result = await checkoutSale(parsed);
    return ok(result, 201);
  } catch (error) {
    return fail(error, 400);
  }
}