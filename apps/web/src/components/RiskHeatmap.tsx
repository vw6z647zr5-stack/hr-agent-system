export interface RiskItem {
  label: string;
  value: number;
  helper: string;
  level: 'low' | 'medium' | 'high';
}

interface RiskHeatmapProps {
  items: RiskItem[];
  className?: string;
}

const levelConfig = {
  low: {
    bg: '#f0fdf4',
    border: '#bbf7d0',
    dot: '#22c55e',
    gradient: 'from-emerald-50 to-white',
    pulse: false,
    label: '低',
    ringColor: '#22c55e',
  },
  medium: {
    bg: '#fefce8',
    border: '#fde68a',
    dot: '#eab308',
    gradient: 'from-amber-50 to-white',
    pulse: false,
    label: '中',
    ringColor: '#eab308',
  },
  high: {
    bg: '#fef2f2',
    border: '#fecaca',
    dot: '#ef4444',
    gradient: 'from-red-50 to-white',
    pulse: true,
    label: '高',
    ringColor: '#ef4444',
  },
};

export function RiskHeatmap({ items, className }: RiskHeatmapProps) {
  const maxValue = Math.max(...items.map((it) => it.value), 1);

  return (
    <div className={`grid gap-4 sm:grid-cols-2 ${className ?? ''}`}>
      {items.map((item, i) => {
        const cfg = levelConfig[item.level] ?? levelConfig.low;
        const barWidth = Math.max(8, Math.round((item.value / maxValue) * 100));
        return (
          <div
            key={i}
            className="relative rounded-2xl border p-5 transition-shadow hover:shadow-md"
            style={{ borderColor: cfg.border, backgroundColor: cfg.bg }}
          >
            {cfg.pulse && (
              <span className="absolute top-3 right-3 flex h-2.5 w-2.5">
                <span
                  className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                  style={{ backgroundColor: cfg.dot }}
                />
                <span
                  className="relative inline-flex rounded-full h-2.5 w-2.5"
                  style={{ backgroundColor: cfg.dot }}
                />
              </span>
            )}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-ink">{item.label}</div>
                <div className="text-xs text-slate-500 mt-1">{item.helper}</div>
              </div>
              <div className="shrink-0 flex flex-col items-end gap-2">
                <span className="text-3xl font-bold text-ink tabular-nums">{item.value}</span>
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full uppercase"
                  style={{ backgroundColor: cfg.dot, color: '#fff' }}
                >
                  {cfg.label}
                </span>
              </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/60">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${barWidth}%`,
                  backgroundColor: cfg.dot,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
