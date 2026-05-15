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

// ─── Display buckets ────────────────────────────────────────────────────
// The schema has six statuses and four priorities. The spec asks for four
// mutually-exclusive display buckets: Delivered, In Production, Pending,
// URGENT (priority overrides status).
type DisplayBucket = "delivered" | "in_production" | "pending" | "urgent";

function bucketFor(o: Order): DisplayBucket {
  if (o.priority === "URGENT") return "urgent";
  if (o.status === "DELIVERED") return "delivered";
  if (
    o.status === "IN_PRODUCTION" ||
    o.status === "READY_TO_SHIP" ||
    o.status === "SHIPPED"
  ) {
    return "in_production";
  }
  return "pending"; // covers PENDING, FLAGGED
}

const BUCKET_STYLE: Record<
  DisplayBucket,
  { label: string; bg: string; fg: string; dot: string }
> = {
  delivered: { label: "Delivered", bg: "rgba(76,175,80,0.2)", fg: "#86efac", dot: "#4CAF50" },
  in_production: { label: "In Production", bg: "rgba(59,130,246,0.2)", fg: "#93c5fd", dot: "#3b82f6" },
  pending: { label: "Pending", bg: "rgba(245,158,11,0.2)", fg: "#fcd34d", dot: "#f59e0b" },
  urgent: { label: "URGENT", bg: "rgba(239,68,68,0.2)", fg: "#fca5a5", dot: "#ef4444" },
};

function daysBetween(a: string, b: string): number {
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  if (Number.isNaN(da) || Number.isNaN(db)) return 0;
  return Math.max(0, Math.round((db - da) / (1000 * 60 * 60 * 24)));
}

