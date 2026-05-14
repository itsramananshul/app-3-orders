"use client";

export type ToastKind = "success" | "error";

export interface ToastState {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastProps {
  toast: ToastState | null;
  onClose: () => void;
}

const styles: Record<ToastKind, string> = {
  success:
    "bg-emerald-500/15 text-emerald-200 ring-emerald-500/40 [--dot:theme(colors.emerald.400)]",
  error:
    "bg-rose-500/15 text-rose-200 ring-rose-500/40 [--dot:theme(colors.rose.400)]",
};

export function Toast({ toast, onClose }: ToastProps) {
  if (!toast) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4 sm:justify-end sm:px-6"
    >
      <div
        className={`pointer-events-auto flex max-w-md items-start gap-3 rounded-lg px-4 py-3 shadow-2xl ring-1 ring-inset backdrop-blur-sm ${styles[toast.kind]}`}
      >
        <span
          className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
          style={{ background: "var(--dot)" }}
        />
        <p className="text-sm">{toast.message}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss notification"
          className="ml-2 -mr-1 rounded p-1 text-slate-400 hover:bg-white/5 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
        >
          <span aria-hidden>×</span>
        </button>
      </div>
    </div>
  );
}
