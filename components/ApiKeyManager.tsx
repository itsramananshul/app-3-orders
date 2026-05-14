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
      // ignore — UI still shows the key
    }
  }, [revealKey]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="API keys"
        className="fixed inset-y-0 right-0 z-40 flex w-full max-w-xl flex-col border-l border-slate-700 bg-slate-900 shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              <span aria-hidden className="mr-2">
                🔑
              </span>
              API Keys
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Tokens with the <code className="text-slate-300">x-api-key</code>{" "}
              header are required for every protected route in this instance.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close API keys panel"
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
          >
            <span aria-hidden className="text-2xl leading-none">
              ×
            </span>
          </button>
        </header>

        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
          <span className="text-xs text-slate-400">
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
            className="inline-flex items-center gap-1 rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            + Generate new key
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loadError ? (
            <div className="mb-3 rounded-md bg-rose-500/10 px-3 py-2 text-xs text-rose-300 ring-1 ring-inset ring-rose-500/30">
              {loadError}
            </div>
          ) : null}

          {keys === null ? (
            <p className="text-sm text-slate-500">Loading keys…</p>
          ) : keys.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 px-4 py-10 text-center text-sm text-slate-500">
              No keys yet. Generate one to start authenticating requests.
            </div>
          ) : (
            <ul className="space-y-2">
              {keys.map((k) => {
                const revoked = k.is_revoked;
                return (
                  <li
                    key={k.id}
                    className={`rounded-lg border bg-slate-900/50 p-3 ${
                      revoked
                        ? "border-slate-800 opacity-70"
                        : "border-slate-700"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm font-medium ${
                              revoked
                                ? "text-slate-400 line-through"
                                : "text-slate-100"
                            }`}
                          >
                            {k.name}
                          </span>
                          {revoked ? (
                            <span className="rounded-sm bg-slate-700 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
                              Revoked
                            </span>
                          ) : (
                            <span className="rounded-sm bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300 ring-1 ring-inset ring-emerald-500/30">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="mt-1 truncate font-mono text-xs text-slate-400">
                          {k.key_prefix}
                        </div>
                        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                          <div>
                            <dt className="inline text-slate-600">Created:</dt>{" "}
                            <dd className="inline text-slate-400 tabular-nums">
                              {formatDate(k.created_at)}
                            </dd>
                          </div>
                          <div>
                            <dt className="inline text-slate-600">
                              Last used:
                            </dt>{" "}
                            <dd className="inline text-slate-400 tabular-nums">
                              {formatDate(k.last_used_at)}
                            </dd>
                          </div>
                          {revoked ? (
                            <div className="col-span-2">
                              <dt className="inline text-slate-600">
                                Revoked:
                              </dt>{" "}
                              <dd className="inline text-rose-300/80 tabular-nums">
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
                          className="shrink-0 rounded-md bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-300 ring-1 ring-inset ring-rose-500/30 hover:bg-rose-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget && !createBusy) setCreateOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-xl bg-slate-900 p-6 shadow-2xl ring-1 ring-slate-700">
            <h3 className="text-lg font-semibold text-slate-100">
              Generate API key
            </h3>
            <p className="mt-1 text-sm text-slate-400">
              Pick a name that describes what this key is for (e.g.{" "}
              <code className="text-slate-300">nexus-orchestrator</code>).
            </p>
            <form
              className="mt-4 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void submitCreate();
              }}
            >
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  Key name
                </span>
                <input
                  autoFocus
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  disabled={createBusy}
                  className="mt-2 w-full rounded-lg border-0 bg-slate-800 px-3 py-2 text-slate-100 ring-1 ring-inset ring-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-60"
                />
              </label>
              {createError ? (
                <p className="rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-300 ring-1 ring-inset ring-rose-500/30">
                  {createError}
                </p>
              ) : null}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  disabled={createBusy}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newName.trim() || createBusy}
                  className="rounded-lg bg-sky-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-lg rounded-xl bg-slate-900 p-6 shadow-2xl ring-1 ring-amber-500/40">
            <h3 className="text-lg font-semibold text-slate-100">
              <span aria-hidden className="mr-1">
                ⚠
              </span>
              Save this key now
            </h3>
            <p className="mt-1 text-sm text-amber-200/90">
              This key will <strong>never be shown again</strong>. Copy it now
              and store it somewhere safe.
            </p>
            <div className="mt-4 break-all rounded-lg bg-slate-950 px-3 py-3 font-mono text-sm text-emerald-300 ring-1 ring-inset ring-slate-800">
              {revealKey}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => void copyRevealed()}
                className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-slate-100 ring-1 ring-inset ring-slate-700 hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
              >
                {copied ? "Copied!" : "Copy to clipboard"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setRevealKey(null);
                  setCopied(false);
                }}
                className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget && !revokeBusy) setRevokeTarget(null);
          }}
        >
          <div className="w-full max-w-md rounded-xl bg-slate-900 p-6 shadow-2xl ring-1 ring-rose-500/40">
            <h3 className="text-lg font-semibold text-slate-100">
              Revoke this key?
            </h3>
            <p className="mt-1 text-sm text-slate-400">
              Anything using <span className="text-slate-200">{revokeTarget.name}</span>{" "}
              will start receiving <code className="text-slate-300">401</code>{" "}
              responses. This cannot be undone.
            </p>
            <div className="mt-3 rounded-md bg-slate-800/60 px-3 py-2 font-mono text-xs text-slate-400 ring-1 ring-inset ring-slate-700">
              {revokeTarget.key_prefix}
            </div>
            {revokeError ? (
              <p className="mt-3 rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-300 ring-1 ring-inset ring-rose-500/30">
                {revokeError}
              </p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRevokeTarget(null)}
                disabled={revokeBusy}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitRevoke()}
                disabled={revokeBusy}
                className="rounded-lg bg-rose-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
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
