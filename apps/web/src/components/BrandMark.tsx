interface BrandMarkProps {
  compact?: boolean;
  inverse?: boolean;
}

export function BrandMark({ compact = false, inverse = false }: BrandMarkProps) {
  const titleColor = inverse ? 'text-white' : 'text-ink';
  const subtitleColor = inverse ? 'text-teal-100' : 'text-slate-500';

  return (
    <div className="flex items-center gap-3">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-brand shadow-[0_10px_22px_rgba(15,118,110,0.22)]">
        <div className="relative h-7 w-7">
          <span className="absolute left-0 top-0 h-3 w-3 rounded-full bg-white" />
          <span className="absolute right-0 top-1 h-3 w-3 rounded-full bg-white/90" />
          <span className="absolute bottom-0 left-2 h-3 w-3 rounded-full bg-white/80" />
          <span className="absolute left-[0.65rem] top-[0.45rem] h-4 w-1 rounded-full bg-white/70 rotate-45" />
          <span className="absolute left-[0.72rem] top-[0.65rem] h-4 w-1 rounded-full bg-white/70 -rotate-45" />
        </div>
      </div>
      {!compact ? (
        <div>
          <div className={`text-xl font-semibold leading-tight ${titleColor}`}>明智人力</div>
          <div className={`mt-1 text-xs ${subtitleColor}`}>企业人力资源智能平台</div>
        </div>
      ) : null}
    </div>
  );
}
