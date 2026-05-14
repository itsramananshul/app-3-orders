"use client";

export interface DonutSlice {
  label: string;
  value: number;
  hex: string;
}

interface DonutChartProps {
  total: number;
  centerLabel: string;
  slices: DonutSlice[];
}

export function DonutChart({ total, centerLabel, slices }: DonutChartProps) {
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const totalForArc = slices.reduce((sum, s) => sum + s.value, 0);
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-center">
      <div className="relative h-44 w-44 shrink-0">
        <svg viewBox="0 0 160 160" className="-rotate-90">
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke="#F3F4F6"
            strokeWidth="18"
          />
          {totalForArc > 0
            ? slices.map((slice) => {
                if (slice.value <= 0) return null;
                const length = (slice.value / totalForArc) * circumference;
                const gap = circumference - length;
                const seg = (
                  <circle
                    key={slice.label}
                    cx="80"
                    cy="80"
                    r={radius}
                    fill="none"
                    stroke={slice.hex}
                    strokeWidth="18"
                    strokeDasharray={`${length} ${gap}`}
                    strokeDashoffset={-offset}
                    strokeLinecap="butt"
                  />
                );
                offset += length;
                return seg;
              })
            : null}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold tabular-nums text-gray-900">
            {total}
          </span>
          <span className="text-xs text-gray-500">{centerLabel}</span>
        </div>
      </div>
      <ul className="flex-1 space-y-3 self-stretch">
        {slices.map((slice) => (
          <li
            key={slice.label}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="flex items-center gap-2 text-gray-700">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: slice.hex }}
                aria-hidden
              />
              {slice.label}
            </span>
            <span className="font-medium tabular-nums text-gray-900">
              {slice.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
