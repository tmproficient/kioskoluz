import { getDashboardData } from "@/app/lib/db";
import { fail, ok } from "@/app/lib/http";

export async function GET() {
  try {
    const data = await getDashboardData();
    return ok(data);
  } catch (error) {
    return fail(error, 500);
  }
}