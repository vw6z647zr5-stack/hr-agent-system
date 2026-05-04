interface FunnelItem {
  label: string;
  value: number;
  color: string;
}

interface FunnelChartProps {
  title: string;
  items: FunnelItem[];
}

export function FunnelChart({ title, items }: FunnelChartProps) {
  const max = Math.max(...items.map((it) => it.value), 1);

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-panel">
      <h4 className="text-sm font-semibold text-ink mb-5">{title}</h4>
      <div className="flex flex-col items-center gap-0">
        {items.map((item, i) => {
          const widthPct = Math.max(20, Math.round((item.value / max) * 100));
          const prevValue = i > 0 ? (items[i - 1]?.value ?? item.value) : item.value;
          const conversionRate = i > 0 && prevValue > 0 ? Math.round((item.value / prevValue) * 100) : null;
          const isFirst = i === 0;
          const isLast = i === items.length - 1;

          return (
            <div key={i} className="flex flex-col items-center w-full">
              {/* Stage label + count above the bar */}
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-xs font-medium text-slate-600">{item.label}</span>
                <span className="text-xs text-slate-400">·</span>
                <span className="text-sm font-bold text-ink tabular-nums">{item.value}</span>
                {conversionRate !== null && (
                  <span className="text-[11px] text-slate-400 tabular-nums">({conversionRate}%)</span>
                )}
              </div>
              {/* Bar */}
              <div
                className="h-3 transition-all duration-500"
                style={{
                  width: `${widthPct}%`,
                  minWidth: 80,
                  backgroundColor: item.color,
                  borderRadius: isFirst ? '12px 12px 3px 3px' : isLast ? '3px 3px 12px 12px' : '3px',
                  boxShadow: `0 1px 4px ${item.color}44`,
                }}
              />
              {!isLast && (
                <div className="h-5 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 16 16">
                    <path d="M8 4v6M4 8l4 4 4-4" stroke="#cbd5e1" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
