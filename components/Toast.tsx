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

const styles: Record<ToastKind, { ring: string; dot: string }> = {
  success: { ring: "ring-emerald-200", dot: "#10b981" },
  error: { ring: "ring-rose-200", dot: "#ef4444" },
};

export function Toast({ toast, onClose }: ToastProps) {
  if (!toast) return null;
  const s = styles[toast.kind];
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4 sm:justify-end sm:px-6"
    >
      <div
        className={`pointer-events-auto flex max-w-md items-start gap-3 rounded-lg bg-white px-4 py-3 shadow-lg ring-1 ${s.ring}`}
      >
        <span
          className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
          style={{ background: s.dot }}
          aria-hidden
        />
        <p className="text-sm text-gray-700">{toast.message}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss notification"
          className="-mr-1 ml-2 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300"
        >
          <span aria-hidden>×</span>
        </button>
      </div>
    </div>
  );
}
