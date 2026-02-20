import { createClient } from "@supabase/supabase-js";

let serviceClient: ReturnType<typeof createClient> | null = null;

export function getServiceSupabase() {
  if (serviceClient) return serviceClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase service env vars missing");
  }

  serviceClient = createClient(url, serviceKey);
  return serviceClient;
}
