import type { OrderPriority } from "@/lib/types";

const styles: Record<OrderPriority, string> = {
  URGENT: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
  HIGH: "bg-orange-500/15 text-orange-300 ring-orange-500/30",
  NORMAL: "bg-slate-500/15 text-slate-300 ring-slate-500/30",
  LOW: "bg-blue-500/15 text-blue-300 ring-blue-500/30",
};

export function PriorityBadge({ priority }: { priority: OrderPriority }) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset ${styles[priority]}`}
    >
      {priority}
    </span>
  );
}