function formatMillions(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}k`;
  return `$${Math.round(v)}`;
}

function formatDate(s: string): string {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function Dashboard({ instanceName }: DashboardProps) {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d" | "all">("30d");
  const [plantFilter, setPlantFilter] = useState<string>("all");

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

  // Time-range cutoff in ms
  const cutoffMs = useMemo(() => {
    if (timeRange === "all") return 0;
    const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;
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
      urgent: 0,
    };
    for (const o of scopedOrders) c[bucketFor(o)] += 1;
    return c;
  }, [scopedOrders]);

  const kpis = useMemo(() => {
    const list = scopedOrders;
    const totalOrders = list.length;
    const orderValue = list.reduce((s, o) => s + (o.total_value || 0), 0);
    const urgent = list.filter((o) => o.priority === "URGENT").length;
    const leadTimes = list
      .map((o) => daysBetween(o.created_at, o.due_date))
      .filter((d) => d > 0);
    const avgLead =
      leadTimes.length === 0
        ? 0
        : Math.round(leadTimes.reduce((s, d) => s + d, 0) / leadTimes.length);

    // Deltas vs prior period of equal length. Only meaningful when a finite
    // time range is applied; show "—" otherwise.
    let deltaOrders: number | null = null;
    let deltaValue: number | null = null;
    let deltaUrgent: number | null = null;
    let deltaLead: number | null = null;
    if (cutoffMs > 0) {
      const periodMs = Date.now() - cutoffMs;
      const priorStart = cutoffMs - periodMs;
      const prior = allOrders.filter((o) => {
        const t = new Date(o.created_at).getTime();
        return !Number.isNaN(t) && t >= priorStart && t < cutoffMs;
      });
      deltaOrders = totalOrders - prior.length;
      deltaValue =
        orderValue - prior.reduce((s, o) => s + (o.total_value || 0), 0);
      deltaUrgent =
        urgent - prior.filter((o) => o.priority === "URGENT").length;
      const priorLeads = prior
        .map((o) => daysBetween(o.created_at, o.due_date))
        .filter((d) => d > 0);
      const priorAvg =
        priorLeads.length === 0
          ? 0
          : Math.round(priorLeads.reduce((s, d) => s + d, 0) / priorLeads.length);
      deltaLead = avgLead - priorAvg;
    }
    return {
      totalOrders,
      orderValue,
      urgent,
      avgLead,
      deltaOrders,
      deltaValue,
      deltaUrgent,
      deltaLead,
    };
  }, [scopedOrders, allOrders, cutoffMs]);

  // Bar chart: top 7 by count, grouped by customer (treated as supplier here
  // since the orders schema has no separate supplier column).
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

  // Donut: 4 buckets as conic-gradient stops.
  const donut = useMemo(() => {
    const total = bucketCounts.delivered + bucketCounts.in_production + bucketCounts.pending + bucketCounts.urgent;
    if (total === 0) {
      return {
        gradient: `conic-gradient(rgba(255,255,255,0.06) 0 100%)`,
        slices: [
          { key: "delivered", count: 0 },
          { key: "in_production", count: 0 },
          { key: "pending", count: 0 },
          { key: "urgent", count: 0 },
        ] as { key: DisplayBucket; count: number }[],
        total: 0,
      };
    }
    let cursor = 0;
    const stops: string[] = [];
    const order: DisplayBucket[] = ["delivered", "in_production", "pending", "urgent"];
    for (const k of order) {
      const pct = (bucketCounts[k] / total) * 100;
      const next = cursor + pct;
      stops.push(`${BUCKET_STYLE[k].dot} ${cursor}% ${next}%`);
      cursor = next;
    }
    return {
      gradient: `conic-gradient(${stops.join(", ")})`,
      slices: order.map((k) => ({ key: k, count: bucketCounts[k] })),
      total,
    };
  }, [bucketCounts]);

  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return scopedOrders;
    return scopedOrders.filter(
      (o) =>
        o.order_number.toLowerCase().includes(q) ||
        o.customer.toLowerCase().includes(q) ||
        o.product_sku.toLowerCase().includes(q) ||
        o.product_name.toLowerCase().includes(q),
    );
  }, [scopedOrders, search]);

  return (
    <div
      style={{
        background: "#1a1d2e",
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
          background: "#1a1d2e",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
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
              setTimeRange(e.target.value as "7d" | "30d" | "90d" | "all")
            }
            style={glassSelectStyle}
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
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
          gridTemplateColumns: "1fr 1.2fr",
          flex: 1,
          overflow: "hidden",
        }}
      >
        {/* LEFT: analytics */}
        <aside
          style={{
            borderRight: "1px solid rgba(255,255,255,0.07)",
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
            <KpiCard
              label="Total Orders"
              value={String(kpis.totalOrders)}
              delta={kpis.deltaOrders}
            />
            <KpiCard
              label="Order Value"
              value={formatMillions(kpis.orderValue)}
              delta={kpis.deltaValue}
              deltaFormat={(d) => formatMillions(Math.abs(d))}
            />
            <KpiCard
              label="Urgent"
              value={String(kpis.urgent)}
              valueColor="#ef4444"
              delta={kpis.deltaUrgent}
              deltaInverted
            />
            <KpiCard
              label="Avg Lead Time"
              value={`${kpis.avgLead}d`}
              delta={kpis.deltaLead}
              deltaFormat={(d) => `${Math.abs(d)}d`}
              deltaInverted
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
            <SectionTitle>Orders by Supplier</SectionTitle>
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
                  {bars.map((b) => (
                    <div
                      key={b.name}
                      style={{
                        flex: 1,
                        height: `${Math.max(6, b.pct)}%`,
                        background: "#4CAF50",
                        borderTopLeftRadius: 3,
                        borderTopRightRadius: 3,
                      }}
                      title={`${b.name}: ${b.count}`}
                    />
                  ))}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 5,
                    marginTop: 6,
                  }}
                >
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
            <SectionTitle>Status Breakdown</SectionTitle>
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
                    background: "#1a1d2e",
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
                {donut.slices.map((s) => (
                  <div
                    key={s.key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 10,
                      color: "#9ca3af",
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 2,
                        background: BUCKET_STYLE[s.key].dot,
                      }}
                    />
                    <span style={{ flex: 1 }}>{BUCKET_STYLE[s.key].label}</span>
                    <span style={{ color: "#e5e7eb", fontVariantNumeric: "tabular-nums" }}>
                      {s.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* RIGHT: order list */}
        <section style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid rgba(255,255,255,0.07)",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <h2 style={{ fontSize: 12, color: "#ffffff", fontWeight: 600 }}>
              All Orders
            </h2>
            <span style={{ fontSize: 10, color: "#6b7280" }}>
              {filteredList.length} of {scopedOrders.length}
            </span>
            <input
              type="search"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                ...glassSelectStyle,
                width: 140,
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
              filteredList.map((o) => {
                const bucket = bucketFor(o);
                const style = BUCKET_STYLE[bucket];
                return (
                  <div
                    key={o.id}
                    style={{
                      padding: "12px 16px",
                      borderBottom: "1px solid rgba(255,255,255,0.05)",
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: 12,
                      transition: "background 120ms ease",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "rgba(255,255,255,0.03)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 10,
                          color: "#6b7280",
                          fontFamily:
                            'ui-monospace, SFMono-Regular, Menlo, monospace',
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
                          padding: "2px 7px",
                          borderRadius: 10,
                          letterSpacing: "0.03em",
                          textTransform: bucket === "urgent" ? "uppercase" : "none",
                        }}
                      >
                        {style.label}
                      </span>
                    </div>
                    <div
                      style={{
                        textAlign: "right",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
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
                        {formatMillions(o.total_value)}
                      </div>
                      <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>
                        due {formatDate(o.due_date)}
                      </div>
                      <PriorityHint priority={o.priority} />
                    </div>
                  </div>
                );
              })
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
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
      {children}
    </div>
  );
}

function KpiCard({
  label,
  value,
  valueColor = "#ffffff",
  delta,
  deltaFormat,
  deltaInverted,
}: {
  label: string;
  value: string;
  valueColor?: string;
  delta?: number | null;
  deltaFormat?: (n: number) => string;
  deltaInverted?: boolean;
}) {
  let deltaNode: React.ReactNode = null;
  if (delta === null || delta === undefined) {
    deltaNode = <span style={{ color: "#6b7280" }}>— vs prior period</span>;
  } else {
    const isPositive = delta > 0;
    const isNeutral = delta === 0;
    // For "good = lower" metrics (urgents, lead time), invert the color sense.
    const good = deltaInverted ? delta < 0 : delta > 0;
    const color = isNeutral
      ? "#6b7280"
      : good
        ? "#4CAF50"
        : "#ef4444";
    const sign = isPositive ? "+" : delta < 0 ? "−" : "";
    const formatted = deltaFormat ? deltaFormat(delta) : String(Math.abs(delta));
    deltaNode = (
      <span style={{ color }}>
        {sign}
        {formatted} vs prior
      </span>
    );
  }
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
      <div style={{ fontSize: 10, marginTop: 2 }}>{deltaNode}</div>
    </div>
  );
}

function PriorityHint({ priority }: { priority: OrderPriority }) {
  if (priority === "URGENT" || priority === "HIGH") {
    return (
      <div style={{ fontSize: 9, color: "#fcd34d", marginTop: 2 }}>
        {priority}
      </div>
    );
  }
  return null;
}
