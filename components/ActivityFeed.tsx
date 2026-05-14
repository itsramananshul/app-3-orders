"use client";

import type { OrderStatus } from "@/lib/types";

export type ActivityAction = "created" | "status_change";

export interface ActivityEntry {
  id: string;
  timestamp: Date;
  action: ActivityAction;
  orderNumber: string;
  customer: string;
  fromStatus?: OrderStatus;
  toStatus?: OrderStatus;
  detail?: string;
  result: "success" | "failure";
  message?: string;
}

interface ActivityFeedProps {
  entries: ActivityEntry[];
}

const actionLabel: Record<ActivityAction, string> = {
  created: "Created",
  status_change: "Status changed",
};

const actionDot: Record<ActivityAction, string> = {
  created: "#14b8a6",
  status_change: "#3b82f6",
};

function formatTime(d: Date): string {
  try {
    return d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return d.toISOString().slice(11, 19);
  }
}

function prettyStatus(s: OrderStatus): string {
  return s
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ActivityFeed({ entries }: ActivityFeedProps) {
  return (
    <section className="h-full rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
      <header className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Live
          </p>
          <h2 className="text-lg font-semibold text-gray-900">Activity Feed</h2>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Live
        </span>
      </header>
      {entries.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">
          No actions yet. Create an order or advance its status to see it here.
        </p>
      ) : (
        <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {entries.map((e) => {
            const transition =
              e.action === "status_change" && e.fromStatus && e.toStatus
                ? `${prettyStatus(e.fromStatus)} → ${prettyStatus(e.toStatus)}`
                : e.detail ?? "";
            return (
              <li
                key={e.id}
                className={`flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 ${
                  e.result === "failure" ? "border-rose-100 bg-rose-50/40" : ""
                }`}
              >
                <span
                  aria-hidden
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                  style={{
                    background:
                      e.result === "failure" ? "#ef4444" : actionDot[e.action],
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-gray-800">
                    <span className="font-medium">{actionLabel[e.action]}</span>{" "}
                    <span className="font-mono text-[11px] text-gray-500">
                      {e.orderNumber}
                    </span>
                    {transition ? (
                      <>
                        {" — "}
                        <span className="text-gray-600">{transition}</span>
                      </>
                    ) : null}
                    {e.customer ? (
                      <span className="ml-1 text-xs text-gray-400">
                        · {e.customer}
                      </span>
                    ) : null}
                  </p>
                  {e.result === "failure" && e.message ? (
                    <p className="mt-0.5 truncate text-xs text-rose-600">
                      {e.message}
                    </p>
                  ) : null}
                </div>
                <span className="shrink-0 text-[11px] tabular-nums text-gray-400">
                  {formatTime(e.timestamp)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
