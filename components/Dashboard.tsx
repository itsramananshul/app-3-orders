"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NewOrderInput, Order, OrderPriority, OrderStatus } from "@/lib/types";
import {
  ActivityFeed,
  type ActivityAction,
  type ActivityEntry,
} from "./ActivityFeed";
import { ApiKeyManager } from "./ApiKeyManager";
import { ConnectionStatus, type ConnectionState } from "./ConnectionStatus";
import {
  FilterBar,
  type PriorityFilter,
  type StatusFilter,
} from "./FilterBar";
import { NewOrderModal } from "./NewOrderModal";
import { NoteModal } from "./NoteModal";
import { OrdersTable, type OrderActionKind } from "./OrdersTable";
import { PriorityModal } from "./PriorityModal";
import { StatCard } from "./StatCard";
import { StatusModal } from "./StatusModal";
import { Toast, type ToastState } from "./Toast";

interface DashboardProps {
  instanceName: string;
}

const POLL_INTERVAL_MS = 5000;
const STALE_THRESHOLD_MS = 15000;
const ACTIVITY_MAX = 50;

type ActionModal =
  | { kind: "status"; order: Order }
  | { kind: "priority"; order: Order }
  | { kind: "note"; order: Order }
  | { kind: "new" }
  | null;

function todayLocalISO(now: Date): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function newActivityId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatCurrency(n: number): string {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function Dashboard({ instanceName }: DashboardProps) {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [actionModal, setActionModal] = useState<ActionModal>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [lastSuccessAt, setLastSuccessAt] = useState<Date | null>(null);
  const [lastFetchOk, setLastFetchOk] = useState<boolean>(true);
  const [now, setNow] = useState<Date>(new Date());

  const [toast, setToast] = useState<ToastState | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [apiKeysOpen, setApiKeysOpen] = useState(false);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("ALL");
  const [search, setSearch] = useState<string>("");
  const [overdueOnly, setOverdueOnly] = useState<boolean>(false);

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
      setLastFetchOk(true);
      setLastSuccessAt(new Date());
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return;
      setLastFetchOk(false);
      setLoadError(
        err instanceof Error ? err.message : "Failed to load orders",
      );
    }
  }, []);

  useEffect(() => {
    void fetchOrders();
    const pollId = setInterval(() => {
      void fetchOrders();
    }, POLL_INTERVAL_MS);
    const tickId = setInterval(() => setNow(new Date()), 1000);
    return () => {
      clearInterval(pollId);
      clearInterval(tickId);
      abortRef.current?.abort();
    };
  }, [fetchOrders]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(id);
  }, [toast]);

  const connectionState: ConnectionState = useMemo(() => {
    if (!lastSuccessAt) return "connecting";
    const age = now.getTime() - lastSuccessAt.getTime();
    if (age > STALE_THRESHOLD_MS) return "stale";
    if (!lastFetchOk) return "reconnecting";
    return "live";
  }, [lastSuccessAt, lastFetchOk, now]);

  const today = useMemo(() => todayLocalISO(now), [now]);

  const stats = useMemo(() => {
    const list = orders ?? [];
    const totalOrders = list.length;
    const flagged = list.filter((o) => o.status === "FLAGGED").length;
    const overdue = list.filter(
      (o) => o.due_date < today && o.status !== "DELIVERED",
    ).length;
    const totalValue = list.reduce((sum, o) => sum + o.total_value, 0);
    return { totalOrders, flagged, overdue, totalValue };
  }, [orders, today]);

  const filtered = useMemo(() => {
    const list = orders ?? [];
    const term = search.trim().toLowerCase();
    return list.filter((o) => {
      if (statusFilter !== "ALL" && o.status !== statusFilter) return false;
      if (priorityFilter !== "ALL" && o.priority !== priorityFilter)
        return false;
      if (overdueOnly && !(o.due_date < today && o.status !== "DELIVERED"))
        return false;
      if (term) {
        const hay =
          `${o.order_number} ${o.customer} ${o.product_sku} ${o.product_name}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [orders, statusFilter, priorityFilter, search, overdueOnly, today]);

  const appendActivity = useCallback((entry: ActivityEntry) => {
    setActivity((prev) => [entry, ...prev].slice(0, ACTIVITY_MAX));
  }, []);

  const handleAction = useCallback(
    (order: Order, action: OrderActionKind) => {
      setActionError(null);
      setActionModal({ kind: action, order });
    },
    [],
  );

  const handleCloseModal = useCallback(() => {
    if (actionBusy) return;
    setActionModal(null);
    setActionError(null);
  }, [actionBusy]);

  const handleResetFilters = useCallback(() => {
    setStatusFilter("ALL");
    setPriorityFilter("ALL");
    setSearch("");
    setOverdueOnly(false);
  }, []);

  const submitMutation = useCallback(
    async (params: {
      url: string;
      method: "POST" | "PATCH";
      body: unknown;
      action: ActivityAction;
      orderNumber: string;
      customer: string;
      detail: string;
      successMessage: string;
      failurePrefix: string;
    }) => {
      setActionBusy(true);
      setActionError(null);
      try {
        const res = await fetch(params.url, {
          method: params.method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params.body),
        });
        const body = (await res.json().catch(() => null)) as
          | {
              success?: boolean;
              error?: string;
              order?: Order;
            }
          | null;
        const ok = res.ok && body?.success === true;
        if (!ok) {
          throw new Error(body?.error ?? `Request failed (HTTP ${res.status})`);
        }

        appendActivity({
          id: newActivityId(),
          timestamp: new Date(),
          action: params.action,
          orderNumber: params.orderNumber,
          customer: params.customer,
          detail: params.detail,
          result: "success",
        });
        setToast({
          id: Date.now(),
          kind: "success",
          message: params.successMessage,
        });
        setActionModal(null);
        void fetchOrders();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Action failed";
        appendActivity({
          id: newActivityId(),
          timestamp: new Date(),
          action: params.action,
          orderNumber: params.orderNumber,
          customer: params.customer,
          detail: params.detail,
          result: "failure",
          message,
        });
        setActionError(message);
        setToast({
          id: Date.now(),
          kind: "error",
          message: `${params.failurePrefix}: ${message}`,
        });
      } finally {
        setActionBusy(false);
      }
    },
    [appendActivity, fetchOrders],
  );

  const handleStatusSubmit = useCallback(
    (newStatus: OrderStatus) => {
      if (actionModal?.kind !== "status") return;
      const o = actionModal.order;
      void submitMutation({
        url: `/api/orders/${o.id}/status`,
        method: "PATCH",
        body: { status: newStatus },
        action: "status_change",
        orderNumber: o.order_number,
        customer: o.customer,
        detail: `${o.status} → ${newStatus}`,
        successMessage: `${o.order_number} status → ${newStatus.replace(/_/g, " ")}`,
        failurePrefix: "Status change failed",
      });
    },
    [actionModal, submitMutation],
  );

  const handlePrioritySubmit = useCallback(
    (newPriority: OrderPriority) => {
      if (actionModal?.kind !== "priority") return;
      const o = actionModal.order;
      void submitMutation({
        url: `/api/orders/${o.id}/priority`,
        method: "PATCH",
        body: { priority: newPriority },
        action: "priority_change",
        orderNumber: o.order_number,
        customer: o.customer,
        detail: `${o.priority} → ${newPriority}`,
        successMessage: `${o.order_number} priority → ${newPriority}`,
        failurePrefix: "Priority change failed",
      });
    },
    [actionModal, submitMutation],
  );

  const handleNoteSubmit = useCallback(
    (note: string) => {
      if (actionModal?.kind !== "note") return;
      const o = actionModal.order;
      void submitMutation({
        url: `/api/orders/${o.id}/note`,
        method: "POST",
        body: { note },
        action: "note_added",
        orderNumber: o.order_number,
        customer: o.customer,
        detail:
          note.length > 50 ? `note: ${note.slice(0, 50)}…` : `note: ${note}`,
        successMessage: `Note added to ${o.order_number}`,
        failurePrefix: "Note failed",
      });
    },
    [actionModal, submitMutation],
  );

  const handleNewOrderSubmit = useCallback(
    (input: NewOrderInput) => {
      void submitMutation({
        url: "/api/orders",
        method: "POST",
        body: input,
        action: "create",
        orderNumber: input.order_number,
        customer: input.customer,
        detail: `${input.product_sku} × ${input.quantity}`,
        successMessage: `Created order ${input.order_number}`,
        failurePrefix: "Create failed",
      });
    },
    [submitMutation],
  );

  const lastRefreshedAgo = useMemo(() => {
    if (!lastSuccessAt) return null;
    return Math.max(
      0,
      Math.floor((now.getTime() - lastSuccessAt.getTime()) / 1000),
    );
  }, [lastSuccessAt, now]);

  return (
    <main className="mx-auto max-w-[1400px] px-6 py-8">
      <header className="flex flex-col gap-4 border-b border-slate-800 pb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-400">
              Orders Management
            </p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-50">
              {instanceName}{" "}
              <span className="text-slate-500">— Orders Management</span>
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Standalone orders instance. Auto-refreshes every 5 seconds.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-2 rounded-full bg-slate-800/80 px-3 py-1 text-xs font-medium text-slate-300 ring-1 ring-inset ring-slate-700"
              title="Set via INSTANCE_NAME env var. Read-only in the UI."
            >
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5 text-slate-500"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V8a4 4 0 1 1 8 0v3" />
              </svg>
              Current Instance: {instanceName}
            </span>
            <ConnectionStatus state={connectionState} />
            <button
              type="button"
              onClick={() => setApiKeysOpen(true)}
              className="inline-flex items-center gap-1 rounded-full bg-slate-800/80 px-3 py-1 text-xs font-medium text-slate-200 ring-1 ring-inset ring-slate-700 hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
            >
              <span aria-hidden>🔑</span> API Keys
            </button>
            <button
              type="button"
              onClick={() => {
                setActionError(null);
                setActionModal({ kind: "new" });
              }}
              className="inline-flex items-center gap-1 rounded-full bg-sky-500 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              + New order
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
          <span>
            <span className="text-slate-500">Last refreshed:</span>{" "}
            <span className="text-slate-300 tabular-nums">
              {lastSuccessAt ? lastSuccessAt.toLocaleTimeString() : "—"}
            </span>
            {lastRefreshedAgo !== null ? (
              <span className="ml-1 text-slate-500">
                ({lastRefreshedAgo}s ago)
              </span>
            ) : null}
          </span>
          <span className="text-slate-700">·</span>
          <span>
            Polling every {Math.round(POLL_INTERVAL_MS / 1000)} s · stale after{" "}
            {Math.round(STALE_THRESHOLD_MS / 1000)} s
          </span>
        </div>
      </header>

      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Orders" value={stats.totalOrders} />
        <StatCard
          label="Flagged Orders"
          value={stats.flagged}
          tone={stats.flagged > 0 ? "danger" : "default"}
          hint={
            stats.flagged > 0
              ? "Health is degraded while > 0"
              : "Nothing flagged"
          }
        />
        <StatCard
          label="Overdue Orders"
          value={stats.overdue}
          tone={stats.overdue > 0 ? "danger" : "default"}
          hint={
            stats.overdue > 0
              ? `Due before ${today} & not delivered`
              : "Nothing overdue"
          }
        />
        <StatCard
          label="Total Value"
          value={formatCurrency(stats.totalValue)}
          tone="success"
          hint="Sum of quantity × unit price"
        />
      </section>

      {loadError ? (
        <div className="mt-6 rounded-md bg-rose-500/10 px-4 py-3 text-sm text-rose-300 ring-1 ring-inset ring-rose-500/30">
          Failed to load orders: {loadError}
        </div>
      ) : null}

      <section className="mt-6">
        <FilterBar
          statusFilter={statusFilter}
          priorityFilter={priorityFilter}
          search={search}
          overdueOnly={overdueOnly}
          onStatusChange={setStatusFilter}
          onPriorityChange={setPriorityFilter}
          onSearchChange={setSearch}
          onOverdueChange={setOverdueOnly}
          resultCount={filtered.length}
          totalCount={orders?.length ?? 0}
          onReset={handleResetFilters}
        />
      </section>

      <section className="mt-4">
        {orders === null && !loadError ? (
          <div className="rounded-xl bg-slate-900/40 px-4 py-12 text-center text-sm text-slate-500 ring-1 ring-slate-800">
            Loading orders…
          </div>
        ) : (
          <OrdersTable
            orders={filtered}
            today={today}
            onAction={handleAction}
          />
        )}
      </section>

      <section className="mt-6">
        <ActivityFeed entries={activity} />
      </section>

      <StatusModal
        open={actionModal?.kind === "status"}
        orderNumber={
          actionModal?.kind === "status" ? actionModal.order.order_number : ""
        }
        currentStatus={
          actionModal?.kind === "status" ? actionModal.order.status : "PENDING"
        }
        busy={actionBusy}
        errorMessage={actionError}
        onCancel={handleCloseModal}
        onSubmit={handleStatusSubmit}
      />

      <PriorityModal
        open={actionModal?.kind === "priority"}
        orderNumber={
          actionModal?.kind === "priority" ? actionModal.order.order_number : ""
        }
        currentPriority={
          actionModal?.kind === "priority" ? actionModal.order.priority : "NORMAL"
        }
        busy={actionBusy}
        errorMessage={actionError}
        onCancel={handleCloseModal}
        onSubmit={handlePrioritySubmit}
      />

      <NoteModal
        open={actionModal?.kind === "note"}
        orderNumber={
          actionModal?.kind === "note" ? actionModal.order.order_number : ""
        }
        existingNotes={
          actionModal?.kind === "note" ? actionModal.order.notes : ""
        }
        busy={actionBusy}
        errorMessage={actionError}
        onCancel={handleCloseModal}
        onSubmit={handleNoteSubmit}
      />

      <NewOrderModal
        open={actionModal?.kind === "new"}
        busy={actionBusy}
        errorMessage={actionError}
        onCancel={handleCloseModal}
        onSubmit={handleNewOrderSubmit}
      />

      <Toast toast={toast} onClose={() => setToast(null)} />

      <ApiKeyManager
        open={apiKeysOpen}
        onClose={() => setApiKeysOpen(false)}
      />
    </main>
  );
}
