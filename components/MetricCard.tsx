"use client";

interface MetricCardProps {
  label: string;
  value: number | string;
  hint?: string;
  onViewDetail?: () => void;
}

export function MetricCard({ label, value, hint, onViewDetail }: MetricCardProps) {
  return (
    <div className="flex flex-col rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100 transition-shadow hover:shadow-md">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
        {label}
      </p>
      <p className="mt-3 text-3xl font-bold tabular-nums text-gray-900">{value}</p>
      {hint ? (
        <p className="mt-1 text-xs text-gray-400">{hint}</p>
      ) : (
        <p className="mt-1 h-4" aria-hidden />
      )}
      <button
        type="button"
        onClick={onViewDetail}
        disabled={!onViewDetail}
        className="mt-3 inline-flex items-center gap-1 self-start rounded text-xs font-medium text-teal-600 hover:text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 disabled:cursor-default disabled:text-gray-300"
      >
        View detail
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3 w-3"
          aria-hidden
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </div>
  );
}
