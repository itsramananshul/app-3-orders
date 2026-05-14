"use client";

import { useEffect, useRef, useState } from "react";

interface NoteModalProps {
  open: boolean;
  orderNumber: string;
  existingNotes: string;
  busy?: boolean;
  errorMessage?: string | null;
  onCancel: () => void;
  onSubmit: (note: string) => void;
}

export function NoteModal({
  open,
  orderNumber,
  existingNotes,
  busy = false,
  errorMessage,
  onCancel,
  onSubmit,
}: NoteModalProps) {
  const [value, setValue] = useState<string>("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (open) {
      setValue("");
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [open, orderNumber]);

  if (!open) return null;

  const trimmed = value.trim();
  const isValid = trimmed.length > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div className="w-full max-w-lg rounded-xl bg-slate-900 p-6 shadow-2xl ring-1 ring-slate-700">
        <h2 className="text-lg font-semibold text-slate-100">Add note</h2>
        <p className="mt-1 text-sm text-slate-400">
          Order <span className="font-mono text-slate-300">{orderNumber}</span>{" "}
          · Note will be timestamped and appended to existing notes.
        </p>

        {existingNotes ? (
          <details className="mt-4 rounded-md bg-slate-800/40 ring-1 ring-inset ring-slate-700">
            <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-slate-300">
              Existing notes
            </summary>
            <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words px-3 pb-3 text-xs text-slate-400">
              {existingNotes}
            </pre>
          </details>
        ) : null}

        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!isValid || busy) return;
            onSubmit(trimmed);
          }}
        >
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
              New note
            </span>
            <textarea
              ref={textareaRef}
              rows={4}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={busy}
              placeholder="What changed? What needs attention?"
              className="mt-2 w-full rounded-lg border-0 bg-slate-800 px-3 py-2 text-sm text-slate-100 ring-1 ring-inset ring-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-60"
            />
          </label>

          {errorMessage ? (
            <p className="rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-300 ring-1 ring-inset ring-rose-500/30">
              {errorMessage}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isValid || busy}
              className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save note"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
