"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  NewOrderInput,
  Order,
  OrderStatus,
} from "@/lib/types";
import {
  ActivityFeed,
  type ActivityAction,
  type ActivityEntry,
} from "./ActivityFeed";
import { ApiKeyManager } from "./ApiKeyManager";
import { ComingSoon } from "./ComingSoon";
import { DonutChart } from "./DonutChart";
import { FilterDropdown, type StatusFilter } from "./FilterDropdown";
import { MetricCard } from "./MetricCard";
import { NewOrderModal } from "./NewOrderModal";
import { PriorityOrders } from "./PriorityOrders";
import { RecentOrders } from "./RecentOrders";
import { Toast, type ToastState } from "./Toast";
import { TopNav, type NavView } from "./TopNav";

interface DashboardProps {
  instanceName: string;
}

const POLL_INTERVAL_MS = 5000;
const ACTIVITY_MAX = 50;

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Pending",
  IN_PRODUCTION: "In Production",
  READY_TO_SHIP: "Ready to Ship",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  FLAGGED: "Flagged",
};

const COMING_SOON_COPY: Record<
  Exclude<NavView, "dashboard">,
  { title: string; description: string }
> = {
  orders: {
    title: "Orders — coming soon",
    description:
      "A full orders ledger with bulk actions, search, and exports lives here.",
  },
  customers: {
    title: "Customers — coming soon",
    description:
      "Customer directory with order history, lifetime value, and contact details.",
  },
  products: {
    title: "Products — coming soon",
    description:
      "Product catalog with SKUs, pricing, and inventory linkage across instances.",
  },
  reports: {
    title: "Reports — coming soon",
    description:
      "Revenue, fulfillment, and SLA reporting with custom date ranges.",
  },
};

