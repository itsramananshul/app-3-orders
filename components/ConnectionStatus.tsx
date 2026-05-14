"use client";

export type ConnectionState = "connecting" | "live" | "reconnecting" | "stale";

interface ConnectionStatusProps {
  state: ConnectionState;
}

const config: Record<
  ConnectionState,
  { label: string; dot: string; chip: string; pulse: boolean }
> = {
  connecting: {
    label: "Connecting",
    dot: "bg-slate-400",
    chip: "bg-slate-500/10 text-slate-300 ring-slate-500/30",
    pulse: true,
  },
  live: {
    label: "Live",
    dot: "bg-emerald-400",
    chip: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
    pulse: true,
  },
  reconnecting: {
    label: "Reconnecting",
    dot: "bg-amber-400",
    chip: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
    pulse: true,
  },
  stale: {
    label: "Stale",
    dot: "bg-rose-500",
    chip: "bg-rose-500/10 text-rose-300 ring-rose-500/30",
    pulse: false,
  },
};

export function ConnectionStatus({ state }: ConnectionStatusProps) {
  const c = config[state];
  return (
    <span
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${c.chip}`}
    >
      <span className="relative inline-flex h-2 w-2">
        {c.pulse ? (
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${c.dot}`}
          />
        ) : null}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${c.dot}`} />
      </span>
      {c.label}
    </span>
  );
}
