import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';
import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  helper?: string;
  icon?: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
  color?: string;
  className?: string;
}

const trendColors = {
  up: 'text-emerald-600 bg-emerald-50',
  down: 'text-red-500 bg-red-50',
  neutral: 'text-slate-500 bg-slate-50',
};

export function StatCard({ label, value, helper, icon, trend, trendLabel, color, className = '' }: StatCardProps) {
  return (
    <div
      className={`group animate-fade-up rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${className}`}
      style={{ borderTop: color ? `3px solid ${color}` : '3px solid #0f766e', paddingTop: '1.25rem', paddingLeft: '1.25rem', paddingRight: '1.25rem', paddingBottom: '1.25rem' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-slate-500">{label}</div>
          <div
            className="mt-2 text-[1.75rem] font-extrabold leading-tight text-ink"
            style={color ? { color } : undefined}
          >
            {value}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {trend && (
              <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-semibold ${trendColors[trend]}`}>
                {trend === 'up' ? <ArrowUpOutlined /> : trend === 'down' ? <ArrowDownOutlined /> : null}
                {trendLabel}
              </span>
            )}
            {helper && <span className="text-xs text-slate-500">{helper}</span>}
          </div>
        </div>
        {icon && (
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-teal-50 text-brand">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
