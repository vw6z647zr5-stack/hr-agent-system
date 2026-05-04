interface SkeletonProps {
  lines?: number;
  className?: string;
}

function SkeletonBlock({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`animate-shimmer rounded-2xl bg-slate-200 ${className}`} style={style} />;
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-100 bg-white p-5 ${className}`}>
      <SkeletonBlock className="mb-3 h-3 w-1/3" />
      <SkeletonBlock className="h-8 w-2/3" />
      <SkeletonBlock className="mt-2 h-3 w-1/2" />
    </div>
  );
}

export function SkeletonLine({ lines = 3, className = '' }: SkeletonProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBlock key={i} className="h-4" style={{ width: `${70 + Math.random() * 30}%` }} />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 3 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4">
          {Array.from({ length: cols }).map((_, c) => (
            <SkeletonBlock key={c} className="h-5 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div className="space-y-8">
      <div className="rounded-[2rem] border border-white/60 bg-white/60 p-8">
        <SkeletonBlock className="mb-2 h-8 w-1/3" />
        <SkeletonBlock className="h-4 w-2/3" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-100 bg-white p-6">
          <SkeletonBlock className="mb-6 h-5 w-1/4" />
          <div className="grid gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-3">
                <SkeletonBlock className="h-28 w-28 rounded-full" />
                <SkeletonBlock className="h-3 w-16" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-3xl border border-slate-100 bg-white p-6">
          <SkeletonBlock className="mb-6 h-5 w-1/4" />
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SkeletonPage() {
  return (
    <div className="space-y-6">
      <SkeletonBlock className="h-8 w-1/3" />
      <SkeletonBlock className="h-4 w-2/3" />
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-100 bg-white p-6">
          <SkeletonTable rows={4} cols={3} />
        </div>
        <div className="rounded-3xl border border-slate-100 bg-white p-6">
          <SkeletonLine lines={5} />
        </div>
      </div>
    </div>
  );
}
