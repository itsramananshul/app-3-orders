"use client";

export type ActivityAction =
  | "create"
  | "status_change"
  | "priority_change"
  | "note_added";

export type ActivityResult = "success" | "failure";

export interface ActivityEntry {
  id: string;
  timestamp: Date;
  action: ActivityAction;
  orderNumber: string;
  customer: string;
  detail: string;
  result: ActivityResult;
  message?: string;
}

interface ActivityFeedProps {
  entries: ActivityEntry[];
}

const actionStyles: Record<ActivityAction, string> = {
  create: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
  status_change: "bg-sky-500/10 text-sky-300 ring-sky-500/30",
  priority_change: "bg-violet-500/10 text-violet-300 ring-violet-500/30",
  note_added: "bg-slate-500/10 text-slate-300 ring-slate-500/30",
};

const actionLabels: Record<ActivityAction, string> = {
  create: "create",
  status_change: "status",
  priority_change: "priority",
  note_added: "note",
};

const resultStyles: Record<ActivityResult, string> = {
  success: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
  failure: "bg-rose-500/10 text-rose-300 ring-rose-500/30",
};

function formatTime(ts: Date): string {
  return ts.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function ActivityFeed({ entries }: ActivityFeedProps) {
  return (
    <section
      aria-label="Recent activity"
      className="rounded-xl bg-slate-900/40 ring-1 ring-slate-800"
    >
      <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">
            Recent Activity
          </h2>
          <p className="text-xs text-slate-500">
            Local session log. Clears when you reload the page.
          </p>
        </div>
        <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-xs font-medium text-slate-300">
          {entries.length}
        </span>
      </header>

      {entries.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-slate-500">
          No activity yet. Create an order or change a status to log events.
        </div>
      ) : (
        <ul className="max-h-80 divide-y divide-slate-800/70 overflow-y-auto">
          {entries.map((e) => (
            <li
              key={e.id}
              className="grid grid-cols-[auto_auto_1fr_auto] items-center gap-3 px-4 py-2.5 text-sm"
            >
              <span className="font-mono text-xs text-slate-500 tabular-nums">
                {formatTime(e.timestamp)}
              </span>
              <span
                className={`inline-flex rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset ${actionStyles[e.action]}`}
              >
                {actionLabels[e.action]}
              </span>
              <span className="min-w-0 truncate text-slate-200">
                <span className="font-mono text-xs text-slate-400">
                  {e.orderNumber}
                </span>
                <span className="mx-1 text-slate-600">·</span>
                <span className="text-slate-300">{e.customer}</span>
                <span className="mx-1 text-slate-600">·</span>
                <span className="text-slate-400">{e.detail}</span>
                {e.result === "failure" && e.message ? (
                  <span className="ml-1 text-xs text-rose-300/80">
                    — {e.message}
                  </span>
                ) : null}
              </span>
              <span
                className={`inline-flex rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset ${resultStyles[e.result]}`}
              >
                {e.result}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
