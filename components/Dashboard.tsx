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

  const [topTab, setTopTab] = useState<"orders" | "customers" | "products" | "reports">("orders");
  const [search, setSearch] = useState("");
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "all">("30d");
  const [plantFilter, setPlantFilter] = useState<string>("all");
  const [supplierFilter, setSupplierFilter] = useState<string | null>(null);
  const [productFilter, setProductFilter] = useState<string | null>(null);
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
    if (productFilter) scoped = scoped.filter((o) => o.product_sku === productFilter);
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
  }, [scopedOrders, supplierFilter, productFilter, bucketFilter, search]);

  const activeFilterChips: { label: string; clear: () => void }[] = [];
  if (supplierFilter)
    activeFilterChips.push({
      label: `Customer: ${supplierFilter}`,
      clear: () => setSupplierFilter(null),
    });
  if (productFilter) {
    const productName =
      scopedOrders.find((o) => o.product_sku === productFilter)?.product_name ??
      productFilter;
    activeFilterChips.push({
      label: `Product: ${productName}`,
      clear: () => setProductFilter(null),
    });
  }
  if (bucketFilter)
    activeFilterChips.push({
      label: `Status: ${BUCKET_STYLE[bucketFilter].label}`,
      clear: () => setBucketFilter(null),
    });

  // ─── Tab data: customers, products, reports ───────────────────────────
  const customerRows = useMemo(() => {
    const m = new Map<
      string,
      {
        customer: string;
        orders: number;
        value: number;
        last: string;
        delivered: number;
        pending: number;
        productCounts: Map<string, number>;
      }
    >();
    for (const o of scopedOrders) {
      const g =
        m.get(o.customer) ?? {
          customer: o.customer,
          orders: 0,
          value: 0,
          last: o.created_at,
          delivered: 0,
          pending: 0,
          productCounts: new Map<string, number>(),
        };
      g.orders += 1;
      g.value += o.total_value || 0;
      if (new Date(o.created_at).getTime() > new Date(g.last).getTime()) g.last = o.created_at;
      if (o.status === "DELIVERED") g.delivered += 1;
      else if (o.status === "PENDING") g.pending += 1;
      g.productCounts.set(o.product_name, (g.productCounts.get(o.product_name) ?? 0) + 1);
      m.set(o.customer, g);
    }
    return Array.from(m.values()).map((g) => {
      let topProduct = "—";
      let topCount = 0;
      for (const [name, count] of g.productCounts) {
        if (count > topCount) {
          topProduct = name;
          topCount = count;
        }
      }
      return {
        customer: g.customer,
        orders: g.orders,
        value: g.value,
        last: g.last,
        delivered: g.delivered,
        pending: g.pending,
        topProduct,
      };
    });
  }, [scopedOrders]);

  const productRows = useMemo(() => {
    const m = new Map<
      string,
      {
        sku: string;
        name: string;
        times: number;
        quantity: number;
        value: number;
        plantCounts: Map<string, number>;
        last: string;
      }
    >();
    for (const o of scopedOrders) {
      const g =
        m.get(o.product_sku) ?? {
          sku: o.product_sku,
          name: o.product_name,
          times: 0,
          quantity: 0,
          value: 0,
          plantCounts: new Map<string, number>(),
          last: o.created_at,
        };
      g.times += 1;
      g.quantity += o.quantity;
      g.value += o.total_value || 0;
      g.plantCounts.set(o.instance_name, (g.plantCounts.get(o.instance_name) ?? 0) + 1);
      if (new Date(o.created_at).getTime() > new Date(g.last).getTime()) g.last = o.created_at;
      m.set(o.product_sku, g);
    }
    return Array.from(m.values()).map((g) => {
      let topPlant = "—";
      let topCount = 0;
      for (const [name, count] of g.plantCounts) {
        if (count > topCount) {
          topPlant = name;
          topCount = count;
        }
      }
      return {
        sku: g.sku,
        name: g.name,
        times: g.times,
        quantity: g.quantity,
        value: g.value,
        topPlant,
        last: g.last,
      };
    });
  }, [scopedOrders]);

  const reportsData = useMemo(() => {
    const list = scopedOrders;
    const statusCounts: Record<DisplayBucket, number> = {
      delivered: 0,
      in_production: 0,
      pending: 0,
      delayed: 0,
      urgent: 0,
    };
    for (const o of list) statusCounts[bucketFor(o)] += 1;

    // Weekly volume from created_at — last 8 weeks
    const weekly = new Map<string, number>();
    for (const o of list) {
      const d = new Date(o.created_at);
      if (Number.isNaN(d.getTime())) continue;
      const day = (d.getUTCDay() + 6) % 7;
      const monday = new Date(d);
      monday.setUTCDate(d.getUTCDate() - day);
      const key = monday.toISOString().slice(0, 10);
      weekly.set(key, (weekly.get(key) ?? 0) + 1);
    }
    const weeklyArr = Array.from(weekly.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-8);

    // Top customers by value
    const topCustomers = customerRows
      .slice()
      .sort((a, b) => b.value - a.value)
      .slice(0, 7);

    return { statusCounts, weeklyArr, topCustomers };
  }, [scopedOrders, customerRows]);

  const switchToOrdersFor = useCallback(
    (opts: { customer?: string; productSku?: string }) => {
      if (opts.customer) {
        setSupplierFilter(opts.customer);
        setProductFilter(null);
      }
      if (opts.productSku) {
        setProductFilter(opts.productSku);
        setSupplierFilter(null);
      }
      setBucketFilter(null);
      setTopTab("orders");
    },
    [],
  );

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

      {/* Tab bar */}
      <TabsBar tab={topTab} onChange={setTopTab} />

      {topTab === "orders" ? (
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
      ) : topTab === "customers" ? (
        <CustomersView
          rows={customerRows}
          onView={(c) => switchToOrdersFor({ customer: c })}
        />
      ) : topTab === "products" ? (
        <ProductsView
          rows={productRows}
          onView={(sku) => switchToOrdersFor({ productSku: sku })}
        />
      ) : (
        <ReportsView data={reportsData} />
      )}

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

