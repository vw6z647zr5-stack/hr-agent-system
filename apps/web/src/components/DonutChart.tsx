export interface DonutItem {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  title: string;
  totalLabel: string;
  items: DonutItem[];
  emptyText?: string;
}

export function DonutChart({ title, totalLabel, items, emptyText }: DonutChartProps) {
  const total = items.reduce((sum, it) => sum + it.value, 0);

  if (total === 0) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white p-6 text-center shadow-panel">
        <h4 className="text-sm font-semibold text-ink mb-3">{title}</h4>
        <p className="text-sm text-slate-400">{emptyText ?? `暂无${totalLabel}数据`}</p>
      </div>
    );
  }

  const size = 200;
  const stroke = 20;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;
  const slices = items.map((item) => {
    const pct = item.value / total;
    const length = pct * circumference;
    const slice = { ...item, pct, dashArray: `${length} ${circumference - length}`, dashOffset: -offset };
    offset += length;
    return slice;
  });

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-panel">
      <h4 className="text-sm font-semibold text-ink mb-5">{title}</h4>
      <div className="flex flex-col items-center gap-5">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="drop-shadow-sm">
          <defs>
            <filter id="donutGlow">
              <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
              <feOffset dx="0" dy="1" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#f1f5f9"
            strokeWidth={stroke}
          />
          {slices.map((s, i) => (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeLinecap={s.pct > 0.03 ? 'round' : 'butt'}
              strokeDasharray={s.dashArray}
              strokeDashoffset={s.dashOffset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              filter="url(#donutGlow)"
            >
              <animate attributeName="stroke-dashoffset" from="0" to={s.dashOffset} dur="0.8s" fill="freeze" />
            </circle>
          ))}
          <text x={size / 2} y={size / 2 - 4} textAnchor="middle" className="text-2xl font-bold" fill="#112138">
            {total}
          </text>
          <text x={size / 2} y={size / 2 + 16} textAnchor="middle" className="text-xs" fill="#94a3b8">
            {totalLabel}
          </text>
        </svg>
        <div className="w-full space-y-2.5">
          {items.map((item, i) => {
            const pct = Math.round((item.value / total) * 100);
            return (
              <div key={i} className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="inline-block h-3 w-3 shrink-0 rounded-sm"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-slate-600 truncate">{item.label}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-semibold text-ink tabular-nums">{item.value}</span>
                  <span className="text-xs text-slate-400 tabular-nums w-9 text-right">{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
