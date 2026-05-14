"use client";

import { useCallback, useEffect, useState } from "react";

interface ApiKeyRecord {
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

interface ApiKeyManagerProps {
  open: boolean;
  onClose: () => void;
}

function formatDate(s: string | null): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}

export function ApiKeyManager({ open, onClose }: ApiKeyManagerProps) {
  const [keys, setKeys] = useState<ApiKeyRecord[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [revealKey, setRevealKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [revokeTarget, setRevokeTarget] = useState<ApiKeyRecord | null>(null);
  const [revokeBusy, setRevokeBusy] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    try {
      setLoadError(null);
      const res = await fetch("/api/keys", { cache: "no-store" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as ApiKeyRecord[];
      setKeys(data);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load keys");
      setKeys([]);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void fetchKeys();
  }, [open, fetchKeys]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (revokeTarget) setRevokeTarget(null);
        else if (revealKey) {
          setRevealKey(null);
          setCopied(false);
        } else if (createOpen) setCreateOpen(false);
        else onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, createOpen, revealKey, revokeTarget, onClose]);

  const submitCreate = useCallback(async () => {
    const name = newName.trim();
    if (!name || createBusy) return;
    setCreateBusy(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const body = (await res.json().catch(() => null)) as
        | { success?: boolean; error?: string; rawKey?: string }
        | null;
      if (!res.ok || body?.success !== true || typeof body.rawKey !== "string") {
        throw new Error(body?.error ?? `Request failed (HTTP ${res.status})`);
      }
      setCreateOpen(false);
      setNewName("");
      setRevealKey(body.rawKey);
      void fetchKeys();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreateBusy(false);
    }
  }, [newName, createBusy, fetchKeys]);

  const submitRevoke = useCallback(async () => {
    if (!revokeTarget || revokeBusy) return;
    setRevokeBusy(true);
    setRevokeError(null);
    try {
      const res = await fetch(`/api/keys/${revokeTarget.id}/revoke`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      setRevokeTarget(null);
      void fetchKeys();
    } catch (e) {
      setRevokeError(e instanceof Error ? e.message : "Revoke failed");
    } finally {
      setRevokeBusy(false);
    }
  }, [revokeTarget, revokeBusy, fetchKeys]);

  const copyRevealed = useCallback(async () => {
    if (!revealKey) return;
    try {
      await navigator.clipboard.writeText(revealKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }, [revealKey]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-gray-900/30 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="API keys"
        className="fixed inset-y-0 right-0 z-40 flex w-full max-w-xl flex-col border-l border-gray-200 bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">API Keys</h2>
            <p className="mt-1 text-xs text-gray-500">
              Tokens with the{" "}
              <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[11px] text-gray-700">
                x-api-key
              </code>{" "}
              header are required for every protected route in this instance.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close API keys panel"
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-5 py-3">
          <span className="text-xs text-gray-500">
            {keys === null
              ? "Loading…"
              : `${keys.length} key${keys.length === 1 ? "" : "s"} total`}
          </span>
          <button
            type="button"
            onClick={() => {
              setCreateError(null);
              setNewName("");
              setCreateOpen(true);
            }}
            className="inline-flex items-center gap-1 rounded-lg bg-teal-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-teal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5"
              aria-hidden
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Generate new key
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loadError ? (
            <div className="mb-3 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-inset ring-rose-200">
              {loadError}
            </div>
          ) : null}

          {keys === null ? (
            <p className="text-sm text-gray-400">Loading keys…</p>
          ) : keys.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
              No keys yet. Generate one to start authenticating requests.
            </div>
          ) : (
            <ul className="space-y-2">
              {keys.map((k) => {
                const revoked = k.is_revoked;
                return (
                  <li
                    key={k.id}
                    className={`rounded-lg border bg-white p-3 transition-shadow hover:shadow-sm ${
                      revoked
                        ? "border-gray-100 opacity-75"
                        : "border-gray-200"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm font-medium ${
                              revoked
                                ? "text-gray-400 line-through"
                                : "text-gray-900"
                            }`}
                          >
                            {k.name}
                          </span>
                          {revoked ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-rose-700 ring-1 ring-inset ring-rose-600/20">
                              <span className="h-1 w-1 rounded-full bg-rose-500" />
                              Revoked
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                              <span className="h-1 w-1 rounded-full bg-emerald-500" />
                              Active
                            </span>
                          )}
                        </div>
                        <div className="mt-1 truncate font-mono text-xs text-gray-500">
                          {k.key_prefix}
                        </div>
                        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-gray-400">
                          <div>
                            <dt className="inline text-gray-400">Created:</dt>{" "}
                            <dd className="inline tabular-nums text-gray-600">
                              {formatDate(k.created_at)}
                            </dd>
                          </div>
                          <div>
                            <dt className="inline text-gray-400">Last used:</dt>{" "}
                            <dd className="inline tabular-nums text-gray-600">
                              {formatDate(k.last_used_at)}
                            </dd>
                          </div>
                          {revoked ? (
                            <div className="col-span-2">
                              <dt className="inline text-gray-400">Revoked:</dt>{" "}
                              <dd className="inline tabular-nums text-rose-600">
                                {formatDate(k.revoked_at)}
                              </dd>
                            </div>
                          ) : null}
                        </dl>
                      </div>
                      {!revoked ? (
                        <button
                          type="button"
                          onClick={() => {
                            setRevokeError(null);
                            setRevokeTarget(k);
                          }}
                          className="shrink-0 rounded-md bg-white px-2.5 py-1 text-xs font-medium text-rose-600 ring-1 ring-inset ring-rose-200 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                        >
                          Revoke
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      {createOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/30 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget && !createBusy)
              setCreateOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl ring-1 ring-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">
              Generate API key
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Pick a name that describes what this key is for (e.g.{" "}
              <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[11px] text-gray-700">
                nexus-orchestrator
              </code>
              ).
            </p>
            <form
              className="mt-4 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void submitCreate();
              }}
            >
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
                  Key name
                </span>
                <input
                  autoFocus
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  disabled={createBusy}
                  className="mt-2 w-full rounded-lg border-0 bg-gray-50 px-3 py-2 text-gray-900 ring-1 ring-inset ring-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-60"
                />
              </label>
              {createError ? (
                <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
                  {createError}
                </p>
              ) : null}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  disabled={createBusy}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newName.trim() || createBusy}
                  className="rounded-lg bg-teal-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {createBusy ? "Generating…" : "Generate"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {revealKey ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl ring-1 ring-amber-200">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                  aria-hidden
                >
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Save this key now
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  This key will <strong>never be shown again</strong>. Copy it
                  and store it somewhere safe.
                </p>
              </div>
            </div>
            <div className="mt-4 break-all rounded-lg bg-gray-50 px-3 py-3 font-mono text-sm text-gray-900 ring-1 ring-inset ring-gray-200">
              {revealKey}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => void copyRevealed()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-medium text-teal-700 ring-1 ring-inset ring-teal-200 hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                  aria-hidden
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                {copied ? "Copied!" : "Copy"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setRevealKey(null);
                  setCopied(false);
                }}
                className="rounded-lg bg-teal-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
              >
                I have saved it
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {revokeTarget ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/30 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget && !revokeBusy)
              setRevokeTarget(null);
          }}
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl ring-1 ring-rose-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Revoke this key?
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Anything using{" "}
              <span className="font-medium text-gray-800">
                {revokeTarget.name}
              </span>{" "}
              will start receiving{" "}
              <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[11px] text-gray-700">
                401
              </code>{" "}
              responses. This cannot be undone.
            </p>
            <div className="mt-3 rounded-md bg-gray-50 px-3 py-2 font-mono text-xs text-gray-600 ring-1 ring-inset ring-gray-200">
              {revokeTarget.key_prefix}
            </div>
            {revokeError ? (
              <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
                {revokeError}
              </p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRevokeTarget(null)}
                disabled={revokeBusy}
                className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitRevoke()}
                disabled={revokeBusy}
                className="rounded-lg bg-rose-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {revokeBusy ? "Revoking…" : "Revoke key"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