// ─── Tabs + alternate views ───────────────────────────────────────────────

const TABS: { key: "orders" | "customers" | "products" | "reports"; label: string }[] = [
  { key: "orders", label: "Orders" },
  { key: "customers", label: "Customers" },
  { key: "products", label: "Products" },
  { key: "reports", label: "Reports" },
];

function TabsBar({
  tab,
  onChange,
}: {
  tab: "orders" | "customers" | "products" | "reports";
  onChange: (t: "orders" | "customers" | "products" | "reports") => void;
}) {
  return (
    <div
      style={{
        background: "#0f1117",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "0 20px",
        display: "flex",
        alignItems: "stretch",
      }}
    >
      {TABS.map((t) => {
        const active = tab === t.key;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "10px 16px",
              fontSize: 12,
              color: active ? "#4CAF50" : "#9ca3af",
              fontWeight: active ? 600 : 500,
              borderBottom: active ? "2px solid #4CAF50" : "2px solid transparent",
              marginBottom: -1,
              transition: "color 120ms ease",
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

type CustomerRow = {
  customer: string;
  orders: number;
  value: number;
  last: string;
  delivered: number;
  pending: number;
  topProduct: string;
};

type ProductRow = {
  sku: string;
  name: string;
  times: number;
  quantity: number;
  value: number;
  topPlant: string;
  last: string;
};

function ViewHeader({
  title,
  count,
  search,
  onSearch,
  placeholder,
}: {
  title: string;
  count: string;
  search: string;
  onSearch: (s: string) => void;
  placeholder: string;
}) {
  return (
    <div
      style={{
        padding: "14px 20px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <h2 style={{ fontSize: 14, color: "#ffffff", fontWeight: 600 }}>{title}</h2>
      <span style={{ fontSize: 11, color: "#6b7280" }}>{count}</span>
      <input
        type="search"
        placeholder={placeholder}
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        style={{
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "#e5e7eb",
          borderRadius: 6,
          fontSize: 11,
          padding: "4px 10px",
          outline: "none",
          width: 240,
          marginLeft: "auto",
        }}
      />
    </div>
  );
}

type SortDir = "asc" | "desc";

function SortHeader<K extends string>({
  label,
  col,
  sortCol,
  dir,
  onChange,
  align = "left",
}: {
  label: string;
  col: K;
  sortCol: K;
  dir: SortDir;
  onChange: (col: K) => void;
  align?: "left" | "right";
}) {
  const active = sortCol === col;
  return (
    <th
      style={{
        padding: "10px 14px",
        textAlign: align,
        color: active ? "#e5e7eb" : "#6b7280",
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        fontWeight: 700,
        cursor: "pointer",
        userSelect: "none",
        whiteSpace: "nowrap",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(255,255,255,0.02)",
      }}
      onClick={() => onChange(col)}
    >
      {label}
      {active ? (dir === "asc" ? " ▲" : " ▼") : ""}
    </th>
  );
}

function CustomersView({
  rows,
  onView,
}: {
  rows: CustomerRow[];
  onView: (customer: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<keyof CustomerRow>("orders");
  const [dir, setDir] = useState<SortDir>("desc");
  const toggleSort = (c: keyof CustomerRow) => {
    if (c === sortCol) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortCol(c);
      setDir(c === "customer" || c === "topProduct" ? "asc" : "desc");
    }
  };
  const q = search.trim().toLowerCase();
  const filtered = q
    ? rows.filter(
        (r) =>
          r.customer.toLowerCase().includes(q) ||
          r.topProduct.toLowerCase().includes(q),
      )
    : rows;
  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortCol];
    const bv = b[sortCol];
    let cmp = 0;
    if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
    else cmp = String(av).localeCompare(String(bv));
    return dir === "asc" ? cmp : -cmp;
  });
  return (
    <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
      <ViewHeader
        title="Customers"
        count={`${filtered.length} of ${rows.length}`}
        search={search}
        onSearch={setSearch}
        placeholder="Search customer or top product…"
      />
      <div style={{ overflowY: "auto", flex: 1 }}>
        {rows.length === 0 ? (
          <Empty>No orders yet. Create your first order to see customer breakdowns here.</Empty>
        ) : sorted.length === 0 ? (
          <Empty>No customers match the search.</Empty>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                <SortHeader label="Customer" col="customer" sortCol={sortCol} dir={dir} onChange={toggleSort} />
                <SortHeader label="Orders" col="orders" sortCol={sortCol} dir={dir} onChange={toggleSort} align="right" />
                <SortHeader label="Total value" col="value" sortCol={sortCol} dir={dir} onChange={toggleSort} align="right" />
                <SortHeader label="Last order" col="last" sortCol={sortCol} dir={dir} onChange={toggleSort} />
                <SortHeader label="Top product" col="topProduct" sortCol={sortCol} dir={dir} onChange={toggleSort} />
                <SortHeader label="Delivered" col="delivered" sortCol={sortCol} dir={dir} onChange={toggleSort} align="right" />
                <SortHeader label="Pending" col="pending" sortCol={sortCol} dir={dir} onChange={toggleSort} align="right" />
                <th
                  style={{
                    padding: "10px 14px",
                    textAlign: "right",
                    color: "#6b7280",
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    fontWeight: 700,
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                    background: "rgba(255,255,255,0.02)",
                  }}
                />
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.customer} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <td style={{ padding: "10px 14px", color: "#ffffff", fontWeight: 500 }}>{r.customer}</td>
                  <td style={{ padding: "10px 14px", textAlign: "right", color: "#e5e7eb", fontVariantNumeric: "tabular-nums" }}>{r.orders}</td>
                  <td style={{ padding: "10px 14px", textAlign: "right", color: "#4CAF50", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{formatMoney(r.value)}</td>
                  <td style={{ padding: "10px 14px", color: "#9ca3af", fontSize: 11 }}>{formatDate(r.last)}</td>
                  <td style={{ padding: "10px 14px", color: "#cbd5e1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 }}>{r.topProduct}</td>
                  <td style={{ padding: "10px 14px", textAlign: "right", color: "#86efac", fontVariantNumeric: "tabular-nums" }}>{r.delivered}</td>
                  <td style={{ padding: "10px 14px", textAlign: "right", color: r.pending > 0 ? "#fcd34d" : "#9ca3af", fontVariantNumeric: "tabular-nums" }}>{r.pending}</td>
                  <td style={{ padding: "10px 14px", textAlign: "right" }}>
                    <button
                      type="button"
                      onClick={() => onView(r.customer)}
                      style={{
                        background: "rgba(76,175,80,0.16)",
                        color: "#86efac",
                        border: "1px solid rgba(76,175,80,0.35)",
                        borderRadius: 6,
                        padding: "3px 10px",
                        fontSize: 10,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      View Orders
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ProductsView({
  rows,
  onView,
}: {
  rows: ProductRow[];
  onView: (sku: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<keyof ProductRow>("times");
  const [dir, setDir] = useState<SortDir>("desc");
  const toggleSort = (c: keyof ProductRow) => {
    if (c === sortCol) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortCol(c);
      setDir(c === "name" || c === "sku" || c === "topPlant" ? "asc" : "desc");
    }
  };
  const q = search.trim().toLowerCase();
  const filtered = q
    ? rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.sku.toLowerCase().includes(q) ||
          r.topPlant.toLowerCase().includes(q),
      )
    : rows;
  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortCol];
    const bv = b[sortCol];
    let cmp = 0;
    if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
    else cmp = String(av).localeCompare(String(bv));
    return dir === "asc" ? cmp : -cmp;
  });
  return (
    <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
      <ViewHeader
        title="Products"
        count={`${filtered.length} of ${rows.length}`}
        search={search}
        onSearch={setSearch}
        placeholder="Search product, SKU, plant…"
      />
      <div style={{ overflowY: "auto", flex: 1 }}>
        {rows.length === 0 ? (
          <Empty>No products ordered yet.</Empty>
        ) : sorted.length === 0 ? (
          <Empty>No products match the search.</Empty>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                <SortHeader label="Product" col="name" sortCol={sortCol} dir={dir} onChange={toggleSort} />
                <SortHeader label="SKU" col="sku" sortCol={sortCol} dir={dir} onChange={toggleSort} />
                <SortHeader label="Times ordered" col="times" sortCol={sortCol} dir={dir} onChange={toggleSort} align="right" />
                <SortHeader label="Total qty" col="quantity" sortCol={sortCol} dir={dir} onChange={toggleSort} align="right" />
                <SortHeader label="Total value" col="value" sortCol={sortCol} dir={dir} onChange={toggleSort} align="right" />
                <SortHeader label="Primary plant" col="topPlant" sortCol={sortCol} dir={dir} onChange={toggleSort} />
                <SortHeader label="Last ordered" col="last" sortCol={sortCol} dir={dir} onChange={toggleSort} />
                <th style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.sku} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <td style={{ padding: "10px 14px", color: "#ffffff", fontWeight: 500, maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</td>
                  <td style={{ padding: "10px 14px", color: "#9ca3af", fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11 }}>{r.sku}</td>
                  <td style={{ padding: "10px 14px", textAlign: "right", color: "#e5e7eb", fontVariantNumeric: "tabular-nums" }}>{r.times}</td>
                  <td style={{ padding: "10px 14px", textAlign: "right", color: "#cbd5e1", fontVariantNumeric: "tabular-nums" }}>{r.quantity.toLocaleString()}</td>
                  <td style={{ padding: "10px 14px", textAlign: "right", color: "#4CAF50", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{formatMoney(r.value)}</td>
                  <td style={{ padding: "10px 14px", color: "#cbd5e1" }}>{r.topPlant}</td>
                  <td style={{ padding: "10px 14px", color: "#9ca3af", fontSize: 11 }}>{formatDate(r.last)}</td>
                  <td style={{ padding: "10px 14px", textAlign: "right" }}>
                    <button
                      type="button"
                      onClick={() => onView(r.sku)}
                      style={{
                        background: "rgba(76,175,80,0.16)",
                        color: "#86efac",
                        border: "1px solid rgba(76,175,80,0.35)",
                        borderRadius: 6,
                        padding: "3px 10px",
                        fontSize: 10,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      View Orders
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ReportsView({
  data,
}: {
  data: {
    statusCounts: Record<DisplayBucket, number>;
    weeklyArr: [string, number][];
    topCustomers: CustomerRow[];
  };
}) {
  const total = BUCKET_ORDER.reduce((s, k) => s + data.statusCounts[k], 0);
  const wkMax = data.weeklyArr.reduce((m, [, c]) => Math.max(m, c), 0) || 1;
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
        }}
      >
        <Panel title="Orders by Status">
          {total === 0 ? (
            <div style={{ color: "#6b7280", fontSize: 12 }}>No orders in this range.</div>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {BUCKET_ORDER.map((k) => {
                const pct = (data.statusCounts[k] / total) * 100;
                return (
                  <li key={k}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                      <span style={{ color: "#cbd5e1" }}>{BUCKET_STYLE[k].label}</span>
                      <span style={{ color: "#9ca3af", fontVariantNumeric: "tabular-nums" }}>
                        {data.statusCounts[k]} ({Math.round(pct)}%)
                      </span>
                    </div>
                    <div
                      style={{
                        marginTop: 3,
                        height: 8,
                        background: "rgba(255,255,255,0.06)",
                        borderRadius: 4,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${pct}%`,
                          height: "100%",
                          background: BUCKET_STYLE[k].dot,
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Orders by Week">
          {data.weeklyArr.length === 0 ? (
            <div style={{ color: "#6b7280", fontSize: 12 }}>No orders in this range.</div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 100 }}>
                {data.weeklyArr.map(([wk, c]) => (
                  <div
                    key={wk}
                    title={`${wk}: ${c}`}
                    style={{
                      flex: 1,
                      height: `${Math.max(6, (c / wkMax) * 100)}%`,
                      background: "#4CAF50",
                      borderTopLeftRadius: 3,
                      borderTopRightRadius: 3,
                    }}
                  />
                ))}
              </div>
              <div style={{ display: "flex", gap: 5, marginTop: 4 }}>
                {data.weeklyArr.map(([wk]) => (
                  <div
                    key={wk}
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
                    {wk.slice(5)}
                  </div>
                ))}
              </div>
            </>
          )}
        </Panel>

        <Panel title="Top Customers by Value" full>
          {data.topCustomers.length === 0 ? (
            <div style={{ color: "#6b7280", fontSize: 12 }}>No customers yet.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={reportTh}>Customer</th>
                  <th style={{ ...reportTh, textAlign: "right" }}>Orders</th>
                  <th style={{ ...reportTh, textAlign: "right" }}>Total value</th>
                  <th style={{ ...reportTh, textAlign: "right" }}>Delivered</th>
                  <th style={{ ...reportTh, textAlign: "right" }}>Pending</th>
                </tr>
              </thead>
              <tbody>
                {data.topCustomers.map((c) => (
                  <tr key={c.customer} style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ padding: "8px 14px", color: "#ffffff" }}>{c.customer}</td>
                    <td style={{ padding: "8px 14px", textAlign: "right", color: "#e5e7eb", fontVariantNumeric: "tabular-nums" }}>{c.orders}</td>
                    <td style={{ padding: "8px 14px", textAlign: "right", color: "#4CAF50", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{formatMoney(c.value)}</td>
                    <td style={{ padding: "8px 14px", textAlign: "right", color: "#86efac", fontVariantNumeric: "tabular-nums" }}>{c.delivered}</td>
                    <td style={{ padding: "8px 14px", textAlign: "right", color: c.pending > 0 ? "#fcd34d" : "#9ca3af", fontVariantNumeric: "tabular-nums" }}>{c.pending}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </div>
  );
}

const reportTh: React.CSSProperties = {
  padding: "8px 14px",
  textAlign: "left",
  color: "#6b7280",
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  fontWeight: 700,
};

function Panel({
  title,
  full,
  children,
}: {
  title: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 8,
        padding: 14,
        gridColumn: full ? "1 / -1" : undefined,
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: "#6b7280",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          fontWeight: 700,
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: 32, textAlign: "center", color: "#6b7280", fontSize: 12 }}>
      {children}
    </div>
  );
}
