import { NextRequest } from "next/server";
import { createProduct, listProducts } from "@/app/lib/db";
import { fail, ok } from "@/app/lib/http";
import { productSchema } from "@/app/lib/validation";

export async function GET() {
  try {
    const data = await listProducts();
    return ok(data);
  } catch (error) {
    return fail(error, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const parsed = productSchema.parse(payload);
    const created = await createProduct(parsed);
    return ok(created, 201);
  } catch (error) {
    return fail(error, 400);
  }
}