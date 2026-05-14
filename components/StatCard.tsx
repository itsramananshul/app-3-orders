interface StatCardProps {
  label: string;
  value: number | string;
  hint?: string;
  tone?: "default" | "warning" | "danger" | "success";
}

const toneStyles: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "from-slate-800/60 to-slate-900/60 ring-slate-700/50",
  success: "from-emerald-900/40 to-slate-900/60 ring-emerald-700/40",
  warning: "from-amber-900/40 to-slate-900/60 ring-amber-700/40",
  danger: "from-rose-900/40 to-slate-900/60 ring-rose-700/40",
};

const valueTone: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "text-slate-100",
  success: "text-emerald-200",
  warning: "text-amber-200",
  danger: "text-rose-200",
};

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: StatCardProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-gradient-to-br p-5 ring-1 ring-inset ${toneStyles[tone]}`}
    >
      <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p
        className={`mt-2 text-3xl font-semibold tabular-nums ${valueTone[tone]}`}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}
