"use client";

import { useMemo } from "react";
import type { Order, OrderStatus } from "@/lib/types";
import { PriorityBadge } from "./PriorityBadge";

interface PriorityOrdersProps {
  orders: Order[];
  busyOrderId: string | null;
  onTransition: (order: Order, target: OrderStatus) => void;
  onViewAll: () => void;
}

type ChipTone = "teal" | "rose" | "blue" | "indigo" | "emerald" | "gray";

interface TransitionChip {
  label: string;
  target: OrderStatus;
  tone: ChipTone;
}

const PRIMARY_TRANSITION: Record<OrderStatus, TransitionChip | null> = {
  PENDING: { label: "Start", target: "IN_PRODUCTION", tone: "blue" },
  IN_PRODUCTION: { label: "Ready", target: "READY_TO_SHIP", tone: "indigo" },
  READY_TO_SHIP: { label: "Ship", target: "SHIPPED", tone: "teal" },
  SHIPPED: { label: "Mark delivered", target: "DELIVERED", tone: "emerald" },
  DELIVERED: null,
  FLAGGED: { label: "Reopen", target: "PENDING", tone: "gray" },
};

const CHIP_STYLES: Record<ChipTone, string> = {
  teal: "bg-teal-50 text-teal-700 hover:bg-teal-100 focus-visible:ring-teal-400",
  rose: "bg-rose-50 text-rose-700 hover:bg-rose-100 focus-visible:ring-rose-400",
  blue: "bg-blue-50 text-blue-700 hover:bg-blue-100 focus-visible:ring-blue-400",
  indigo:
    "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 focus-visible:ring-indigo-400",
  emerald:
    "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 focus-visible:ring-emerald-400",
  gray: "bg-gray-100 text-gray-700 hover:bg-gray-200 focus-visible:ring-gray-400",
};

function formatDate(s: string): string {
  try {
    const d = new Date(s + "T00:00:00");
    if (Number.isNaN(d.getTime())) return s;
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return s;
  }
}

export function PriorityOrders({
  orders,
  busyOrderId,
  onTransition,
  onViewAll,
}: PriorityOrdersProps) {
  const priorityOrders = useMemo(() => {
    return orders
      .filter((o) => o.priority === "URGENT" || o.priority === "HIGH")
      .sort((a, b) => {
        if (a.priority === b.priority) return 0;
        return a.priority === "URGENT" ? -1 : 1;
      })
      .slice(0, 6);
  }, [orders]);

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Priority
          </p>
          <h2 className="text-lg font-semibold text-gray-900">Priority Orders</h2>
        </div>
        <button
          type="button"
          onClick={onViewAll}
          className="inline-flex items-center gap-1 rounded text-xs font-medium text-teal-600 hover:text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
        >
          View all
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3 w-3"
            aria-hidden
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </header>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {priorityOrders.map((o) => {
          const transition = PRIMARY_TRANSITION[o.status];
          const isBusy = busyOrderId === o.id;
          return (
            <div
              key={o.id}
              className="group flex flex-col rounded-lg border border-gray-100 bg-gray-50 p-3 transition-colors hover:border-teal-200 hover:bg-teal-50/50"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-md bg-white px-1.5 py-0.5 font-mono text-[10px] text-gray-600 ring-1 ring-inset ring-gray-200">
                  {o.order_number}
                </span>
                <PriorityBadge priority={o.priority} />
              </div>
              <p
                className="mt-2 truncate text-sm font-medium text-gray-900"
                title={o.customer}
              >
                {o.customer}
              </p>
              <p
                className="truncate text-xs text-gray-500"
                title={o.product_name}
              >
                {o.product_name}
              </p>
              <p className="mt-1 text-[11px] text-gray-400">
                Due {formatDate(o.due_date)}
              </p>
              <div className="mt-2 flex">
                {isBusy ? (
                  <span className="flex-1 rounded-md bg-teal-50 px-2 py-1 text-center text-[10px] font-medium text-teal-700">
                    Working…
                  </span>
                ) : transition ? (
                  <button
                    type="button"
                    onClick={() => onTransition(o, transition.target)}
                    className={`flex-1 rounded-md px-2 py-1 text-[10px] font-medium focus-visible:outline-none focus-visible:ring-2 ${CHIP_STYLES[transition.tone]}`}
                  >
                    {transition.label}
                  </button>
                ) : (
                  <span className="flex-1 rounded-md bg-emerald-50 px-2 py-1 text-center text-[10px] font-medium text-emerald-700">
                    Done
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {priorityOrders.length === 0 ? (
          <p className="col-span-full py-8 text-center text-sm text-gray-400">
            No urgent or high-priority orders right now.
          </p>
        ) : null}
      </div>
    </section>
  );
}
