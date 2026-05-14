import type { OrderStatus } from "@/lib/types";

const styles: Record<OrderStatus, string> = {
  PENDING: "bg-slate-500/15 text-slate-300 ring-slate-500/30",
  IN_PRODUCTION: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  READY_TO_SHIP: "bg-violet-500/15 text-violet-300 ring-violet-500/30",
  SHIPPED: "bg-teal-500/15 text-teal-300 ring-teal-500/30",
  DELIVERED: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  FLAGGED: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
};

const labels: Record<OrderStatus, string> = {
  PENDING: "PENDING",
  IN_PRODUCTION: "IN PRODUCTION",
  READY_TO_SHIP: "READY TO SHIP",
  SHIPPED: "SHIPPED",
  DELIVERED: "DELIVERED",
  FLAGGED: "FLAGGED",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${styles[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {labels[status]}
    </span>
  );
}
