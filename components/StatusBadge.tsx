"use client";

import type { OrderStatus } from "@/lib/types";

const styles: Record<OrderStatus, string> = {
  PENDING: "bg-amber-50 text-amber-700 ring-amber-600/20",
  IN_PRODUCTION: "bg-blue-50 text-blue-700 ring-blue-600/20",
  READY_TO_SHIP: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  SHIPPED: "bg-teal-50 text-teal-700 ring-teal-600/20",
  DELIVERED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  FLAGGED: "bg-rose-50 text-rose-700 ring-rose-600/20",
};

const labels: Record<OrderStatus, string> = {
  PENDING: "Pending",
  IN_PRODUCTION: "In Production",
  READY_TO_SHIP: "Ready to Ship",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  FLAGGED: "Flagged",
};

interface StatusBadgeProps {
  status: OrderStatus;
  onClick?: () => void;
  title?: string;
}

export function StatusBadge({ status, onClick, title }: StatusBadgeProps) {
  const base = `inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${styles[status]}`;
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title ?? "Click to advance status"}
        className={`${base} cursor-pointer transition-shadow hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
        {labels[status]}
      </button>
    );
  }
  return (
    <span className={base}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {labels[status]}
    </span>
  );
}
