import { NextRequest } from "next/server";
import { findProductByBarcode } from "@/app/lib/db";
import { fail, ok } from "@/app/lib/http";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ barcode: string }> }
) {
  try {
    const { barcode } = await context.params;
    const product = await findProductByBarcode(barcode);
    return ok(product);
  } catch (error) {
    return fail(error, 500);
  }
}

