"use client";

import type { Order } from "@/lib/types";
import { PriorityBadge } from "./PriorityBadge";
import { StatusBadge } from "./StatusBadge";

export type OrderActionKind = "status" | "priority" | "note";

interface OrdersTableProps {
  orders: Order[];
  today: string;
  onAction: (order: Order, action: OrderActionKind) => void;
}

function isOverdue(order: Order, today: string): boolean {
  return order.due_date < today && order.status !== "DELIVERED";
}

function formatCurrency(n: number): string {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function formatNumber(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function notesPreview(notes: string): string {
  if (!notes) return "—";
  const lines = notes.split("\n").map((l) => l.trim()).filter(Boolean);
  const last = lines[lines.length - 1] ?? "";
  return last.length > 60 ? `${last.slice(0, 60)}…` : last;
}

export function OrdersTable({ orders, today, onAction }: OrdersTableProps) {
  return (
    <div className="overflow-hidden rounded-xl ring-1 ring-slate-800 bg-slate-900/40">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-900/80 text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th scope="col" className="px-3 py-3 text-left font-medium">Order #</th>
              <th scope="col" className="px-3 py-3 text-left font-medium">Customer</th>
              <th scope="col" className="px-3 py-3 text-left font-medium">Product</th>
              <th scope="col" className="px-3 py-3 text-right font-medium">Qty</th>
              <th scope="col" className="px-3 py-3 text-right font-medium">Unit Price</th>
              <th scope="col" className="px-3 py-3 text-right font-medium">Total</th>
              <th scope="col" className="px-3 py-3 text-left font-medium">Status</th>
              <th scope="col" className="px-3 py-3 text-left font-medium">Priority</th>
              <th scope="col" className="px-3 py-3 text-left font-medium">Due Date</th>
              <th scope="col" className="px-3 py-3 text-left font-medium">Notes</th>
              <th scope="col" className="px-3 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {orders.map((o) => {
              const overdue = isOverdue(o, today);
              return (
                <tr
                  key={o.id}
                  className={`transition-colors ${
                    o.status === "FLAGGED"
                      ? "bg-rose-500/5 hover:bg-rose-500/10"
                      : overdue
                        ? "bg-amber-500/5 hover:bg-amber-500/10"
                        : "hover:bg-slate-800/40"
                  }`}
                >
                  <td className="whitespace-nowrap px-3 py-3 font-mono text-xs text-slate-300">
                    {o.order_number}
                  </td>
                  <td className="px-3 py-3 text-slate-200">{o.customer}</td>
                  <td className="px-3 py-3">
                    <div className="text-slate-100">{o.product_name}</div>
                    <div className="font-mono text-[11px] text-slate-500">
                      {o.product_sku}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-slate-300">
                    {formatNumber(o.quantity)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-slate-400">
                    {formatCurrency(o.unit_price)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums font-medium text-slate-100">
                    {formatCurrency(o.total_value)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <PriorityBadge priority={o.priority} />
                  </td>
                  <td
                    className={`whitespace-nowrap px-3 py-3 tabular-nums ${
                      overdue ? "text-rose-300 font-semibold" : "text-slate-300"
                    }`}
                    title={overdue ? "Overdue and not yet delivered" : undefined}
                  >
                    {o.due_date}
                    {overdue ? (
                      <span className="ml-1 text-[10px] uppercase tracking-wider">
                        · overdue
                      </span>
                    ) : null}
                  </td>
                  <td
                    className="max-w-[260px] truncate px-3 py-3 text-xs text-slate-400"
                    title={o.notes || undefined}
                  >
                    {notesPreview(o.notes)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <button
                        type="button"
                        onClick={() => onAction(o, "status")}
                        className="rounded-md bg-sky-500/10 px-2 py-1 text-xs font-medium text-sky-300 ring-1 ring-inset ring-sky-500/30 hover:bg-sky-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                      >
                        Status
                      </button>
                      <button
                        type="button"
                        onClick={() => onAction(o, "priority")}
                        className="rounded-md bg-violet-500/10 px-2 py-1 text-xs font-medium text-violet-300 ring-1 ring-inset ring-violet-500/30 hover:bg-violet-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                      >
                        Priority
                      </button>
                      <button
                        type="button"
                        onClick={() => onAction(o, "note")}
                        className="rounded-md bg-slate-700/30 px-2 py-1 text-xs font-medium text-slate-200 ring-1 ring-inset ring-slate-600/50 hover:bg-slate-700/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                      >
                        Note
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {orders.length === 0 ? (
              <tr>
                <td
                  colSpan={11}
                  className="px-4 py-12 text-center text-sm text-slate-500"
                >
                  No orders match the current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
