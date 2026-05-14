import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Service-role-only client — never call from the browser.
function getAdminClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) {
    throw new Error(
      "Supabase admin env vars missing. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function hashKey(raw: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateRawKey(prefix: string): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${prefix}${hex}`;
}

export interface ApiKeyRecord {
  id: string;
  app_type: string;
  instance_name: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  is_revoked: boolean;
}

export async function createApiKey(
  appType: string,
  instanceName: string,
  keyPrefix: string,
  name: string,
): Promise<{ record: ApiKeyRecord; rawKey: string }> {
  const supabase = getAdminClient();
  const rawKey = generateRawKey(keyPrefix);
  const keyHash = await hashKey(rawKey);
  const displayPrefix = rawKey.slice(0, 16) + "...";

  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      app_type: appType,
      instance_name: instanceName,
      name,
      key_prefix: displayPrefix,
      key_hash: keyHash,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create key");
  }
  return { record: data as ApiKeyRecord, rawKey };
}

export async function listApiKeys(
  appType: string,
  instanceName: string,
): Promise<ApiKeyRecord[]> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("api_keys")
    .select(
      "id, app_type, instance_name, name, key_prefix, created_at, last_used_at, revoked_at, is_revoked",
    )
    .eq("app_type", appType)
    .eq("instance_name", instanceName)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return ((data as ApiKeyRecord[] | null) ?? []);
}

export async function revokeApiKey(
  id: string,
  appType: string,
  instanceName: string,
): Promise<void> {
  const supabase = getAdminClient();
  const { error } = await supabase
    .from("api_keys")
    .update({ is_revoked: true, revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("app_type", appType)
    .eq("instance_name", instanceName);

  if (error) throw new Error(error.message);
}

export async function verifyApiKey(raw: string): Promise<ApiKeyRecord | null> {
  const supabase = getAdminClient();
  const keyHash = await hashKey(raw);

  const { data, error } = await supabase
    .from("api_keys")
    .select("*")
    .eq("key_hash", keyHash)
    .eq("is_revoked", false)
    .maybeSingle();

  if (error || !data) return null;

  // Fire-and-forget last_used_at update.
  void supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", (data as ApiKeyRecord).id);

  return data as ApiKeyRecord;
}
