import { NextRequest } from "next/server";
import { deleteProduct, updateProduct } from "@/app/lib/db";
import { fail, ok } from "@/app/lib/http";
import { productSchema } from "@/app/lib/validation";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const payload = await request.json();
    const parsed = productSchema.parse(payload);
    const updated = await updateProduct(id, parsed);
    return ok(updated);
  } catch (error) {
    return fail(error, 400);
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    await deleteProduct(id);
    return ok({ success: true });
  } catch (error) {
    return fail(error, 400);
  }
}