function newActivityId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function scrollToRecent() {
  const el = document.getElementById("recent-orders");
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function Dashboard({ instanceName }: DashboardProps) {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [view, setView] = useState<NavView>("dashboard");
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [expanded, setExpanded] = useState(false);

  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);

  const [toast, setToast] = useState<ToastState | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [apiKeysOpen, setApiKeysOpen] = useState(false);

  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [newOrderBusy, setNewOrderBusy] = useState(false);
  const [newOrderError, setNewOrderError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const fetchOrders = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/orders", {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const data: Order[] = await res.json();
      setOrders(data);
      setLoadError(null);
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return;
      setLoadError(
        err instanceof Error ? err.message : "Failed to load orders",
      );
    }
  }, []);

  useEffect(() => {
    void fetchOrders();
    const id = setInterval(() => {
      void fetchOrders();
    }, POLL_INTERVAL_MS);
    return () => {
      clearInterval(id);
      abortRef.current?.abort();
    };
  }, [fetchOrders]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(id);
  }, [toast]);

  const stats = useMemo(() => {
    const list = orders ?? [];
    const totalOrders = list.length;
    const counts: Record<OrderStatus, number> = {
      PENDING: 0,
      IN_PRODUCTION: 0,
      READY_TO_SHIP: 0,
      SHIPPED: 0,
      DELIVERED: 0,
      FLAGGED: 0,
    };
    for (const o of list) counts[o.status] += 1;
    return { totalOrders, counts };
  }, [orders]);

  const filterCounts: Record<StatusFilter, number> = useMemo(
    () => ({
      ALL: stats.totalOrders,
      PENDING: stats.counts.PENDING,
      IN_PRODUCTION: stats.counts.IN_PRODUCTION,
      READY_TO_SHIP: stats.counts.READY_TO_SHIP,
      SHIPPED: stats.counts.SHIPPED,
      DELIVERED: stats.counts.DELIVERED,
      FLAGGED: stats.counts.FLAGGED,
    }),
    [stats],
  );

  const appendActivity = useCallback((entry: ActivityEntry) => {
    setActivity((prev) => [entry, ...prev].slice(0, ACTIVITY_MAX));
  }, []);

  const handleTransition = useCallback(
    async (order: Order, target: OrderStatus) => {
      if (busyOrderId) return;
      setBusyOrderId(order.id);
      const fromStatus = order.status;
      try {
        const res = await fetch(`/api/orders/${order.id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: target }),
        });
        const body = (await res.json().catch(() => null)) as
          | { success?: boolean; error?: string; order?: Order }
          | null;
        const ok = res.ok && body?.success === true;
        if (!ok) {
          throw new Error(body?.error ?? `Request failed (HTTP ${res.status})`);
        }

        const action: ActivityAction = "status_change";
        appendActivity({
          id: newActivityId(),
          timestamp: new Date(),
          action,
          orderNumber: order.order_number,
          customer: order.customer,
          fromStatus,
          toStatus: target,
          result: "success",
        });
        setToast({
          id: Date.now(),
          kind: "success",
          message: `${order.order_number}: ${STATUS_LABEL[fromStatus]} → ${STATUS_LABEL[target]}`,
        });
        void fetchOrders();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Action failed";
        appendActivity({
          id: newActivityId(),
          timestamp: new Date(),
          action: "status_change",
          orderNumber: order.order_number,
          customer: order.customer,
          fromStatus,
          toStatus: target,
          result: "failure",
          message,
        });
        setToast({
          id: Date.now(),
          kind: "error",
          message: `Status change failed: ${message}`,
        });
      } finally {
        setBusyOrderId(null);
      }
    },
    [busyOrderId, appendActivity, fetchOrders],
  );

  const handleCreateNewOrder = useCallback(
    async (input: NewOrderInput) => {
      if (newOrderBusy) return;
      setNewOrderBusy(true);
      setNewOrderError(null);
      try {
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        const body = (await res.json().catch(() => null)) as
          | { success?: boolean; error?: string; order?: Order }
          | null;
        const ok = res.ok && body?.success === true;
        if (!ok) {
          throw new Error(body?.error ?? `Request failed (HTTP ${res.status})`);
        }

        appendActivity({
          id: newActivityId(),
          timestamp: new Date(),
          action: "created",
          orderNumber: input.order_number,
          customer: input.customer,
          detail: `${input.product_sku} × ${input.quantity}`,
          result: "success",
        });
        setToast({
          id: Date.now(),
          kind: "success",
          message: `Created order ${input.order_number}.`,
        });
        setNewOrderOpen(false);
        void fetchOrders();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Create failed";
        appendActivity({
          id: newActivityId(),
          timestamp: new Date(),
          action: "created",
          orderNumber: input.order_number,
          customer: input.customer,
          detail: `${input.product_sku} × ${input.quantity}`,
          result: "failure",
          message,
        });
        setNewOrderError(message);
        setToast({
          id: Date.now(),
          kind: "error",
          message: `Create failed: ${message}`,
        });
      } finally {
        setNewOrderBusy(false);
      }
    },
    [newOrderBusy, appendActivity, fetchOrders],
  );

  const handleViewAll = useCallback(() => {
    setFilter("ALL");
    setExpanded(true);
    setTimeout(scrollToRecent, 50);
  }, []);

  const handleViewStatus = useCallback((s: OrderStatus) => {
    setFilter(s);
    setExpanded(true);
    setTimeout(scrollToRecent, 50);
  }, []);

  const donutSlices = useMemo(
    () =>
      [
        { label: "Pending", value: stats.counts.PENDING, hex: "#f59e0b" },
        {
          label: "In Production",
          value: stats.counts.IN_PRODUCTION,
          hex: "#3b82f6",
        },
        {
          label: "Ready to Ship",
          value: stats.counts.READY_TO_SHIP,
          hex: "#6366f1",
        },
        { label: "Shipped", value: stats.counts.SHIPPED, hex: "#14b8a6" },
        {
          label: "Delivered",
          value: stats.counts.DELIVERED,
          hex: "#10b981",
        },
        { label: "Flagged", value: stats.counts.FLAGGED, hex: "#ef4444" },
      ].filter((s) => s.value > 0),
    [stats],
  );

  return (
    <div>
      <TopNav
        instanceName={instanceName}
        currentView={view}
        onChangeView={(v) => {
          setView(v);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        onOpenApiKeys={() => setApiKeysOpen(true)}
      />

      <main className="mx-auto max-w-7xl px-6 py-6">
        {view !== "dashboard" ? (
          <>
            <div className="mb-6 flex flex-col gap-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                {view}
              </p>
              <h1 className="text-2xl font-bold capitalize text-gray-900">
                {view}
              </h1>
            </div>
            <ComingSoon
              title={COMING_SOON_COPY[view].title}
              description={COMING_SOON_COPY[view].description}
              onBack={() => setView("dashboard")}
            />
          </>
        ) : (
          <>
            <div className="mb-6 flex items-end justify-between gap-3">
              <div className="flex flex-col gap-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Overview
                </p>
                <h1 className="text-2xl font-bold text-gray-900">
                  {instanceName} Dashboard
                </h1>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setNewOrderError(null);
                    setNewOrderOpen(true);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg bg-teal-500 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-3.5 w-3.5"
                    aria-hidden
                  >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  New Order
                </button>
                <FilterDropdown
                  value={filter}
                  counts={filterCounts}
                  onChange={(v) => {
                    setFilter(v);
                    if (v !== "ALL") setExpanded(true);
                  }}
                />
              </div>
            </div>

            {loadError ? (
              <div className="mb-6 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
                Failed to load orders: {loadError}
              </div>
            ) : null}

            <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                label="Total Orders"
                value={stats.totalOrders}
                onViewDetail={handleViewAll}
              />
              <MetricCard
                label="Pending"
                value={stats.counts.PENDING}
                hint={
                  stats.counts.PENDING > 0
                    ? "Awaiting start"
                    : "All orders started"
                }
                onViewDetail={() => handleViewStatus("PENDING")}
              />
              <MetricCard
                label="In Production"
                value={stats.counts.IN_PRODUCTION}
                hint="Currently being built"
                onViewDetail={() => handleViewStatus("IN_PRODUCTION")}
              />
              <MetricCard
                label="Completed"
                value={stats.counts.DELIVERED}
                hint="Delivered to customer"
                onViewDetail={() => handleViewStatus("DELIVERED")}
              />
            </section>

            <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
              <div className="lg:col-span-3">
                <RecentOrders
                  orders={orders ?? []}
                  loading={orders === null}
                  filter={filter}
                  expanded={expanded}
                  busyOrderId={busyOrderId}
                  onTransition={handleTransition}
                  onToggleExpand={() => setExpanded((v) => !v)}
                />
              </div>
              <div className="flex flex-col gap-4 lg:col-span-2">
                <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
                  <header className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                        Distribution
                      </p>
                      <h2 className="text-lg font-semibold text-gray-900">
                        Status Breakdown
                      </h2>
                    </div>
                  </header>
                  <DonutChart
                    total={stats.totalOrders}
                    centerLabel="Orders"
                    slices={donutSlices}
                  />
                </section>
                <ActivityFeed entries={activity} />
              </div>
            </section>

            <section className="mb-6">
              <PriorityOrders
                orders={orders ?? []}
                busyOrderId={busyOrderId}
                onTransition={handleTransition}
                onViewAll={handleViewAll}
              />
            </section>
          </>
        )}
      </main>

      <NewOrderModal
        open={newOrderOpen}
        busy={newOrderBusy}
        errorMessage={newOrderError}
        onCancel={() => {
          if (!newOrderBusy) {
            setNewOrderOpen(false);
            setNewOrderError(null);
          }
        }}
        onSubmit={handleCreateNewOrder}
      />

      <Toast toast={toast} onClose={() => setToast(null)} />

      <ApiKeyManager
        open={apiKeysOpen}
        onClose={() => setApiKeysOpen(false)}
      />
    </div>
  );
}
