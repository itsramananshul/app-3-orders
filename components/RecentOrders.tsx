"use client";

import { useMemo } from "react";
import type { Order, OrderStatus } from "@/lib/types";
import { PriorityBadge } from "./PriorityBadge";
import { StatusBadge } from "./StatusBadge";

export type StatusFilter = "ALL" | OrderStatus;

interface RecentOrdersProps {
  orders: Order[];
  loading: boolean;
  filter: StatusFilter;
  expanded: boolean;
  busyOrderId: string | null;
  onTransition: (order: Order, target: OrderStatus) => void;
  onToggleExpand: () => void;
}

const STATUS_PROGRESS: Record<OrderStatus, number> = {
  PENDING: 15,
  IN_PRODUCTION: 40,
  READY_TO_SHIP: 65,
  SHIPPED: 85,
  DELIVERED: 100,
  FLAGGED: 100,
};

type ChipTone = "teal" | "rose" | "blue" | "indigo" | "emerald" | "gray";

interface TransitionChip {
  label: string;
  target: OrderStatus;
  tone: ChipTone;
}

const TRANSITIONS: Record<OrderStatus, TransitionChip[]> = {
  PENDING: [
    { label: "Start", target: "IN_PRODUCTION", tone: "blue" },
    { label: "Flag", target: "FLAGGED", tone: "rose" },
  ],
  IN_PRODUCTION: [
    { label: "Ready", target: "READY_TO_SHIP", tone: "indigo" },
    { label: "Flag", target: "FLAGGED", tone: "rose" },
  ],
  READY_TO_SHIP: [{ label: "Ship", target: "SHIPPED", tone: "teal" }],
  SHIPPED: [{ label: "Mark delivered", target: "DELIVERED", tone: "emerald" }],
  DELIVERED: [],
  FLAGGED: [{ label: "Reopen", target: "PENDING", tone: "gray" }],
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

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Pending",
  IN_PRODUCTION: "In Production",
  READY_TO_SHIP: "Ready to Ship",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  FLAGGED: "Flagged",
};

export function RecentOrders({
  orders,
  loading,
  filter,
  expanded,
  busyOrderId,
  onTransition,
  onToggleExpand,
}: RecentOrdersProps) {
  const filtered = useMemo(() => {
    if (filter === "ALL") return orders;
    return orders.filter((o) => o.status === filter);
  }, [orders, filter]);

  const visible = expanded ? filtered : filtered.slice(0, 6);

  return (
    <section
      id="recent-orders"
      className="h-full rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100"
    >
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Pipeline
          </p>
          <h2 className="text-lg font-semibold text-gray-900">Recent Orders</h2>
          {filter !== "ALL" ? (
            <p className="mt-0.5 text-xs text-gray-400">
              Filtered to{" "}
              <span className="font-medium text-teal-600">
                {STATUS_LABEL[filter]}
              </span>
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onToggleExpand}
          className="inline-flex items-center gap-1 text-xs font-medium text-teal-600 hover:text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 rounded"
        >
          {expanded ? "Show less" : "View detail"}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`h-3 w-3 transition-transform ${expanded ? "rotate-90" : ""}`}
            aria-hidden
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </header>

      {loading && orders.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-400">
          Loading orders…
        </div>
      ) : null}

      <ul className="divide-y divide-gray-100">
        {visible.map((o) => {
          const pct = STATUS_PROGRESS[o.status] ?? 0;
          const isFlagged = o.status === "FLAGGED";
          const chips = TRANSITIONS[o.status];
          const isBusy = busyOrderId === o.id;
          const isClickableStatus =
            o.status === "PENDING" || o.status === "IN_PRODUCTION";
          const primaryTransition = chips[0];
          return (
            <li key={o.id} className="py-3.5">
              <div className="flex items-start gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-500">
                      {o.order_number}
                    </span>
                    <span className="truncate text-sm font-medium text-gray-900">
                      {o.customer}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-gray-400">
                    {o.product_name}{" "}
                    <span className="font-mono text-[10px] text-gray-400">
                      · {o.product_sku}
                    </span>
                  </p>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isFlagged ? "bg-rose-500" : "bg-teal-500"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-12 text-right text-xs tabular-nums text-gray-500">
                      {pct}%
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <PriorityBadge priority={o.priority} />
                    <StatusBadge
                      status={o.status}
                      onClick={
                        isClickableStatus && primaryTransition && !isBusy
                          ? () => onTransition(o, primaryTransition.target)
                          : undefined
                      }
                      title={
                        isClickableStatus && primaryTransition
                          ? `Advance to ${STATUS_LABEL[primaryTransition.target]}`
                          : undefined
                      }
                    />
                  </div>
                  <div className="flex flex-wrap justify-end gap-1">
                    {isBusy ? (
                      <span className="rounded-md bg-teal-50 px-2 py-1 text-[10px] font-medium text-teal-700">
                        Working…
                      </span>
                    ) : chips.length === 0 ? (
                      <span className="rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700">
                        Done
                      </span>
                    ) : (
                      chips.map((chip) => (
                        <button
                          key={`${o.id}-${chip.target}`}
                          type="button"
                          onClick={() => onTransition(o, chip.target)}
                          disabled={isBusy}
                          className={`rounded-md px-2 py-1 text-[10px] font-medium focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${CHIP_STYLES[chip.tone]}`}
                        >
                          {chip.label}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
        {!loading && filtered.length === 0 ? (
          <li className="py-10 text-center text-sm text-gray-400">
            {filter === "ALL"
              ? "No orders yet."
              : `No orders match the ${STATUS_LABEL[filter as OrderStatus]} filter.`}
          </li>
        ) : null}
      </ul>
      {filtered.length > 6 ? (
        <p className="mt-3 text-center text-xs text-gray-400">
          {expanded
            ? `Showing all ${filtered.length}`
            : `Showing 6 of ${filtered.length}`}
        </p>
      ) : null}
    </section>
  );
}
