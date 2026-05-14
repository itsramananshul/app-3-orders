"use client";

import { useEffect, useState } from "react";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";

interface StatusModalProps {
  open: boolean;
  orderNumber: string;
  currentStatus: OrderStatus;
  busy?: boolean;
  errorMessage?: string | null;
  onCancel: () => void;
  onSubmit: (status: OrderStatus) => void;
}

export function StatusModal({
  open,
  orderNumber,
  currentStatus,
  busy = false,
  errorMessage,
  onCancel,
  onSubmit,
}: StatusModalProps) {
  const [selected, setSelected] = useState<OrderStatus>(currentStatus);

  useEffect(() => {
    if (open) setSelected(currentStatus);
  }, [open, currentStatus, orderNumber]);

  if (!open) return null;

  const unchanged = selected === currentStatus;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div className="w-full max-w-md rounded-xl bg-slate-900 p-6 shadow-2xl ring-1 ring-slate-700">
        <h2 className="text-lg font-semibold text-slate-100">Change status</h2>
        <p className="mt-1 text-sm text-slate-400">
          Order <span className="font-mono text-slate-300">{orderNumber}</span>
        </p>

        <div className="mt-4 flex items-center gap-2 rounded-md bg-slate-800/60 px-3 py-2 ring-1 ring-inset ring-slate-700">
          <span className="text-xs text-slate-400">Current:</span>
          <StatusBadge status={currentStatus} />
        </div>

        <form
          className="mt-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (busy || unchanged) return;
            onSubmit(selected);
          }}
        >
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
              New status
            </span>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value as OrderStatus)}
              disabled={busy}
              className="mt-2 w-full rounded-lg border-0 bg-slate-800 px-3 py-2 text-slate-100 ring-1 ring-inset ring-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-60"
            >
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
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
              disabled={busy || unchanged}
              className="rounded-lg bg-sky-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Saving…" : "Update status"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
