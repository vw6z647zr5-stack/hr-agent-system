interface JobHealthItem {
  title?: string;
  postingTitle?: string;
  departmentName?: string | null;
  candidateCount?: number;
  progressPercent?: number;
  averageMatchScore?: number;
  urgencyLevel?: string;
}

interface JobHealthMiniChartProps {
  items?: JobHealthItem[];
  className?: string;
}

function urgencyColor(level?: string) {
  switch (level) {
    case 'critical':
      return { dot: '#ef4444', label: '紧急', bg: '#fef2f2' };
    case 'high':
      return { dot: '#f97316', label: '高', bg: '#fff7ed' };
    case 'medium':
      return { dot: '#eab308', label: '中', bg: '#fefce8' };
    default:
      return { dot: '#22c55e', label: '正常', bg: '#f0fdf4' };
  }
}

export function JobHealthMiniChart({ items, className }: JobHealthMiniChartProps) {
  if (!items || items.length === 0) {
    return (
      <div className={`rounded-2xl border border-slate-100 bg-white p-6 text-center text-sm text-slate-400 shadow-panel ${className ?? ''}`}>
        暂无岗位健康数据
      </div>
    );
  }

  return (
    <div className={className}>
      <h5 className="text-sm font-semibold text-ink mb-4">开放岗位健康度</h5>
      <div className="space-y-3">
        {items.map((item, i) => {
          const matchScore = item.averageMatchScore ?? 0;
          const progress = item.progressPercent ?? 0;
          const urgency = urgencyColor(item.urgencyLevel);
          const displayTitle = item.title ?? item.postingTitle ?? '岗位';

          return (
            <div
              key={i}
              className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-ink truncate">{displayTitle}</span>
                    <span
                      className="inline-block shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: urgency.bg, color: urgency.dot }}
                    >
                      {urgency.label}
                    </span>
                  </div>
                  {item.departmentName && (
                    <div className="text-xs text-slate-500 mt-1">{item.departmentName}</div>
                  )}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-3">
                <div className="text-center">
                  <div className="text-[11px] text-slate-400">候选人</div>
                  <div className="text-lg font-bold text-ink tabular-nums mt-0.5">{item.candidateCount ?? 0}</div>
                </div>
                <div className="text-center">
                  <div className="text-[11px] text-slate-400">匹配分</div>
                  <div className="text-lg font-bold tabular-nums mt-0.5" style={{ color: matchScore >= 80 ? '#22c55e' : matchScore >= 60 ? '#eab308' : '#94a3b8' }}>
                    {matchScore}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-[11px] text-slate-400">进度</div>
                  <div className="text-lg font-bold text-ink tabular-nums mt-0.5">{progress}%</div>
                </div>
              </div>

              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.max(4, progress)}%`,
                    backgroundColor: progress >= 80 ? '#22c55e' : progress >= 40 ? '#eab308' : '#94a3b8',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
