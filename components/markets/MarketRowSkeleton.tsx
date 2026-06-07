export function MarketRowSkeleton() {
  return (
    <div className="flex animate-pulse items-center gap-3 border-b border-white/[0.04] px-4 py-3.5">
      <div className="h-9 w-9 rounded-full bg-white/[0.06]" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-3.5 w-24 rounded bg-white/[0.06]" />
        <div className="h-3 w-16 rounded bg-white/[0.04]" />
      </div>
      <div className="space-y-2 text-right">
        <div className="ml-auto h-3.5 w-20 rounded bg-white/[0.06]" />
        <div className="ml-auto h-3 w-14 rounded bg-white/[0.04]" />
      </div>
    </div>
  );
}
