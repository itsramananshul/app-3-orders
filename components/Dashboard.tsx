"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  NewOrderInput,
  Order,
  OrderStatus,
  OrderPriority,
} from "@/lib/types";
import {
  type ActivityAction,
  type ActivityEntry,
} from "./ActivityFeed";
import { ApiKeyManager } from "./ApiKeyManager";
import { NewOrderModal } from "./NewOrderModal";
import { Toast, type ToastState } from "./Toast";

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

function newActivityId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Display buckets — mutually exclusive view of priority + status. The schema
// has no DELAYED status; FLAGGED is the closest analogue so we surface it as
// "Delayed" in the donut/badges per the redesign spec.
type DisplayBucket =
  | "delivered"
  | "in_production"
  | "pending"
  | "delayed"
  | "urgent";

function bucketFor(o: Order): DisplayBucket {
  if (o.priority === "URGENT") return "urgent";
  if (o.status === "FLAGGED") return "delayed";
  if (o.status === "DELIVERED") return "delivered";
  if (
    o.status === "IN_PRODUCTION" ||
    o.status === "READY_TO_SHIP" ||
    o.status === "SHIPPED"
  ) {
    return "in_production";
  }
  return "pending";
}

const BUCKET_STYLE: Record<
  DisplayBucket,
  { label: string; bg: string; fg: string; dot: string }
> = {
  delivered: { label: "Delivered", bg: "rgba(76,175,80,0.2)", fg: "#86efac", dot: "#4CAF50" },
  in_production: { label: "In Production", bg: "rgba(59,130,246,0.2)", fg: "#93c5fd", dot: "#3b82f6" },
  pending: { label: "Pending", bg: "rgba(245,158,11,0.2)", fg: "#fcd34d", dot: "#f59e0b" },
  delayed: { label: "Delayed", bg: "rgba(168,85,247,0.2)", fg: "#d8b4fe", dot: "#a855f7" },
  urgent: { label: "URGENT", bg: "rgba(239,68,68,0.2)", fg: "#fca5a5", dot: "#ef4444" },
};

const BUCKET_ORDER: DisplayBucket[] = [
  "delivered",
  "in_production",
  "pending",
  "delayed",
  "urgent",
];

// Map an order to its next status when the row-level action button is clicked
function nextActionFor(o: Order): { label: string; target: OrderStatus } | null {
  if (o.status === "PENDING") return { label: "Approve", target: "IN_PRODUCTION" };
  if (o.status === "IN_PRODUCTION") return { label: "Mark Shipped", target: "SHIPPED" };
  if (o.status === "READY_TO_SHIP") return { label: "Mark Shipped", target: "SHIPPED" };
  if (o.status === "SHIPPED") return { label: "Mark Delivered", target: "DELIVERED" };
  if (o.status === "FLAGGED") return { label: "Resume", target: "IN_PRODUCTION" };
  return null; // DELIVERED — terminal
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  if (Number.isNaN(da) || Number.isNaN(db)) return 0;
  return Math.max(0, Math.round((db - da) / (1000 * 60 * 60 * 24)));
}

function daysFromNow(s: string): number {
  const t = new Date(s).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.round((t - Date.now()) / (1000 * 60 * 60 * 24));
}

