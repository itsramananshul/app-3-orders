"use client";

import type { OrderPriority } from "@/lib/types";

const styles: Record<OrderPriority, string> = {
  LOW: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  NORMAL: "bg-gray-100 text-gray-700 ring-gray-300",
  HIGH: "bg-amber-50 text-amber-700 ring-amber-600/20",
  URGENT: "bg-rose-50 text-rose-700 ring-rose-600/20",
};

const labels: Record<OrderPriority, string> = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
  URGENT: "Urgent",
};

interface PriorityBadgeProps {
  priority: OrderPriority;
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${styles[priority]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {labels[priority]}
    </span>
  );
}
