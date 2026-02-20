import { getAuthProfile } from "@/app/lib/auth";
import { fail, ok } from "@/app/lib/http";

export async function GET() {
  try {
    const profile = await getAuthProfile();
    if (!profile) return fail(new Error("UNAUTHORIZED"), 401);
    return ok(profile);
  } catch (error) {
    return fail(error, 500);
  }
}

