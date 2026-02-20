import { NextRequest } from "next/server";
import { initSchema, seedDemoData } from "@/app/lib/db";
import { fail, ok } from "@/app/lib/http";

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("x-seed-token");
    const expected = process.env.SEED_TOKEN;

    if (!expected || token !== expected) {
      return fail(new Error("No autorizado"), 401);
    }

    await initSchema();
    await seedDemoData();
    return ok({ success: true });
  } catch (error) {
    return fail(error, 500);
  }
}