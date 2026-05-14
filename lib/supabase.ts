import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (cached) return cached;

  const url =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    "";

  if (!url || !key) {
    throw new Error(
      "Supabase env vars missing. Set SUPABASE_URL and either SUPABASE_SERVICE_ROLE_KEY (preferred) or SUPABASE_ANON_KEY.",
    );
  }

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export function getInstanceName(): string {
  const raw = process.env.INSTANCE_NAME;
  const name = raw?.trim() ?? "";
  if (name === "") {
    throw new Error("INSTANCE_NAME env var is not set.");
  }
  return name;
}

export const ORDERS_TABLE = "orders";