function formatMoney(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}k`;
  return `$${Math.round(v)}`;
}

function formatDate(s: string): string {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatTimestamp(s: string): string {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dueColor(due: string, status: OrderStatus): string {
  if (status === "DELIVERED") return "#6b7280";
  const days = daysFromNow(due);
  if (days < 0) return "#ef4444";
  if (days <= 2) return "#f59e0b";
  return "#6b7280";
}

export function Dashboard({ instanceName }: DashboardProps) {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "all">("30d");
  const [plantFilter, setPlantFilter] = useState<string>("all");
  const [supplierFilter, setSupplierFilter] = useState<string | null>(null);
  const [bucketFilter, setBucketFilter] = useState<DisplayBucket | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);

  const [toast, setToast] = useState<ToastState | null>(null);
  const [, setActivity] = useState<ActivityEntry[]>([]);
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

  // ─── Derived data ───────────────────────────────────────────────────
  const allOrders = orders ?? [];

  const plants = useMemo(() => {
    const set = new Set<string>();
    for (const o of allOrders) set.add(o.instance_name);
    return ["all", ...Array.from(set).sort()];
  }, [allOrders]);

  const cutoffMs = useMemo(() => {
    if (timeRange === "all") return 0;
    const days = timeRange === "7d" ? 7 : 30;
    return Date.now() - days * 24 * 60 * 60 * 1000;
  }, [timeRange]);

  const scopedOrders = useMemo(() => {
    return allOrders.filter((o) => {
      if (plantFilter !== "all" && o.instance_name !== plantFilter) return false;
      if (cutoffMs > 0) {
        const t = new Date(o.created_at).getTime();
        if (!Number.isNaN(t) && t < cutoffMs) return false;
      }
      return true;
    });
  }, [allOrders, plantFilter, cutoffMs]);

  const bucketCounts = useMemo(() => {
    const c: Record<DisplayBucket, number> = {
      delivered: 0,
      in_production: 0,
      pending: 0,
      delayed: 0,
      urgent: 0,
    };
    for (const o of scopedOrders) c[bucketFor(o)] += 1;
    return c;
  }, [scopedOrders]);

  const kpis = useMemo(() => {
    const list = scopedOrders;
    const totalOrders = list.length;
    const totalValue = list.reduce((s, o) => s + (o.total_value || 0), 0);
    const urgent = list.filter((o) => o.priority === "URGENT").length;
    const delivered = list.filter((o) => o.status === "DELIVERED");
    const durations = delivered
      .map((o) => daysBetween(o.created_at, o.updated_at))
      .filter((d) => d > 0);
    const avgFulfill =
      durations.length === 0
        ? 0
        : Math.round(durations.reduce((s, d) => s + d, 0) / durations.length);
    return { totalOrders, totalValue, urgent, avgFulfill };
  }, [scopedOrders]);

  const bars = useMemo(() => {
    const counts = new Map<string, number>();
    for (const o of scopedOrders) {
      counts.set(o.customer, (counts.get(o.customer) ?? 0) + 1);
    }
    const arr = Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 7);
    const max = arr.reduce((m, x) => Math.max(m, x.count), 0) || 1;
    return arr.map((x) => ({ ...x, pct: (x.count / max) * 100 }));
  }, [scopedOrders]);

  const donut = useMemo(() => {
    const total =
      bucketCounts.delivered +
      bucketCounts.in_production +
      bucketCounts.pending +
      bucketCounts.delayed +
      bucketCounts.urgent;
    if (total === 0) {
      return {
        gradient: `conic-gradient(rgba(255,255,255,0.06) 0 100%)`,
        total: 0,
      };
    }
    let cursor = 0;
    const stops: string[] = [];
    for (const k of BUCKET_ORDER) {
      const pct = (bucketCounts[k] / total) * 100;
      const next = cursor + pct;
      stops.push(`${BUCKET_STYLE[k].dot} ${cursor}% ${next}%`);
      cursor = next;
    }
    return {
      gradient: `conic-gradient(${stops.join(", ")})`,
      total,
    };
  }, [bucketCounts]);

  const filteredList = useMemo(() => {
    let scoped = scopedOrders;
    if (supplierFilter) scoped = scoped.filter((o) => o.customer === supplierFilter);
    if (bucketFilter) scoped = scoped.filter((o) => bucketFor(o) === bucketFilter);
    const q = search.trim().toLowerCase();
    if (!q) return scoped;
    return scoped.filter(
      (o) =>
        o.order_number.toLowerCase().includes(q) ||
        o.customer.toLowerCase().includes(q) ||
        o.product_sku.toLowerCase().includes(q) ||
        o.product_name.toLowerCase().includes(q),
    );
  }, [scopedOrders, supplierFilter, bucketFilter, search]);

  const activeFilterChips: { label: string; clear: () => void }[] = [];
  if (supplierFilter)
    activeFilterChips.push({
      label: `Supplier: ${supplierFilter}`,
      clear: () => setSupplierFilter(null),
    });
  if (bucketFilter)
    activeFilterChips.push({
      label: `Status: ${BUCKET_STYLE[bucketFilter].label}`,
      clear: () => setBucketFilter(null),
    });

  return (
    <div
      style={{
        background: "#0f1117",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        color: "#e5e7eb",
      }}
    >
      {/* Top bar */}
      <header
        style={{
          height: 48,
          background: "#0f1117",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          padding: "0 20px",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div className="flex items-center gap-2">
          <div
            style={{
              width: 24,
              height: 24,
              background: "#4CAF50",
              borderRadius: 6,
              color: "#ffffff",
              fontSize: 12,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            aria-hidden
          >
            O
          </div>
          <span style={{ color: "#ffffff", fontSize: 14, fontWeight: 700 }}>
            OpenPrem — Orders
          </span>
          <span style={{ color: "#6b7280", fontSize: 11, marginLeft: 8 }}>
            · {instanceName}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <select
            value={timeRange}
            onChange={(e) =>
              setTimeRange(e.target.value as "7d" | "30d" | "all")
            }
            style={glassSelectStyle}
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="all">All time</option>
          </select>
          <select
            value={plantFilter}
            onChange={(e) => setPlantFilter(e.target.value)}
            style={glassSelectStyle}
          >
            {plants.map((p) => (
              <option key={p} value={p}>
                {p === "all" ? "All plants" : p}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              setNewOrderError(null);
              setNewOrderOpen(true);
            }}
            style={{
              background: "#4CAF50",
              color: "#ffffff",
              border: "none",
              padding: "6px 12px",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            + New Order
          </button>
          <button
            type="button"
            onClick={() => setApiKeysOpen(true)}
            title="Manage API keys"
            style={{
              ...glassSelectStyle,
              cursor: "pointer",
              padding: "6px 10px",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width="13"
              height="13"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <circle cx="7.5" cy="15.5" r="5.5" />
              <path d="m21 2-9.6 9.6" />
              <path d="m15.5 7.5 3 3L22 7l-3-3" />
            </svg>
            API Keys
          </button>
        </div>
      </header>

      {/* Split body */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "38% 1fr",
          flex: 1,
          overflow: "hidden",
        }}
      >
        {/* LEFT: analytics */}
        <aside
          style={{
            borderRight: "1px solid rgba(255,255,255,0.06)",
            overflowY: "auto",
            padding: 16,
          }}
        >
          <SectionTitle>Overview</SectionTitle>

          {loadError ? (
            <div
              style={{
                background: "rgba(239,68,68,0.15)",
                color: "#fca5a5",
                padding: "8px 12px",
                borderRadius: 6,
                fontSize: 11,
                marginBottom: 10,
              }}
            >
              {loadError}
            </div>
          ) : null}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
            }}
          >
            <KpiCard label="Total Orders" value={String(kpis.totalOrders)} />
            <KpiCard label="Total Value" value={formatMoney(kpis.totalValue)} />
            <KpiCard
              label="Urgent"
              value={String(kpis.urgent)}
              valueColor={kpis.urgent > 0 ? "#ef4444" : "#ffffff"}
            />
            <KpiCard
              label="Avg Fulfillment"
              value={kpis.avgFulfill > 0 ? `${kpis.avgFulfill}d` : "—"}
              hint={
                kpis.avgFulfill > 0
                  ? "mean of delivered durations"
                  : "no delivered orders in range"
              }
            />
          </div>

          {/* Bar chart */}
          <div
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 8,
              padding: 12,
              marginTop: 14,
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 10 }}>
              <SectionTitle inline>Orders by Supplier</SectionTitle>
              {supplierFilter ? (
                <button
                  type="button"
                  onClick={() => setSupplierFilter(null)}
                  style={{
                    fontSize: 9,
                    color: "#9ca3af",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    textDecoration: "underline",
                    padding: 0,
                  }}
                >
                  clear
                </button>
              ) : null}
            </div>
            {bars.length === 0 ? (
              <div style={{ color: "#6b7280", fontSize: 11 }}>No data.</div>
            ) : (
              <>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    gap: 5,
                    height: 70,
                  }}
                >
                  {bars.map((b) => {
                    const active = supplierFilter === b.name;
                    return (
                      <button
                        key={b.name}
                        type="button"
                        onClick={() =>
                          setSupplierFilter(active ? null : b.name)
                        }
                        title={`${b.name}: ${b.count}`}
                        style={{
                          flex: 1,
                          height: `${Math.max(6, b.pct)}%`,
                          background: active ? "#86efac" : "#4CAF50",
                          border: "none",
                          padding: 0,
                          borderTopLeftRadius: 3,
                          borderTopRightRadius: 3,
                          cursor: "pointer",
                          opacity: supplierFilter && !active ? 0.4 : 1,
                          transition: "opacity 120ms ease",
                        }}
                      />
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 5, marginTop: 6 }}>
                  {bars.map((b) => (
                    <div
                      key={`${b.name}-label`}
                      style={{
                        flex: 1,
                        fontSize: 8,
                        color: "#6b7280",
                        textAlign: "center",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {b.name}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Donut */}
          <div
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 8,
              padding: 12,
              marginTop: 14,
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 10 }}>
              <SectionTitle inline>Status Breakdown</SectionTitle>
              {bucketFilter ? (
                <button
                  type="button"
                  onClick={() => setBucketFilter(null)}
                  style={{
                    fontSize: 9,
                    color: "#9ca3af",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    textDecoration: "underline",
                    padding: 0,
                  }}
                >
                  clear
                </button>
              ) : null}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: "50%",
                  background: donut.gradient,
                  position: "relative",
                  flexShrink: 0,
                }}
                aria-label="Order status donut"
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 18,
                    background: "#0f1117",
                    borderRadius: "50%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#ffffff" }}>
                    {donut.total}
                  </div>
                  <div style={{ fontSize: 9, color: "#6b7280" }}>orders</div>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
                {BUCKET_ORDER.map((k) => {
                  const active = bucketFilter === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setBucketFilter(active ? null : k)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 10,
                        color: active ? "#ffffff" : "#9ca3af",
                        background: active ? "rgba(255,255,255,0.06)" : "transparent",
                        border: "none",
                        padding: "3px 6px",
                        borderRadius: 4,
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 2,
                          background: BUCKET_STYLE[k].dot,
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ flex: 1 }}>{BUCKET_STYLE[k].label}</span>
                      <span style={{ color: "#e5e7eb", fontVariantNumeric: "tabular-nums" }}>
                        {bucketCounts[k]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </aside>

        {/* RIGHT: order list */}
        <section style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <h2 style={{ fontSize: 12, color: "#ffffff", fontWeight: 600 }}>
              All Orders
            </h2>
            <span style={{ fontSize: 10, color: "#6b7280" }}>
              {filteredList.length} of {scopedOrders.length}
            </span>
            {activeFilterChips.map((c) => (
              <button
                key={c.label}
                type="button"
                onClick={c.clear}
                style={{
                  background: "rgba(255,255,255,0.08)",
                  color: "#e5e7eb",
                  border: "1px solid rgba(255,255,255,0.1)",
                  padding: "2px 8px",
                  borderRadius: 12,
                  fontSize: 10,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
                title="Click to remove filter"
              >
                {c.label}
                <span style={{ color: "#9ca3af" }}>×</span>
              </button>
            ))}
            <input
              type="search"
              placeholder="Search by supplier or order #…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                ...glassSelectStyle,
                width: 200,
                marginLeft: "auto",
                padding: "4px 10px",
              }}
            />
          </div>

          <div style={{ overflowY: "auto", flex: 1 }}>
            {orders === null ? (
              <div style={{ padding: 20, fontSize: 12, color: "#6b7280" }}>
                Loading orders…
              </div>
            ) : filteredList.length === 0 ? (
              <div style={{ padding: 20, fontSize: 12, color: "#6b7280" }}>
                No orders match the current filters.
              </div>
            ) : (
              filteredList.map((o) => (
                <OrderRow
                  key={o.id}
                  o={o}
                  expanded={expandedId === o.id}
                  busy={busyOrderId === o.id}
                  onToggle={() =>
                    setExpandedId((cur) => (cur === o.id ? null : o.id))
                  }
                  onAdvance={(target) => handleTransition(o, target)}
                />
              ))
            )}
          </div>
        </section>
      </div>

      <NewOrderModal
        open={newOrderOpen}
        busy={newOrderBusy}
        errorMessage={newOrderError}
        onCancel={() => {
          if (newOrderBusy) return;
          setNewOrderOpen(false);
          setNewOrderError(null);
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

const glassSelectStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "#aaa",
  borderRadius: 6,
  fontSize: 11,
  padding: "4px 10px",
  outline: "none",
};

function SectionTitle({
  children,
  inline,
}: {
  children: React.ReactNode;
  inline?: boolean;
}) {
  return (
    <div
      style={{
        fontSize: 10,
        color: "#6b7280",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        fontWeight: 700,
        marginBottom: inline ? 0 : 10,
      }}
    >
      {children}
    </div>
  );
}

function KpiCard({
  label,
  value,
  valueColor = "#ffffff",
  hint,
}: {
  label: string;
  value: string;
  valueColor?: string;
  hint?: string;
}) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 8,
        padding: 12,
      }}
    >
      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: valueColor,
          lineHeight: 1.1,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 10,
          color: "#6b7280",
          marginTop: 4,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      {hint ? (
        <div style={{ fontSize: 10, color: "#4b5563", marginTop: 2 }}>{hint}</div>
      ) : null}
    </div>
  );
}

function OrderRow({
  o,
  expanded,
  busy,
  onToggle,
  onAdvance,
}: {
  o: Order;
  expanded: boolean;
  busy: boolean;
  onToggle: () => void;
  onAdvance: (target: OrderStatus) => void;
}) {
  const bucket = bucketFor(o);
  const style = BUCKET_STYLE[bucket];
  const action = nextActionFor(o);
  return (
    <div
      style={{
        padding: "12px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        cursor: "pointer",
        transition: "background 120ms ease",
      }}
      onClick={onToggle}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 10,
              color: "#6b7280",
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            }}
          >
            {o.order_number}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "#ffffff",
              fontWeight: 500,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {o.customer}
          </div>
          <div
            style={{
              fontSize: 10,
              color: "#6b7280",
              marginTop: 2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {o.instance_name} · {o.product_name} × {o.quantity}
          </div>
          <span
            style={{
              display: "inline-block",
              marginTop: 6,
              background: style.bg,
              color: style.fg,
              fontSize: 9,
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: 10,
              letterSpacing: "0.03em",
              textTransform: bucket === "urgent" ? "uppercase" : "none",
            }}
          >
            {style.label}
          </span>
          {o.priority === "HIGH" ? (
            <span
              style={{
                marginLeft: 6,
                fontSize: 9,
                color: "#fcd34d",
              }}
            >
              HIGH
            </span>
          ) : null}
        </div>
        <div
          style={{
            textAlign: "right",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 4,
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: "#4CAF50",
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatMoney(o.total_value)}
          </div>
          <div
            style={{
              fontSize: 10,
              color: dueColor(o.due_date, o.status),
            }}
          >
            due {formatDate(o.due_date)}
          </div>
          {action ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAdvance(action.target);
              }}
              disabled={busy}
              style={{
                background: busy ? "rgba(255,255,255,0.06)" : "rgba(76,175,80,0.16)",
                color: busy ? "#6b7280" : "#86efac",
                border: "1px solid rgba(76,175,80,0.35)",
                borderRadius: 6,
                padding: "3px 10px",
                fontSize: 10,
                fontWeight: 600,
                cursor: busy ? "wait" : "pointer",
                marginTop: 4,
              }}
            >
              {busy ? "…" : action.label}
            </button>
          ) : null}
        </div>
      </div>

      {expanded ? (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            marginTop: 12,
            padding: 12,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 6,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
          }}
        >
          <Detail label="Product SKU" value={o.product_sku} mono />
          <Detail
            label="Unit price"
            value={`${formatMoney(o.unit_price)} × ${o.quantity}`}
          />
          <Detail label="Priority" value={o.priority} />
          <Detail label="Plant" value={o.instance_name} />
          <Detail
            label="Created"
            value={formatTimestamp(o.created_at)}
          />
          <Detail
            label="Last updated"
            value={formatTimestamp(o.updated_at)}
          />
          {o.notes ? (
            <div style={{ gridColumn: "1 / -1" }}>
              <Detail label="Notes" value={o.notes} />
            </div>
          ) : null}
          <div style={{ gridColumn: "1 / -1" }}>
            <div
              style={{
                fontSize: 9,
                color: "#6b7280",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                fontWeight: 700,
                marginBottom: 6,
              }}
            >
              Timeline
            </div>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <TimelineRow
                ts={o.created_at}
                label={`Created · ${STATUS_LABEL.PENDING}`}
              />
              {o.created_at !== o.updated_at ? (
                <TimelineRow
                  ts={o.updated_at}
                  label={`Updated · ${STATUS_LABEL[o.status]}`}
                  current
                />
              ) : null}
            </ul>
            <div style={{ fontSize: 9, color: "#4b5563", marginTop: 6 }}>
              Status change history isn&apos;t persisted by the orders API on this
              instance — showing creation and last update only.
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Detail({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 9,
          color: "#6b7280",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          fontWeight: 700,
        }}
      >
        {label}
      </div>
      <div
        style={{
          color: "#e5e7eb",
          fontSize: 11,
          marginTop: 2,
          fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function TimelineRow({
  ts,
  label,
  current,
}: {
  ts: string;
  label: string;
  current?: boolean;
}) {
  return (
    <li style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10 }}>
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: current ? "#4CAF50" : "#6b7280",
          flexShrink: 0,
        }}
      />
      <span style={{ color: "#9ca3af", minWidth: 90 }}>{formatTimestamp(ts)}</span>
      <span style={{ color: "#e5e7eb" }}>{label}</span>
    </li>
  );
}

// Re-export so the type isn't flagged unused at the import site
export type _OrderPriority = OrderPriority;
