"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface ClientApiKey {
  apiKey: string | null;
  isLoaded: boolean;
  setApiKey: (key: string) => Promise<void>;
  clearApiKey: () => Promise<void>;
  error: string | null;
}

/**
 * Per-instance active client key, persisted in Supabase via
 * `/api/keys/active`. Any browser opening the dashboard reads the same key —
 * once a key is saved, every other browser/device on this instance picks it
 * up on next load.
 *
 * `isLoaded` flips to `true` after the initial GET. While loading, `apiKey`
 * is `null` — Dashboards should pause polling and show a "configuring" state
 * until `isLoaded` is true.
 */
export function useClientApiKey(): ClientApiKey {
  const [apiKey, setApiKeyState] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/keys/active", { cache: "no-store" });
        if (cancelled) return;
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const body = (await res.json()) as { rawKey?: string | null };
        if (cancelled) return;
        const raw = typeof body.rawKey === "string" ? body.rawKey.trim() : "";
        setApiKeyState(raw === "" ? null : raw);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load active key");
        setApiKeyState(null);
      } finally {
        if (!cancelled) setIsLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setApiKey = useCallback(async (key: string) => {
    const trimmed = key.trim();
    if (trimmed === "") return;
    const res = await fetch("/api/keys/active", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawKey: trimmed }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;
      throw new Error(body?.error ?? `HTTP ${res.status}`);
    }
    if (mountedRef.current) {
      setApiKeyState(trimmed);
      setError(null);
    }
  }, []);

  const clearApiKey = useCallback(async () => {
    const res = await fetch("/api/keys/active", { method: "DELETE" });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;
      throw new Error(body?.error ?? `HTTP ${res.status}`);
    }
    if (mountedRef.current) {
      setApiKeyState(null);
      setError(null);
    }
  }, []);

  return { apiKey, isLoaded, setApiKey, clearApiKey, error };
}

export function authHeaders(apiKey: string | null): Record<string, string> {
  return apiKey ? { "x-api-key": apiKey } : {};
}
